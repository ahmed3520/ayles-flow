import { createServerFn } from '@tanstack/react-start'
import type { Sandbox } from 'e2b'

import { createSandbox, reconnectSandbox, getPreviewUrl } from '@/data/e2b-client'
import { getTemplate } from '@/config/e2bTemplates'
import { r2Get, r2ListFiles, r2GetMeta, r2PutMeta } from '@/data/r2-client'

// --- Reconnect or Restore ---

export const reconnectOrRestore = createServerFn({ method: 'POST' })
  .inputValidator((data: { sandboxId?: string; projectId: string; templateName?: string }) => data)
  .handler(({ data }) => {
    // Stream progress to avoid CF Worker timeout
    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()
    const encoder = new TextEncoder()
    const emit = (event: Record<string, unknown>) =>
      writer.write(encoder.encode(JSON.stringify(event) + '\n'))

    ;(async () => {
      try {
        // 1. Get template info
        const meta = await r2GetMeta(data.projectId)
        const templateName = data.templateName || meta?.templateName || 'vite'
        const template = getTemplate(templateName)
        if (!template) {
          await emit({ type: 'error', message: `Unknown template: ${templateName}` })
          return
        }

        // 2. Create fresh sandbox
        await emit({ type: 'status', step: 'Creating sandbox...' })
        const { sandbox, info } = await createSandbox(templateName)

        // 3. Restore files from R2
        await emit({ type: 'status', step: 'Restoring files...' })
        await restoreFiles(sandbox, data.projectId, template.workdir)

        // 4. Install dependencies
        await emit({ type: 'status', step: 'Installing dependencies...' })
        const installResult = await sandbox.commands.run(`cd ${template.workdir} && npm install 2>&1`, { timeoutMs: 120_000 })
        if (installResult.exitCode !== 0) {
          await emit({ type: 'status', step: `npm install failed (exit ${installResult.exitCode}), continuing anyway...` })
        }

        // 5. Start dev server in background (same pattern as coding-tool-executor)
        if (template.devCmd) {
          await emit({ type: 'status', step: 'Starting dev server...' })
          await sandbox.commands.run(
            `bash -c 'cd ${template.workdir} && ${template.devCmd}' > /tmp/dev.log 2>&1 & echo $!`,
          )
        }

        const previewUrl = getPreviewUrl(sandbox, template.defaultPort)
        console.log(`[sandbox-sync] Restored ${data.projectId} → ${info.sandboxId}`)
        await emit({ type: 'done', sandboxId: info.sandboxId, previewUrl })
      } catch (err) {
        console.error('[sandbox-sync]', err)
        await emit({ type: 'error', message: err instanceof Error ? err.message : String(err) })
      } finally {
        await writer.close()
      }
    })()

    return new Response(readable, {
      headers: { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-cache' },
    })
  })

// --- Deploy to Vercel (runs inside E2B sandbox, streams logs via NDJSON) ---

export const deployToVercel = createServerFn({ method: 'POST' })
  .inputValidator(
    (data: { sandboxId: string; projectName: string; envVars?: Record<string, string> }) => data,
  )
  .handler(({ data }) => {
    const vercelToken = process.env.VERCEL_TOKEN
    const vercelTeamId = process.env.VERCEL_TEAM_ID
    if (!vercelToken) throw new Error('VERCEL_TOKEN is not configured')

    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()
    const encoder = new TextEncoder()

    const emit = (event: Record<string, unknown>) =>
      writer.write(encoder.encode(JSON.stringify(event) + '\n'))

    ;(async () => {
      try {
        const { sandbox } = await reconnectSandbox(data.sandboxId)
        await emit({ type: 'log', text: 'Connected to sandbox\n' })

        // Write env vars
        if (data.envVars && Object.keys(data.envVars).length > 0) {
          const envContent = Object.entries(data.envVars)
            .map(([k, v]) => `${k}=${v}`)
            .join('\n')
          await sandbox.files.write('/home/user/app/.env.production', envContent)
          await emit({ type: 'log', text: 'Wrote .env.production\n' })
        }

        const teamFlag = vercelTeamId ? ` --scope ${vercelTeamId}` : ''
        const slug = slugify(data.projectName)
        const projectName = slug || randomProjectName()

        await emit({ type: 'log', text: `Deploying as "${projectName}"...\n\n` })

        // Stream stdout/stderr in real-time, collect for URL extraction
        let allOutput = ''
        const result = await sandbox.commands.run(
          `npx --yes vercel deploy --yes --prod --public --token ${vercelToken}${teamFlag} --name ${projectName}`,
          {
            cwd: '/home/user/app',
            timeoutMs: 180_000,
            onStdout: async (chunk) => { allOutput += chunk; await emit({ type: 'log', text: chunk }) },
            onStderr: async (chunk) => { allOutput += chunk; await emit({ type: 'log', text: chunk }) },
          },
        )

        if (result.exitCode !== 0) {
          await emit({ type: 'error', text: `\nDeploy failed (exit code ${result.exitCode})` })
        } else {
          // Extract URL from collected output
          const lines = allOutput.trim().split('\n')
          const url = lines.find((l) => l.trim().startsWith('https://')) || lines[lines.length - 1]
          await emit({ type: 'done', url: url.trim() })
        }
      } catch (err) {
        await emit({ type: 'error', text: err instanceof Error ? err.message : String(err) })
      } finally {
        await writer.close()
      }
    })()

    return new Response(readable, {
      headers: { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-cache' },
    })
  })

// --- Full sync (for initial sync of existing sandbox to R2) ---

export const fullSync = createServerFn({ method: 'POST' })
  .inputValidator((data: { sandboxId: string; projectId: string; templateName: string }) => data)
  .handler(async ({ data }) => {
    const { sandbox } = await reconnectSandbox(data.sandboxId)
    const template = getTemplate(data.templateName)
    const workdir = template?.workdir || '/home/user/app'

    // List source files (exclude heavy dirs)
    const excludes = [
      'node_modules', '.git', 'dist', '.next', 'build', '__pycache__', '.cache', '.turbo',
    ].map((d) => `-not -path '*/${d}/*'`).join(' ')

    const result = await sandbox.commands.run(
      `find ${workdir} -type f ${excludes} 2>/dev/null`,
      { timeoutMs: 30_000 },
    )

    const files = result.stdout.split('\n').filter(Boolean)
    const { r2Put, toRelativePath } = await import('@/data/r2-client')
    const wd = workdir.endsWith('/') ? workdir : workdir + '/'
    let synced = 0

    const BATCH = 20
    for (let i = 0; i < files.length; i += BATCH) {
      await Promise.all(
        files.slice(i, i + BATCH).map(async (f) => {
          try {
            const content = await sandbox.files.read(f)
            await r2Put(data.projectId, toRelativePath(f, wd), content)
            synced++
          } catch { /* skip binary/unreadable files */ }
        }),
      )
    }

    await r2PutMeta(data.projectId, { templateName: data.templateName, lastSync: Date.now() })
    console.log(`[sandbox-sync] Full sync: ${synced}/${files.length} files`)
    return { synced, total: files.length }
  })

// --- Download project as zip ---

export const downloadProject = createServerFn({ method: 'POST' })
  .inputValidator((data: { sandboxId: string; projectName: string }) => data)
  .handler(async ({ data }) => {
    const { sandbox } = await reconnectSandbox(data.sandboxId)
    const workdir = '/home/user/app'
    const tarPath = '/tmp/project.tar.gz'

    const excludes = [
      '--exclude=node_modules', '--exclude=.git', '--exclude=dist',
      '--exclude=.next', '--exclude=build', '--exclude=__pycache__',
      '--exclude=.cache', '--exclude=.turbo',
    ].join(' ')

    const result = await sandbox.commands.run(
      `tar czf ${tarPath} ${excludes} -C ${workdir} .`,
      { timeoutMs: 30_000 },
    )

    if (result.exitCode !== 0) {
      throw new Error(`tar failed: ${result.stdout}\n${result.stderr}`)
    }

    const tarBytes = await sandbox.files.read(tarPath, { format: 'bytes' })
    const base64 = Buffer.from(tarBytes).toString('base64')
    return { base64, fileName: `${data.projectName || 'project'}.tar.gz` }
  })

// --- Helpers ---

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
}

async function restoreFiles(sandbox: Sandbox, projectId: string, workdir: string): Promise<void> {
  const files = await r2ListFiles(projectId)
  if (files.length === 0) return

  // The workdir basename (e.g. "app") may be baked into R2 paths from older syncs.
  // Strip it to avoid double nesting like /home/user/app/app/...
  const wdBasename = workdir.split('/').filter(Boolean).pop() || ''
  const stripPrefix = wdBasename + '/'

  const BATCH = 20
  for (let i = 0; i < files.length; i += BATCH) {
    await Promise.all(
      files.slice(i, i + BATCH).map(async (relativePath) => {
        try {
          const content = await r2Get(projectId, relativePath)
          if (content === null) return
          // Strip workdir basename prefix if present (e.g. "app/page.tsx" → "page.tsx")
          const cleanPath = relativePath.startsWith(stripPrefix)
            ? relativePath.slice(stripPrefix.length)
            : relativePath
          const fullPath = `${workdir}/${cleanPath}`
          const dir = fullPath.substring(0, fullPath.lastIndexOf('/'))
          await sandbox.commands.run(`mkdir -p '${dir}'`)
          await sandbox.files.write(fullPath, content)
        } catch { /* skip */ }
      }),
    )
  }
  console.log(`[sandbox-sync] Restored ${files.length} files to ${workdir}`)
}

const ADJECTIVES = ['swift', 'bright', 'calm', 'bold', 'cool', 'keen', 'vivid', 'sleek', 'crisp', 'lunar', 'solar', 'neon', 'cyber', 'pixel', 'cloud', 'frost', 'ember', 'flux', 'nova', 'pulse']
const NOUNS = ['fox', 'owl', 'wave', 'spark', 'bloom', 'drift', 'stone', 'reef', 'dune', 'peak', 'grove', 'nest', 'arc', 'haze', 'glow', 'tide', 'fern', 'cove', 'mint', 'opal']

function randomProjectName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]
  const num = Math.floor(Math.random() * 900) + 100
  return `${adj}-${noun}-${num}`
}

