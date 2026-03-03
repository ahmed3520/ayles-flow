import type { Sandbox } from 'e2b'

import type {
  BackgroundProcess,
  CodingToolContext,
  ToolResult,
} from '@/types/coding-agent'

import { loadSkill } from '@/data/skill-loader'
import { getPreviewUrl } from '@/data/e2b-client'
import { r2Put, r2Delete, toRelativePath } from '@/data/r2-client'

const MAX_READ_CHARS = 8000
const MAX_CMD_CHARS = 4000

// --- Arg validation ---

const REQUIRED_ARGS: Record<string, string[]> = {
  read: ['path'],
  write: ['path', 'content'],
  edit: ['path', 'old_string', 'new_string'],
  multi_edit: ['path', 'edits'],
  delete: ['path'],
  mkdir: ['path'],
  move: ['from_path', 'to_path'],
  grep: ['pattern'],
  glob: ['pattern'],
  ls: [],
  shell: [],  // command is required for execution but not for action=list
  lint: ['path'],
  workspace_info: [],
  load_skill: ['name'],
  get_preview_url: ['port'],
}

function validateArgs(
  toolName: string,
  args: Record<string, unknown>,
): string | null {
  const required = REQUIRED_ARGS[toolName]
  if (!required) return null

  const missing = required.filter(
    (arg) => args[arg] === undefined || args[arg] === null,
  )
  if (missing.length > 0) {
    return `Missing required arguments for '${toolName}': ${missing.join(', ')}`
  }
  return null
}

// --- Truncation ---

function truncate(text: string, maxChars: number, label = ''): string {
  if (typeof text !== 'string' || text.length <= maxChars) return text
  return text.slice(0, maxChars) + `\n... [${label} truncated, ${text.length} total chars]`
}

// --- Shell helper (escapes single quotes in args) ---

function shellEscape(str: string): string {
  return str.replace(/'/g, "'\\''")
}

// --- LSP diagnostics ---

const LSP_EXTS = new Set(['ts', 'tsx', 'js', 'jsx'])

async function getLspDiagnostics(
  sandbox: Sandbox,
  lspPort: number | null,
  filePath: string,
): Promise<string | null> {
  if (!lspPort) return null
  const ext = filePath.split('.').pop()?.toLowerCase() || ''
  if (!LSP_EXTS.has(ext)) return null

  try {
    const payload = JSON.stringify({ path: filePath })
    const result = await sandbox.commands.run(
      `curl -s -m 5 -X POST http://localhost:${lspPort}/diagnostics -H 'Content-Type: application/json' -d '${shellEscape(payload)}'`,
      { timeoutMs: 8_000 },
    )
    if (result.exitCode !== 0 || !result.stdout.trim()) return null

    const response = JSON.parse(result.stdout)
    const diags = response.diagnostics as Array<{
      line: number; col: number; severity: string; message: string; code?: unknown
    }>
    if (!diags || diags.length === 0) return null

    const errors = diags.filter((d) => d.severity === 'error')
    const warnings = diags.filter((d) => d.severity === 'warning')
    const lines: string[] = []
    for (const e of errors.slice(0, 10)) {
      lines.push(`L${e.line}:${e.col} ERROR: ${e.message}`)
    }
    for (const w of warnings.slice(0, 5)) {
      lines.push(`L${w.line}:${w.col} WARNING: ${w.message}`)
    }
    if (diags.length > 15) lines.push(`... and ${diags.length - 15} more`)
    return lines.join('\n')
  } catch {
    return null
  }
}

// --- Main executor ---

export async function executeCodingTool(
  sandbox: Sandbox,
  toolName: string,
  args: Record<string, unknown>,
  context: CodingToolContext,
): Promise<ToolResult> {
  const validationError = validateArgs(toolName, args)
  if (validationError) {
    return { success: false, result: null, error: validationError, validationError: true }
  }

  try {
    const result = await dispatch(sandbox, toolName, args, context)
    return { success: true, result }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)

    // Check for expired sandbox
    const lower = msg.toLowerCase()
    if (
      (lower.includes('sandbox') && lower.includes('not found')) ||
      lower.includes('sandbox was not found') ||
      lower.includes('usage limit reached')
    ) {
      return { success: false, result: null, error: 'Sandbox expired. Please start a new session.', expired: true }
    }

    return { success: false, result: null, error: msg }
  }
}

// --- Dispatch ---

async function dispatch(
  sandbox: Sandbox,
  toolName: string,
  args: Record<string, unknown>,
  context: CodingToolContext,
): Promise<unknown> {
  switch (toolName) {
    // ===== File Operations =====

    case 'read': {
      const content = await sandbox.files.read(args.path as string)
      const allLines = content.split('\n')

      // offset is 1-indexed (matching the definition)
      const offset = Math.max(0, ((args.offset as number) || 1) - 1)
      const limit = args.limit as number | undefined
      const sliced = limit ? allLines.slice(offset, offset + limit) : allLines.slice(offset)

      // Add line numbers (1-indexed), matching Python behavior
      const numbered = sliced.map((line, i) => {
        const lineNum = offset + i + 1
        return `${String(lineNum).padStart(6, ' ')}\t${line}`
      })

      return truncate(numbered.join('\n'), MAX_READ_CHARS, 'file content')
    }

    case 'write': {
      const path = args.path as string
      const fileContent = args.content as string
      await sandbox.files.write(path, fileContent)
      await context.write({ type: 'file_change', path, action: 'create' })
      r2Put(context.projectId, toRelativePath(path, context.workdir), fileContent).catch((e) => console.error('[r2-sync]', e))
      const diags = await getLspDiagnostics(sandbox, context.lspPort, path)
      return { success: true, path, ...(diags && { diagnostics: diags }) }
    }

    case 'edit': {
      const path = args.path as string
      const content = await sandbox.files.read(path)
      const oldStr = args.old_string as string
      const newStr = args.new_string as string
      const replaceAll = args.replace_all as boolean | undefined

      if (!content.includes(oldStr)) {
        return { success: false, error: `old_string not found in ${path}` }
      }

      // Check uniqueness when not using replace_all
      if (!replaceAll) {
        const count = content.split(oldStr).length - 1
        if (count > 1) {
          return { success: false, error: `old_string found ${count} times in ${path}. Use replace_all=true to replace all, or provide a more specific string.` }
        }
      }

      const updated = replaceAll
        ? content.replaceAll(oldStr, newStr)
        : content.replace(oldStr, newStr)

      await sandbox.files.write(path, updated)
      await context.write({ type: 'file_change', path, action: 'update' })
      r2Put(context.projectId, toRelativePath(path, context.workdir), updated).catch((e) => console.error('[r2-sync]', e))
      const diags = await getLspDiagnostics(sandbox, context.lspPort, path)
      return { success: true, path, ...(diags && { diagnostics: diags }) }
    }

    case 'multi_edit': {
      const path = args.path as string
      const edits = args.edits as Array<{ old_string: string; new_string: string; replace_all?: boolean }>
      const original = await sandbox.files.read(path)
      let content = original

      for (const edit of edits) {
        if (!content.includes(edit.old_string)) {
          return { success: false, error: `Edit not found: ${edit.old_string.slice(0, 50)}...` }
        }
        content = edit.replace_all
          ? content.replaceAll(edit.old_string, edit.new_string)
          : content.replace(edit.old_string, edit.new_string)
      }

      await sandbox.files.write(path, content)
      await context.write({ type: 'file_change', path, action: 'update' })
      r2Put(context.projectId, toRelativePath(path, context.workdir), content).catch((e) => console.error('[r2-sync]', e))
      const diags = await getLspDiagnostics(sandbox, context.lspPort, path)
      return { success: true, path, edits_applied: edits.length, ...(diags && { diagnostics: diags }) }
    }

    case 'delete': {
      const path = args.path as string
      await sandbox.commands.run(`rm -rf '${shellEscape(path)}'`)
      await context.write({ type: 'file_change', path, action: 'delete' })
      r2Delete(context.projectId, toRelativePath(path, context.workdir)).catch((e) => console.error('[r2-sync]', e))
      return { success: true, path }
    }

    case 'mkdir': {
      const path = args.path as string
      await sandbox.commands.run(`mkdir -p '${shellEscape(path)}'`)
      return { success: true, path }
    }

    case 'move': {
      const from = args.from_path as string
      const to = args.to_path as string
      await sandbox.commands.run(`mv '${shellEscape(from)}' '${shellEscape(to)}'`)
      await context.write({ type: 'file_change', path: from, action: 'delete' })
      await context.write({ type: 'file_change', path: to, action: 'create' })
      r2Delete(context.projectId, toRelativePath(from, context.workdir)).catch((e) => console.error('[r2-sync]', e))
      sandbox.files.read(to).then((c) =>
        r2Put(context.projectId, toRelativePath(to, context.workdir), c),
      ).catch((e) => console.error('[r2-sync]', e))
      return { success: true, from, to }
    }

    case 'grep': {
      const pattern = args.pattern as string
      const path = (args.path as string) || '.'
      const outputMode = (args.output_mode as string) || 'files_with_matches'
      const globFilter = args.glob as string | undefined
      const beforeContext = args.before_context as number | undefined
      const afterContext = args.after_context as number | undefined
      const contextLines = args.context as number | undefined
      const lineNumbers = args.line_numbers as boolean | undefined
      const caseInsensitive = args.case_insensitive as boolean | undefined
      const fileType = args.file_type as string | undefined
      const headLimit = args.head_limit as number | undefined
      const multiline = args.multiline as boolean | undefined

      // Build ripgrep command
      const parts: string[] = ['rg']

      // Output mode
      if (outputMode === 'files_with_matches') {
        parts.push('-l')
      } else if (outputMode === 'count') {
        parts.push('-c')
      }
      // 'content' mode is default rg behavior (show matching lines)

      // Flags
      if (caseInsensitive) parts.push('-i')
      if (lineNumbers && outputMode === 'content') parts.push('-n')
      if (multiline) parts.push('-U', '--multiline-dotall')

      // Context (only for content mode)
      if (outputMode === 'content') {
        if (contextLines != null) parts.push(`-C ${contextLines}`)
        if (beforeContext != null) parts.push(`-B ${beforeContext}`)
        if (afterContext != null) parts.push(`-A ${afterContext}`)
      }

      // Filters
      if (globFilter) parts.push(`--glob '${shellEscape(globFilter)}'`)
      if (fileType) parts.push(`--type ${fileType}`)

      // Always exclude common noise
      parts.push("--glob '!node_modules'", "--glob '!.git'", "--glob '!dist'", "--glob '!.next'")

      // Pattern and path
      parts.push(`'${shellEscape(pattern)}'`, path)

      // Head limit
      if (headLimit) {
        parts.push(`| head -${headLimit}`)
      }

      // Fallback: if rg not available, use grep
      const rgCmd = parts.join(' ')
      const fallbackCmd = `(${rgCmd}) 2>/dev/null || grep -rn '${shellEscape(pattern)}' ${path} 2>/dev/null | head -50`

      const result = await sandbox.commands.run(fallbackCmd)
      const output = result.stdout.trim()

      if (outputMode === 'files_with_matches') {
        const files = output.split('\n').filter(Boolean)
        return { files, count: files.length }
      }

      if (outputMode === 'count') {
        const counts: Record<string, number> = {}
        for (const line of output.split('\n')) {
          if (!line) continue
          const sep = line.lastIndexOf(':')
          if (sep > 0) {
            counts[line.substring(0, sep)] = parseInt(line.substring(sep + 1)) || 0
          }
        }
        return { counts, total: Object.values(counts).reduce((a, b) => a + b, 0) }
      }

      // content mode — return structured matches
      const matches: Array<{ file: string; line: number; content: string }> = []
      for (const line of output.split('\n')) {
        if (!line || !line.includes(':')) continue
        const parts2 = line.split(':')
        if (parts2.length >= 3) {
          matches.push({
            file: parts2[0],
            line: parseInt(parts2[1]) || 0,
            content: parts2.slice(2).join(':'),
          })
        }
      }
      return truncate(output, MAX_CMD_CHARS, 'grep output')
    }

    case 'glob': {
      const pattern = args.pattern as string
      const path = (args.path as string) || '.'

      // Use find with proper glob support
      // For ** patterns, use -path; for simple patterns, use -name
      let cmd: string
      if (pattern.includes('**') || pattern.includes('/')) {
        // Recursive glob — use -path with the pattern
        // Convert ** to find's * (find -path uses shell-like matching)
        const findPattern = pattern.replace(/\*\*/g, '*')
        cmd = `find ${path} -type f -path '*/${findPattern}' -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' 2>/dev/null | head -100`
      } else {
        cmd = `find ${path} -type f -name '${shellEscape(pattern)}' -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' 2>/dev/null | head -100`
      }

      const result = await sandbox.commands.run(cmd)
      const files = result.stdout.split('\n').filter(Boolean)
      return { pattern, path, matches: files, count: files.length }
    }

    case 'ls': {
      const path = (args.path as string) || '.'
      const ignore = args.ignore as string[] | undefined

      const entries = await sandbox.files.list(path)
      let results = entries.map((e) => ({
        name: e.name,
        path: e.path,
        isDirectory: e.type === 'dir',
      }))

      // Apply ignore patterns
      if (ignore && ignore.length > 0) {
        results = results.filter((entry) => {
          for (const pattern of ignore) {
            // Simple glob matching: *.ext and exact name
            if (pattern.startsWith('*.')) {
              const ext = pattern.slice(1) // e.g., ".log"
              if (entry.name.endsWith(ext)) return false
            } else if (entry.name === pattern) {
              return false
            }
          }
          return true
        })
      }

      return results
    }

    // ===== Shell Operations =====

    case 'shell': {
      const action = args.action as string | undefined

      // Action: list all background processes
      if (action === 'list') {
        const procs = Array.from(context.backgroundProcesses.entries()).map(([id, p]) => ({
          process_id: id, name: p.name, command: p.command, pid: p.pid,
        }))
        return { processes: procs }
      }

      // Action: get output from background process
      if (action === 'output') {
        const processId = args.process_id as string
        if (!processId) return { error: 'process_id is required for action=output' }
        const proc = context.backgroundProcesses.get(processId)
        if (!proc) {
          return { error: 'Process not found', available: Array.from(context.backgroundProcesses.keys()) }
        }
        const lines = (args.lines as number) || 50
        const result = await sandbox.commands.run(`tail -n ${lines} ${proc.logFile}`)
        const check = await sandbox.commands.run(`ps -p ${proc.pid} > /dev/null 2>&1 && echo 1 || echo 0`)
        return { output: result.stdout, is_running: check.stdout.trim() === '1', process_id: processId }
      }

      // Action: stop background process
      if (action === 'stop') {
        const processId = args.process_id as string
        if (!processId) return { error: 'process_id is required for action=stop' }
        const proc = context.backgroundProcesses.get(processId)
        if (!proc) return { success: false, error: 'Process not found' }
        await sandbox.commands.run(`kill ${proc.pid} 2>/dev/null || true`)
        context.backgroundProcesses.delete(processId)
        return { success: true, process_id: processId }
      }

      // Execute command
      const command = args.command as string
      if (!command) return { error: 'command is required to execute a shell command' }

      const cwd = args.cwd as string | undefined
      const timeoutMs = (args.timeout_ms as number) || 120_000
      const background = args.background as boolean | undefined

      // Background mode: start long-running process
      if (background) {
        const name = (args.name as string) || command.slice(0, 20)
        const processId = `bg_${context.backgroundProcesses.size}`
        const logFile = `/tmp/${processId}.log`

        const cwdPrefix = cwd ? `cd ${cwd} && ` : ''
        const bgCmd = `bash -c '${cwdPrefix}${command}' > ${logFile} 2>&1 & echo $!`
        const result = await sandbox.commands.run(bgCmd)
        const pid = parseInt(result.stdout.trim().split('\n').pop() || '0')

        const proc: BackgroundProcess = {
          pid, command, name, logFile, cwd: cwd || '.',
        }
        context.backgroundProcesses.set(processId, proc)

        return { process_id: processId, name, pid }
      }

      // Foreground execution
      const result = await sandbox.commands.run(command, {
        cwd,
        timeoutMs,
        onStdout: async (data) => {
          await context.write({ type: 'terminal_output', content: data, stream: 'stdout' })
        },
        onStderr: async (data) => {
          await context.write({ type: 'terminal_output', content: data, stream: 'stderr' })
        },
      })

      return {
        stdout: truncate(result.stdout, MAX_CMD_CHARS, 'stdout'),
        stderr: truncate(result.stderr, MAX_CMD_CHARS / 2, 'stderr'),
        exit_code: result.exitCode,
        success: result.exitCode === 0,
      }
    }

    // ===== Development =====

    case 'lint': {
      const path = args.path as string
      const ext = path.split('.').pop() || ''

      // Use LSP for TS/JS when available
      if (context.lspPort && LSP_EXTS.has(ext)) {
        const diags = await getLspDiagnostics(sandbox, context.lspPort, path)
        return { valid: !diags, diagnostics: diags || 'No issues found.' }
      }

      // Fallback: basic syntax checks
      const errors: Array<{ line: number; message: string; severity: string }> = []

      if (['py'].includes(ext)) {
        const result = await sandbox.commands.run(`python3 -m py_compile ${path} 2>&1`)
        if (result.exitCode !== 0) {
          errors.push({ line: 0, message: (result.stdout || result.stderr).trim(), severity: 'error' })
        }
      } else if (['js', 'jsx', 'ts', 'tsx'].includes(ext)) {
        const result = await sandbox.commands.run(`node --check ${path} 2>&1`)
        if (result.exitCode !== 0) {
          errors.push({ line: 0, message: (result.stdout || result.stderr).trim(), severity: 'error' })
        }
      } else if (ext === 'json') {
        const result = await sandbox.commands.run(`python3 -c "import json; json.load(open('${path}'))" 2>&1`)
        if (result.exitCode !== 0) {
          errors.push({ line: 0, message: (result.stdout || result.stderr).trim(), severity: 'error' })
        }
      }

      return { valid: errors.length === 0, errors }
    }

    // ===== Workspace =====

    case 'workspace_info': {
      const maxDepth = (args.max_depth as number) || 3
      const info: Record<string, unknown> = {}

      // Get current directory
      const cwdResult = await sandbox.commands.run('pwd')
      info.cwd = cwdResult.stdout.trim()

      // File tree
      const treeCmd = `find . -maxdepth ${maxDepth} -type f -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' -not -path '*/__pycache__/*' -not -path '*/.next/*' 2>/dev/null | head -100`
      const treeResult = await sandbox.commands.run(treeCmd)
      info.file_tree = treeResult.stdout.split('\n').filter(Boolean)

      // Config files
      const cfgResult = await sandbox.commands.run(
        'ls -1 package.json tsconfig.json vite.config.* tailwind.config.* .env* requirements.txt pyproject.toml 2>/dev/null || true',
      )
      info.config_files = cfgResult.stdout.split('\n').filter(Boolean)

      // Package info
      const pkgResult = await sandbox.commands.run('cat package.json 2>/dev/null')
      if (pkgResult.exitCode === 0 && pkgResult.stdout.trim()) {
        try {
          const pkg = JSON.parse(pkgResult.stdout)
          info.package_info = {
            name: pkg.name || 'unknown',
            scripts: Object.keys(pkg.scripts || {}),
            dependencies: Object.keys(pkg.dependencies || {}),
            devDependencies: Object.keys(pkg.devDependencies || {}),
          }
        } catch {
          // malformed package.json
        }
      }

      // Pre-installed UI components
      const uiDirs = [
        'src/components/ui',
        'components/ui',
        'frontend/src/components/ui',
        'frontend/components/ui',
      ]
      for (const uiDir of uiDirs) {
        const uiResult = await sandbox.commands.run(`ls -1 ${uiDir} 2>/dev/null`)
        if (uiResult.exitCode === 0 && uiResult.stdout.trim()) {
          const components = uiResult.stdout
            .split('\n')
            .filter(Boolean)
            .map((f) => f.replace(/\.tsx?$/, ''))
          info.ui_components = {
            path: uiDir,
            count: components.length,
            components,
            note: 'Pre-installed — import these, do NOT recreate or edit them',
          }
          break
        }
      }

      return info
    }

    // ===== Skills =====

    case 'load_skill': {
      const name = args.name as string
      const skill = loadSkill(name)
      if (!skill) {
        return { error: `Skill '${name}' not found` }
      }
      await context.write({ type: 'skill_loaded', name })
      return { name, content: skill.content }
    }

    // ===== Preview =====

    case 'get_preview_url': {
      const port = args.port as number
      const url = getPreviewUrl(sandbox, port)
      await context.write({ type: 'preview_url', url, port })
      return { url, port }
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`)
  }
}
