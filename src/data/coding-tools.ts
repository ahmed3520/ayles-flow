import type OpenAI from 'openai'

// --- Coding agent tool definitions (OpenAI function calling format) ---

export const codingTools: Array<OpenAI.ChatCompletionTool> = [
  // ===== File Operations =====
  {
    type: 'function',
    function: {
      name: 'read',
      description: `Read a file from the filesystem.

Usage:
- The path parameter can be absolute or relative to project root
- By default, reads the entire file
- For large files, use offset and limit to read specific line ranges
- Results are returned with line numbers starting at 1

<example>
read(path="src/app.ts")
# Returns entire file content

read(path="src/app.ts", offset=10, limit=20)
# Returns lines 10-30 (20 lines starting from line 10)
</example>

IMPORTANT:
- You MUST use this tool to read files, never use shell commands like \`cat\`, \`head\`, \`tail\`
- If the file is very large, read in chunks using offset/limit
- If the file doesn't exist, an error will be returned`,
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path (absolute or relative to project root)' },
          offset: { type: 'integer', description: 'Line number to start reading from (1-indexed)' },
          limit: { type: 'integer', description: 'Number of lines to read' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write',
      description: `Write content to a file (creates if doesn't exist, overwrites if exists).

Usage:
- Creates parent directories automatically if they don't exist
- Overwrites existing file content completely
- For small edits to existing files, use \`edit\` instead (more efficient)

<example>
write(path="src/utils.ts", content="export const add = (a, b) => a + b;")
</example>

IMPORTANT:
- ALWAYS prefer using \`edit\` for modifying existing files
- NEVER write new files unless explicitly required
- NEVER proactively create documentation files (*.md) or README files
- If you're modifying an existing file, use \`read\` first to understand its content`,
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path to write to' },
          content: { type: 'string', description: 'Complete file content to write' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'edit',
      description: `Edit a file by performing exact string replacement.

Usage:
- You MUST use \`read\` tool at least once before editing a file
- Finds \`old_string\` in the file and replaces it with \`new_string\`
- The \`old_string\` must match exactly, including whitespace and indentation
- Use \`replace_all=true\` to replace all occurrences

<example>
# Replace a single function
edit(
    path="src/utils.ts",
    old_string="const add = (a, b) => a + b;",
    new_string="const add = (a: number, b: number): number => a + b;"
)

# Rename a variable across the file
edit(
    path="src/app.ts",
    old_string="oldVarName",
    new_string="newVarName",
    replace_all=true
)
</example>

IMPORTANT:
- The edit will FAIL if \`old_string\` is not found or not unique (unless replace_all=true)
- Preserve exact indentation from the original file
- This is more efficient than \`write\` for small changes`,
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path to edit' },
          old_string: { type: 'string', description: 'Exact text to find and replace (must match exactly including whitespace)' },
          new_string: { type: 'string', description: 'Text to replace old_string with' },
          replace_all: { type: 'boolean', description: 'Replace all occurrences (default: false, replaces only first)' },
        },
        required: ['path', 'old_string', 'new_string'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'multi_edit',
      description: `Make multiple edits to a single file in one operation.

Use this when you need to make several changes to different parts of the same file.
All edits are applied in sequence - if any edit fails, none are applied.

<example>
multi_edit(
    path="src/app.ts",
    edits=[
        {"old_string": "import foo", "new_string": "import bar"},
        {"old_string": "const x = 1", "new_string": "const x = 2"},
        {"old_string": "oldName", "new_string": "newName", "replace_all": true}
    ]
)
</example>

IMPORTANT:
- All edits follow the same rules as the single \`edit\` tool
- Edits are applied in order, so later edits operate on the result of earlier ones
- Plan carefully to avoid conflicts between edits`,
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path to edit' },
          edits: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                old_string: { type: 'string', description: 'Text to find' },
                new_string: { type: 'string', description: 'Text to replace with' },
                replace_all: { type: 'boolean', description: 'Replace all occurrences' },
              },
              required: ['old_string', 'new_string'],
            },
            description: 'List of edit operations to perform',
          },
        },
        required: ['path', 'edits'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete',
      description: `Delete a file or directory.

<example>
delete(path="src/old-file.ts")
delete(path="temp/")  # Deletes directory and all contents
</example>

WARNING: This permanently deletes files. Use with caution.`,
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to delete (file or directory)' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'mkdir',
      description: `Create a directory. Creates parent directories if needed.

<example>
mkdir(path="src/components/ui")
</example>`,
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path to create' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'move',
      description: `Move or rename a file or directory.

<example>
move(from_path="src/old.ts", to_path="src/new.ts")  # Rename
move(from_path="src/utils.ts", to_path="lib/utils.ts")  # Move
</example>`,
      parameters: {
        type: 'object',
        properties: {
          from_path: { type: 'string', description: 'Current path' },
          to_path: { type: 'string', description: 'New path' },
        },
        required: ['from_path', 'to_path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'grep',
      description: `A powerful search tool built on ripgrep.

Usage:
- ALWAYS use grep for search tasks. NEVER invoke \`grep\` or \`rg\` as a shell command.
- Supports full regex syntax (e.g., "log.*Error", "function\\\\s+\\\\w+")
- Filter files with glob parameter (e.g., "*.js", "**/*.tsx") or type parameter (e.g., "js", "py", "rust")
- Output modes: "content" shows matching lines, "files_with_matches" shows only file paths (default), "count" shows match counts
- Pattern syntax: Uses ripgrep (not grep) - literal braces need escaping (use \`interface\\\\{\\\\}\` to find \`interface{}\` in Go code)
- Multiline matching: By default patterns match within single lines only. For cross-line patterns like \`struct \\\\{[\\\\s\\\\S]*?field\`, use \`multiline: true\`

<example>
grep(pattern="useState", output_mode="content", line_numbers=true)
# Find all useState usages with line numbers

grep(pattern="function.*export", path="src/", glob="*.ts", output_mode="content", before_context=2, after_context=2)
# Find exported functions with context lines

grep(pattern="TODO|FIXME", output_mode="count")
# Count TODO and FIXME comments per file

grep(pattern="import.*from", file_type="ts", output_mode="files_with_matches", head_limit=20)
# Find first 20 TypeScript files with imports
</example>

Output modes:
- "files_with_matches": Returns only file paths (fastest, default)
- "content": Returns matching lines with optional context (-A/-B/-C) and line numbers (-n)
- "count": Returns match counts per file`,
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Regular expression pattern to search for in file contents' },
          path: { type: 'string', description: 'File or directory to search in. Defaults to current working directory.' },
          glob: { type: 'string', description: "Glob pattern to filter files (e.g., '*.js', '*.{ts,tsx}')" },
          output_mode: {
            type: 'string',
            enum: ['content', 'files_with_matches', 'count'],
            description: "Output mode: 'content' shows lines, 'files_with_matches' shows paths (default), 'count' shows counts",
          },
          before_context: { type: 'integer', description: "Lines to show before each match (rg -B). Only with output_mode='content'" },
          after_context: { type: 'integer', description: "Lines to show after each match (rg -A). Only with output_mode='content'" },
          context: { type: 'integer', description: "Lines to show before AND after each match (rg -C). Only with output_mode='content'" },
          line_numbers: { type: 'boolean', description: "Show line numbers in output (rg -n). Only with output_mode='content'" },
          case_insensitive: { type: 'boolean', description: 'Case insensitive search (rg -i)' },
          file_type: { type: 'string', description: 'File type to search (rg --type). Common types: js, ts, py, rust, go, java, etc.' },
          head_limit: { type: 'integer', description: 'Limit output to first N lines/entries. Works across all output modes.' },
          multiline: { type: 'boolean', description: 'Enable multiline mode where . matches newlines and patterns can span lines (rg -U). Default: false.' },
        },
        required: ['pattern'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'glob',
      description: `Find files by name or glob pattern.

Fast file pattern matching for finding files by name.

<example>
glob(pattern="*.tsx")
# Find all .tsx files

glob(pattern="**/*.test.ts", path="src")
# Find all test files in src/

glob(pattern="package.json")
# Find package.json files
</example>

Returns a list of matching file paths.

IMPORTANT: Use this for finding files by name. Use \`grep\` for searching file contents.`,
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: "Glob pattern (e.g., '*.ts', '**/*.json', 'App.tsx')" },
          path: { type: 'string', description: 'Directory to search in (default: current directory)' },
        },
        required: ['pattern'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ls',
      description: `List files and directories in a given path.

Returns file names, paths, and whether each entry is a directory.

<example>
ls(path=".")
# Returns: [{"name": "src", "path": "./src", "isDirectory": true}, ...]

ls(path="src", ignore=["node_modules", "*.log"])
</example>

IMPORTANT: Prefer using \`glob\` or \`grep\` if you know what you're looking for.`,
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path (default: current directory)' },
          ignore: {
            type: 'array',
            items: { type: 'string' },
            description: 'Glob patterns to ignore',
          },
        },
      },
    },
  },

  // ===== Shell Operations =====
  {
    type: 'function',
    function: {
      name: 'shell',
      description: `Execute a shell command and return its output.

To run a command, just pass "command":
  shell(command="npm run build")
  shell(command="npm install", timeout_ms=180000)
  shell(command="npm run dev", background=true, name="dev-server")

Do NOT pass "action" when running a command — "command" and "action" are mutually exclusive.

To manage background processes (ONLY when you have no command to run):
  shell(action="list")
  shell(action="output", process_id="bg_0")
  shell(action="stop", process_id="bg_0")

IMPORTANT:
- NEVER use cat, head, tail to read files — use the read tool instead
- NEVER use cat, echo, heredoc to create files — use the write tool instead
- NEVER use sed, awk to edit files — use the edit tool instead
- NEVER use grep, rg commands — use the grep tool instead
- Use background=true for dev servers and watch processes
- Default timeout is 2 minutes; increase for long builds`,
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Shell command to execute (required for running commands, not needed for action=list)' },
          cwd: { type: 'string', description: 'Working directory (relative to project root)' },
          timeout_ms: { type: 'number', description: 'Timeout in ms (default 120000). Use higher for npm install, builds.' },
          background: { type: 'boolean', description: 'Run as background process (for dev servers, watch processes)' },
          name: { type: 'string', description: 'Friendly name for background process (e.g., "dev-server")' },
          action: {
            type: 'string',
            enum: ['output', 'stop', 'list'],
            description: 'Action for background processes: "output" (get logs), "stop" (terminate), "list" (show all)',
          },
          process_id: { type: 'string', description: 'Process ID for output or stop actions (e.g., "bg_0")' },
          lines: { type: 'number', description: 'Number of output lines to return (default 50, for action=output)' },
        },
        required: [],
      },
    },
  },

  // ===== Development =====
  {
    type: 'function',
    function: {
      name: 'lint',
      description: 'Check a file for syntax errors and lint issues. Detects language automatically from file extension.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path to lint' },
        },
        required: ['path'],
      },
    },
  },

  // ===== Workspace =====
  {
    type: 'function',
    function: {
      name: 'workspace_info',
      description: 'Get workspace information: project type, file tree, package.json contents, pre-installed UI components. Only use this if your system prompt does NOT already describe the template structure.',
      parameters: {
        type: 'object',
        properties: {
          max_depth: { type: 'number', description: 'Max directory depth for file tree (default 3)' },
        },
      },
    },
  },

  // ===== Skills =====
  {
    type: 'function',
    function: {
      name: 'load_skill',
      description: 'Load a skill by name. Returns reference documentation for frameworks, patterns, and best practices. Always load relevant skills BEFORE writing code for that framework.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Skill name (e.g., "frontend-design", "convex", "tailwind-v4-shadcn")' },
        },
        required: ['name'],
      },
    },
  },

  // ===== Preview =====
  {
    type: 'function',
    function: {
      name: 'get_preview_url',
      description: 'Get the public preview URL for a running dev server in the sandbox.',
      parameters: {
        type: 'object',
        properties: {
          port: { type: 'number', description: 'Port number the dev server is running on' },
        },
        required: ['port'],
      },
    },
  },
]
