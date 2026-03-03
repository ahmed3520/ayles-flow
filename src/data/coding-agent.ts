import { createServerFn } from '@tanstack/react-start'
import type OpenAI from 'openai'

import type {
  CodingAgentInput,
  CodingToolContext,
  BackgroundProcess,
} from '@/types/coding-agent'

import type { Sandbox } from 'e2b'

import { reconnectSandbox } from '@/data/e2b-client'
import { codingTools } from '@/data/coding-tools'
import { buildSystemPrompt } from '@/data/coding-prompts'
import { executeCodingTool } from '@/data/coding-tool-executor'
import { AIClient, LLM_CONFIG, type CompletedToolCall } from '@/config/llm'
import { LSP_BRIDGE_SCRIPT, LSP_BRIDGE_PATH, LSP_BRIDGE_PORT } from '@/data/lsp-bridge-script'
import { getTemplate } from '@/config/e2bTemplates'
import { r2PutMeta } from '@/data/r2-client'

// --- NDJSON stream helpers ---

function createNdjsonStream() {
  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  const encoder = new TextEncoder()

  const emit = (event: Record<string, unknown>) =>
    writer.write(encoder.encode(JSON.stringify(event) + '\n'))

  const close = () => writer.close()

  return { readable, emit, close }
}

// --- LSP bridge lifecycle ---

const JS_TEMPLATES = new Set([
  'vite', 'nextjs', 'tanstack', 'remix', 'nuxt', 'svelte', 'astro',
  'express', 'hono', 'vite-express', 'nextjs-express',
  'vite-convex', 'nextjs-convex', 'tanstack-convex', 'node-base',
])

async function startLspBridge(sandbox: Sandbox, templateName?: string): Promise<number | null> {
  if (templateName && !JS_TEMPLATES.has(templateName)) return null

  try {
    await sandbox.files.write(LSP_BRIDGE_PATH, LSP_BRIDGE_SCRIPT)

    // Install typescript-language-server if not present
    await sandbox.commands.run(
      'which typescript-language-server >/dev/null 2>&1 || npm install -g typescript-language-server typescript 2>/dev/null',
      { timeoutMs: 30_000 },
    )

    // Start bridge as background process
    await sandbox.commands.run(
      `node ${LSP_BRIDGE_PATH} > /tmp/lsp-bridge.log 2>&1 &`,
      { timeoutMs: 5_000 },
    )

    // Poll until healthy
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 500))
      const check = await sandbox.commands.run(
        `curl -s http://localhost:${LSP_BRIDGE_PORT}/health 2>/dev/null`,
      )
      if (check.exitCode === 0 && check.stdout.includes('"ok"')) {
        return LSP_BRIDGE_PORT
      }
    }
    console.warn('[lsp-bridge] Failed to start within timeout')
    return null
  } catch (err) {
    console.warn('[lsp-bridge] Error starting:', err)
    return null
  }
}

// --- Main server function ---

export const codingAgentChat = createServerFn({ method: 'POST' })
  .inputValidator((data: CodingAgentInput) => data)
  .handler(({ data }) => {
    const ai = new AIClient({ model: data.agentModel })
    ai.logSettings(`coding:${data.persona}`)

    const { readable, emit, close } = createNdjsonStream()

    // Run agentic loop in background
    ;(async () => {
      try {
        // 1. Connect to sandbox
        const { sandbox } = await reconnectSandbox(data.sandboxId)
        await emit({ type: 'sandbox_status', status: 'ready', sandboxId: data.sandboxId })

        // 2. Start LSP bridge for diagnostics
        const lspPort = await startLspBridge(sandbox, data.templateName)
        if (lspPort) console.log(`[coding:${data.persona}] LSP bridge started on port ${lspPort}`)

        const template = getTemplate(data.templateName || 'vite')
        const workdir = template?.workdir || '/home/user/app'

        const toolContext: CodingToolContext = {
          backgroundProcesses: new Map<string, BackgroundProcess>(),
          write: emit,
          lspPort,
          projectId: data.projectId,
          workdir: workdir.endsWith('/') ? workdir : workdir + '/',
        }

        await emit({ type: 'agent_start', persona: data.persona })

        // 2. Build messages
        const systemPrompt = buildSystemPrompt(data.persona, data.templateName || 'unknown', data.agentModel)
        const messages: Array<OpenAI.ChatCompletionMessageParam> = [
          {
            role: 'system',
            content: systemPrompt,
          },
          ...data.messages.map((m) => ({ role: m.role, content: m.content }) as OpenAI.ChatCompletionMessageParam),
        ]

        // 3. Agentic loop
        const log = (msg: string, detail?: Record<string, unknown>) =>
          console.log(`[coding:${data.persona}] ${msg}`, detail ? JSON.stringify(detail) : '')

        let exitReason = 'max_rounds'

        for (let round = 0; round < LLM_CONFIG.maxToolRounds; round++) {
          let text = ''
          let completedCalls: CompletedToolCall[] = []
          let finishReason = ''
          let reasoningContent = ''
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let reasoningDetails: Record<string, any>[] | undefined

          for await (const event of ai.streamChat(messages, codingTools)) {
            switch (event.type) {
              case 'reasoning':
                reasoningContent += event.content
                await emit({ type: 'reasoning', content: event.content })
                break
              case 'content':
                text += event.content
                await emit({ type: 'text_delta', content: event.content })
                break
              case 'tool_start':
                await emit({ type: 'tool_start', tool: event.name, args: {} })
                break
              case 'tool_complete':
                completedCalls = event.toolCalls
                finishReason = event.finishReason
                if (event.reasoningDetails) reasoningDetails = event.reasoningDetails
                break
              case 'done':
                finishReason = event.finishReason
                if (event.reasoningDetails) reasoningDetails = event.reasoningDetails
                break
              case 'error':
                throw new Error(event.error)
            }
          }

          // No tool calls — check if we should continue or exit
          if (completedCalls.length === 0) {
            const pending = hasPendingTasks(text)
            if (finishReason === 'length' || pending) {
              log(`round ${round}: continuing (text only)`, { finishReason, hasPendingTasks: pending, textLen: text.length })
              messages.push({ role: 'assistant', content: text || '' })
              messages.push({ role: 'user', content: LLM_CONFIG.continuationPrompt })
              continue
            }
            exitReason = `no_tool_calls:${finishReason}`
            log(`round ${round}: EXIT — no tool calls`, { finishReason, textLen: text.length, textPreview: text.slice(-200) })
            break
          }

          log(`round ${round}: executing ${completedCalls.length} tool(s)`, {
            finishReason,
            tools: completedCalls.map((tc) => tc.name),
          })

          // Push assistant message with original args.
          // Include reasoning fields for models that require them (Kimi K2.5, etc.)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const assistantMsg: Record<string, any> = {
            role: 'assistant',
            content: text || null,
            tool_calls: completedCalls.map((tc) => ({
              id: tc.id,
              type: 'function' as const,
              function: { name: tc.name, arguments: tc.args },
            })),
          }
          if (reasoningDetails?.length) {
            assistantMsg.reasoning_details = reasoningDetails
          }
          if (reasoningContent) {
            assistantMsg.reasoning_content = reasoningContent
          }
          messages.push(assistantMsg as OpenAI.ChatCompletionMessageParam)

          // Execute all tool calls in parallel for speed (E2B has ~200ms latency per call)
          const toolResults = await Promise.all(
            completedCalls.map(async (tc) => {
              const args = safeParseJson(tc.args)
              const result = await executeCodingTool(sandbox, tc.name, args, toolContext)
              return { tc, args, result }
            }),
          )

          for (const { tc, args, result } of toolResults) {
            await emit({ type: 'tool_call', tool: tc.name, args: stripLargeArgs(args) })

            if (result.expired) {
              log(`round ${round}: EXIT — sandbox expired`)
              await emit({ type: 'error', message: 'Sandbox expired.' })
              return
            }

            if (!result.success) {
              log(`round ${round}: tool error`, { tool: tc.name, error: result.error })
            }

            const toolContent = result.success
              ? (typeof result.result === 'string' ? result.result : JSON.stringify(result.result))
              : JSON.stringify({ success: false, error: result.error })

            messages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: toolContent,
            })
          }
        }

        log(`DONE — exitReason=${exitReason}, totalMessages=${messages.length}`)

        // Save R2 metadata (fire-and-forget)
        r2PutMeta(data.projectId, {
          templateName: data.templateName || 'vite',
          lastSync: Date.now(),
        }).catch(() => {})

        await emit({ type: 'agent_done', persona: data.persona })
        await emit({ type: 'done' })
      } catch (err) {
        console.error(`[coding:${data.persona}] ERROR:`, err instanceof Error ? err.message : err)
        await emit({ type: 'error', message: err instanceof Error ? err.message : 'Agent error' })
      } finally {
        await close()
      }
    })()

    return new Response(readable, {
      headers: { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-cache' },
    })
  })

// --- Utils ---

function safeParseJson(str: string): Record<string, unknown> {
  try {
    return JSON.parse(str)
  } catch {
    return {}
  }
}

const LARGE_ARG_KEYS = new Set(['content', 'projectSpec', 'markdown', 'old_string', 'new_string', 'edits'])

/** Strip large args for UI display only. */
function stripLargeArgs(args: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(args)) {
    if (LARGE_ARG_KEYS.has(k)) {
      if (typeof v === 'string') out[k] = `[${v.length} chars]`
      else if (Array.isArray(v)) out[k] = `[${v.length} items]`
      continue
    }
    if (k === 'path' && typeof v === 'string') {
      out[k] = v.replace(/^\/home\/user\/app\//, '')
    } else {
      out[k] = v
    }
  }
  return out
}

/**
 * Check if text contains pending tasks ([ ] items).
 * When the model prints a task list with unchecked items and stops,
 * we should continue instead of breaking out of the loop.
 */
function hasPendingTasks(text: string): boolean {
  return /\[ \]/.test(text) && /\[→\]|\[x\]/i.test(text)
}

