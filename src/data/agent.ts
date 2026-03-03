import { createServerFn } from '@tanstack/react-start'
import type OpenAI from 'openai'

import type {
  AgentAction,
  AgentChatInput,
  AvailableModel,
  CanvasNode,
  CreatePdfAction,
} from '@/types/agent'
import type { PortType } from '@/types/nodes'
import type { VirtualState } from '@/data/agent-config'

import {
  STATIC_SYSTEM_PROMPT,
  formatCanvasStateResponse,
  formatModelsResponse,
  initVirtualState,
  tools,
} from '@/data/agent-config'
import { groqWeb } from '@/data/groq'
import { deepResearch } from '@/data/research'
import { createSandbox, reconnectSandbox, getPreviewUrl } from '@/data/e2b-client'
import { getTemplate, isConvexTemplate } from '@/config/e2bTemplates'
import { codingAgentChat } from '@/data/coding-agent'
import { AIClient, LLM_CONFIG, type CompletedToolCall } from '@/config/llm'

// --- Tool execution ---

type ToolCallResult = {
  result: string
  action: AgentAction | null
  sources: Array<{ title: string; url: string }> | null
}

type ToolContext = {
  ai: AIClient
  write: (event: Record<string, unknown>) => Promise<void>
  projectId: string
}

async function executeToolCall(
  state: VirtualState,
  models: Array<AvailableModel>,
  name: string,
  args: Record<string, unknown>,
  context: ToolContext,
): Promise<ToolCallResult> {
  switch (name) {
    case 'get_canvas_state': {
      return {
        result: formatCanvasStateResponse(state),
        action: null,
        sources: null,
      }
    }

    case 'get_available_models': {
      return {
        result: formatModelsResponse(
          models,
          args.contentType as string | undefined,
        ),
        action: null,
        sources: null,
      }
    }

    case 'add_node': {
      const contentType = (args.contentType as string) || 'image'
      if (contentType === 'website' && state.hasWebsiteNode) {
        return {
          result: JSON.stringify({ error: 'A website node already exists. You can only create ONE website node per project.' }),
          action: null,
          sources: null,
        }
      }
      const nodeId = `node-${state.nextNodeId++}`
      const lastNode = state.nodes.at(-1)
      const x =
        (args.x as number | undefined) ?? (lastNode ? lastNode.x + 300 : 100)
      const y = (args.y as number | undefined) ?? (lastNode ? lastNode.y : 100)

      const node: CanvasNode = {
        id: nodeId,
        contentType: contentType as CanvasNode['contentType'],
        label: (args.label as string) || `New ${contentType} block`,
        prompt: (args.prompt as string) || '',
        model: (args.model as string) || '',
        generationStatus: 'idle',
        x,
        y,
      }
      state.nodes.push(node)
      if (contentType === 'website') state.hasWebsiteNode = true

      const previewUrl = args.previewUrl as string | undefined
      const sandboxId = args.sandboxId as string | undefined

      const action: AgentAction = {
        type: 'add_node',
        nodeId,
        contentType: node.contentType,
        prompt: node.prompt || undefined,
        model: node.model || undefined,
        label: node.label,
        x,
        y,
        ...(previewUrl && { previewUrl }),
        ...(sandboxId && { sandboxId }),
      }
      return {
        result: JSON.stringify({ nodeId, success: true }),
        action,
        sources: null,
      }
    }

    case 'connect_nodes': {
      const sourceId = args.sourceNodeId as string
      const targetId = args.targetNodeId as string
      const portType = args.portType as string

      const source = state.nodes.find((n) => n.id === sourceId)
      const target = state.nodes.find((n) => n.id === targetId)

      if (!source)
        return {
          result: JSON.stringify({
            error: `Source node ${sourceId} not found`,
          }),
          action: null,
          sources: null,
        }
      if (!target)
        return {
          result: JSON.stringify({
            error: `Target node ${targetId} not found`,
          }),
          action: null,
          sources: null,
        }

      const edgeId = `edge-agent-${state.nextEdgeId++}`
      state.edges.push({
        id: edgeId,
        source: sourceId,
        target: targetId,
        sourceHandle: `output-${portType}`,
        targetHandle: `input-${portType}`,
      })

      const action: AgentAction = {
        type: 'connect_nodes',
        edgeId,
        sourceNodeId: sourceId,
        targetNodeId: targetId,
        portType: portType as PortType,
      }
      return {
        result: JSON.stringify({ edgeId, success: true }),
        action,
        sources: null,
      }
    }

    case 'update_node': {
      const nodeId = args.nodeId as string
      const node = state.nodes.find((n) => n.id === nodeId)
      if (!node)
        return {
          result: JSON.stringify({ error: `Node ${nodeId} not found` }),
          action: null,
          sources: null,
        }

      if (args.prompt !== undefined) node.prompt = args.prompt as string
      if (args.model !== undefined) node.model = args.model as string
      if (args.label !== undefined) node.label = args.label as string

      const action: AgentAction = {
        type: 'update_node',
        nodeId,
        prompt: args.prompt as string | undefined,
        model: args.model as string | undefined,
        label: args.label as string | undefined,
      }
      return {
        result: JSON.stringify({ success: true }),
        action,
        sources: null,
      }
    }

    case 'delete_nodes': {
      const nodeIds = args.nodeIds as Array<string>
      const idSet = new Set(nodeIds)
      const before = state.nodes.length
      state.nodes = state.nodes.filter((n) => !idSet.has(n.id))
      state.edges = state.edges.filter(
        (e) => !idSet.has(e.source) && !idSet.has(e.target),
      )
      const action: AgentAction = { type: 'delete_nodes', nodeIds }
      return {
        result: JSON.stringify({
          deletedCount: before - state.nodes.length,
        }),
        action,
        sources: null,
      }
    }

    case 'clear_canvas': {
      state.nodes = []
      state.edges = []
      state.nextNodeId = 1
      state.nextEdgeId = 1
      const action: AgentAction = { type: 'clear_canvas' }
      return {
        result: JSON.stringify({ success: true }),
        action,
        sources: null,
      }
    }

    case 'web_search': {
      const query = ((args.query as string) || '').trim()
      if (!query) {
        return {
          result: JSON.stringify({ error: 'Search query is required' }),
          action: null,
          sources: null,
        }
      }
      try {
        const { content, sources } = await groqWeb(query)
        let resultText = content
        if (sources.length > 0) {
          const sourceList = sources
            .map((s) => `- [${s.title}](${s.url})`)
            .join('\n')
          resultText += `\n\nSources:\n${sourceList}`
        }
        return {
          result: resultText,
          action: null,
          sources: sources.length > 0 ? sources : null,
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Web search failed'
        return {
          result: JSON.stringify({ error: msg }),
          action: null,
          sources: null,
        }
      }
    }

    case 'deep_research': {
      const topic = ((args.topic as string) || '').trim()
      if (!topic) {
        return {
          result: JSON.stringify({ error: 'Topic is required' }),
          action: null,
          sources: null,
        }
      }

      try {
        const research = await deepResearch(
          topic,
          context.ai,
          async (phase, detail) => {
            await context.write({
              type: 'tool_status',
              tool: 'deep_research',
              status: detail ? `${phase} ${detail}` : phase,
            })
          },
        )

        const nodeId = `node-${state.nextNodeId++}`
        const lastNode = state.nodes.at(-1)
        const x =
          (args.x as number | undefined) ??
          (lastNode ? lastNode.x + 300 : 100)
        const y =
          (args.y as number | undefined) ?? (lastNode ? lastNode.y : 100)

        const node: CanvasNode = {
          id: nodeId,
          contentType: 'note',
          label: research.title,
          prompt: research.markdown,
          model: '',
          generationStatus: 'idle',
          x,
          y,
        }
        state.nodes.push(node)

        const addAction: AgentAction = {
          type: 'add_node',
          nodeId,
          contentType: 'note',
          prompt: research.markdown,
          label: research.title,
          x,
          y,
        }

        return {
          result: JSON.stringify({
            success: true,
            noteNodeId: nodeId,
            title: research.title,
            summary: research.summary,
            sourceCount: research.sources.length,
            markdown: research.markdown,
          }),
          action: addAction,
          sources: research.sources.length > 0 ? research.sources : null,
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Research failed'
        return {
          result: JSON.stringify({ error: msg }),
          action: null,
          sources: null,
        }
      }
    }

    case 'create_pdf': {
      const title = (args.title as string) || 'Document'
      const markdown = (args.markdown as string) || ''
      const sources = Array.isArray(args.sources)
        ? (args.sources as Array<{ title: string; url: string }>)
        : []

      if (!markdown.trim()) {
        return {
          result: JSON.stringify({ error: 'Markdown content is required' }),
          action: null,
          sources: null,
        }
      }

      const lastNode = state.nodes.at(-1)
      const x =
        (args.x as number | undefined) ??
        (lastNode ? lastNode.x + 300 : 100)
      const y =
        (args.y as number | undefined) ?? (lastNode ? lastNode.y : 100)

      const action: CreatePdfAction = {
        type: 'create_pdf',
        title,
        markdown,
        sources,
        x,
        y,
      }

      return {
        result: JSON.stringify({
          success: true,
          message: 'PDF creation initiated on client',
        }),
        action,
        sources: null,
      }
    }

    case 'create_sandbox': {
      if (state.sandboxId) {
        return {
          result: JSON.stringify({ error: `Sandbox already exists (${state.sandboxId}). You can only create ONE sandbox per project. Use the existing sandboxId.` }),
          action: null,
          sources: null,
        }
      }
      const templateName = (args.templateName as string) || 'vite'

      // Pre-check: if Convex template but credentials are missing, suggest fallback immediately
      if (isConvexTemplate(templateName) && (!process.env.CONVEX_TEAM_ID || !process.env.CONVEX_TEAM_TOKEN)) {
        const fallback = templateName.replace('-convex', '-express')
        return {
          result: JSON.stringify({
            error: `Convex templates are unavailable (CONVEX_TEAM_ID/CONVEX_TEAM_TOKEN not configured). Call create_sandbox again with templateName="${fallback}" instead. Do NOT change anything else in your plan.`,
          }),
          action: null,
          sources: null,
        }
      }

      try {
        const { sandbox, info } = await createSandbox(templateName)
        const template = getTemplate(templateName)
        const previewUrl = getPreviewUrl(sandbox, template?.defaultPort || 3000)
        state.sandboxId = info.sandboxId
        state.templateName = info.templateName
        await context.write({
          type: 'tool_status',
          tool: 'create_sandbox',
          status: `Sandbox ready: ${info.sandboxId}`,
        })
        return {
          result: JSON.stringify({
            success: true,
            sandboxId: info.sandboxId,
            templateName: info.templateName,
            previewUrl,
          }),
          action: null,
          sources: null,
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to create sandbox'
        return {
          result: JSON.stringify({ error: msg }),
          action: null,
          sources: null,
        }
      }
    }

    case 'create_project_spec': {
      const sandboxId = args.sandboxId as string
      const name = args.name as string
      const overview = args.overview as string
      const features = args.features as Array<{ title: string; user_story?: string; acceptance_criteria?: string[] }> | undefined
      if (!sandboxId || !name || !overview) {
        return {
          result: JSON.stringify({ error: 'sandboxId, name, and overview are required' }),
          action: null,
          sources: null,
        }
      }
      try {
        const projectSpec = generateProjectSpec(args)
        await context.write({
          type: 'tool_status',
          tool: 'create_project_spec',
          status: `Writing spec for "${name}"`,
        })
        const { sandbox } = await reconnectSandbox(sandboxId)
        await sandbox.files.write('/home/user/app/project.md', projectSpec)
        return {
          result: JSON.stringify({ success: true, path: '/home/user/app/project.md', name, featuresCount: features?.length ?? 0 }),
          action: null,
          sources: null,
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to write project spec'
        return {
          result: JSON.stringify({ error: msg }),
          action: null,
          sources: null,
        }
      }
    }

    case 'run_coding_agent': {
      const sandboxId = args.sandboxId as string
      const persona = args.persona as string
      const userMessage = args.userMessage as string
      if (!sandboxId || !persona || !userMessage) {
        return {
          result: JSON.stringify({ error: 'sandboxId, persona, and userMessage are required' }),
          action: null,
          sources: null,
        }
      }
      try {
        console.log(`[orchestrator] run_coding_agent: persona=${persona}, sandboxId=${sandboxId}, msgLen=${userMessage.length}`)

        const response = await codingAgentChat({
          data: {
            messages: [{ role: 'user', content: userMessage }],
            sandboxId,
            projectId: context.projectId,
            persona: persona as 'frontend' | 'backend' | 'tester',
            agentModel: context.ai.model,
            templateName: state.templateName ?? undefined,
          },
        })

        // Forward sub-agent events directly — same channel, same event types
        let agentOutput = ''
        let toolCallCount = 0
        let lastError: string | null = null
        if (response instanceof Response && response.body) {
          const reader = response.body.getReader()
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            const chunk = new TextDecoder().decode(value)
            for (const line of chunk.split('\n')) {
              if (!line.trim()) continue
              try {
                const event = JSON.parse(line)
                switch (event.type) {
                  case 'text_delta':
                    agentOutput += event.content
                    await context.write({ type: 'text_delta', content: event.content })
                    break
                  case 'reasoning':
                    await context.write({ type: 'reasoning', content: event.content })
                    break
                  case 'tool_start':
                    await context.write({ type: 'tool_start', tool: event.tool, args: event.args || {} })
                    break
                  case 'tool_call':
                    toolCallCount++
                    await context.write({ type: 'tool_call', tool: event.tool, args: event.args || {} })
                    break
                  case 'tool_status':
                    await context.write({ type: 'tool_status', tool: event.tool || 'shell', status: event.status })
                    break
                  case 'error':
                    lastError = event.message
                    console.error(`[orchestrator] sub-agent error: ${event.message}`)
                    break
                }
              } catch {
                // skip malformed lines
              }
            }
          }
        }

        console.log(`[orchestrator] sub-agent finished: toolCalls=${toolCallCount}, outputLen=${agentOutput.length}, error=${lastError}`)

        // If sandbox is dead, tell the LLM clearly so it stops retrying
        if (lastError && /sandbox.*(expired|not found|not running)/i.test(lastError)) {
          return {
            result: JSON.stringify({
              error: `SANDBOX_DEAD: ${lastError}. The sandbox has been permanently destroyed. Do NOT call run_coding_agent again — it will fail. Summarize what was accomplished and tell the user.`,
            }),
            action: null,
            sources: null,
          }
        }

        return {
          result: agentOutput || JSON.stringify({ success: true, persona }),
          action: null,
          sources: null,
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Coding agent failed'
        console.error(`[orchestrator] run_coding_agent THREW:`, msg)
        return {
          result: JSON.stringify({
            error: /sandbox.*(expired|not found|not running)/i.test(msg)
              ? `SANDBOX_DEAD: ${msg}. Do NOT retry — the sandbox is permanently gone.`
              : msg,
          }),
          action: null,
          sources: null,
        }
      }
    }

    default:
      return {
        result: JSON.stringify({ error: `Unknown tool: ${name}` }),
        action: null,
        sources: null,
      }
  }
}

// --- Streaming server function ---

export const agentChat = createServerFn({
  method: 'POST',
})
  .inputValidator((data: AgentChatInput) => data)
  .handler(({ data }) => {
    const ai = new AIClient({ model: data.agentModel })
    ai.logSettings('orchestrator')

    const virtualState = initVirtualState(
      data.canvasState.nodes,
      data.canvasState.edges,
    )

    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()
    const encoder = new TextEncoder()

    const write = (event: Record<string, unknown>) => {
      return writer.write(encoder.encode(JSON.stringify(event) + '\n'))
    }

    // Run agentic loop in background
    ;(async () => {
      try {
        const messages: Array<OpenAI.ChatCompletionMessageParam> = [
          {
            role: 'system',
            content: STATIC_SYSTEM_PROMPT,
          },
          ...data.messages.map(
            (m) =>
              ({
                role: m.role,
                content: m.content,
              }) as OpenAI.ChatCompletionMessageParam,
          ),
        ]

        for (let round = 0; round < LLM_CONFIG.maxToolRounds; round++) {
          let content = ''
          let completedCalls: CompletedToolCall[] = []
          let finishReason = ''
          let reasoningContent = ''
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let reasoningDetails: Record<string, any>[] | undefined

          for await (const event of ai.streamChat(messages, tools)) {
            switch (event.type) {
              case 'reasoning':
                // Stream reasoning to frontend immediately (progressive display)
                reasoningContent += event.content
                await write({ type: 'reasoning', content: event.content })
                break
              case 'content':
                content += event.content
                await write({ type: 'text_delta', content: event.content })
                break
              case 'tool_start':
                // Forward immediately — frontend shows pending spinner
                if (event.name !== 'run_coding_agent') {
                  await write({ type: 'tool_start', tool: event.name, args: {} })
                }
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

          // Drop truncated tool call when cut off by max_tokens
          if (finishReason === 'length' && completedCalls.length > 0) {
            const last = completedCalls[completedCalls.length - 1]
            try { JSON.parse(last.args) } catch { completedCalls.pop() }
          }

          // No (valid) tool calls — continue if truncated, otherwise done
          if (completedCalls.length === 0) {
            if (finishReason === 'length') {
              messages.push({ role: 'assistant', content: content || '' })
              messages.push({ role: 'user', content: LLM_CONFIG.continuationPrompt })
              continue
            }
            await write({ type: 'done' })
            break
          }

          // Push assistant message with summarized tool call args to save context.
          // Include reasoning fields for models that require them (Kimi K2.5, DeepSeek R1, etc.)
          // OpenRouter docs: use reasoning_details (array) or reasoning/reasoning_content (string).
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const assistantMsg: Record<string, any> = {
            role: 'assistant',
            content: content || null,
            tool_calls: completedCalls.map((tc) => ({
              id: tc.id,
              type: 'function' as const,
              function: { name: tc.name, arguments: summarizeOrchestratorArgs(tc.name, tc.args) },
            })),
          }
          if (reasoningDetails?.length) {
            assistantMsg.reasoning_details = reasoningDetails
          }
          if (reasoningContent) {
            assistantMsg.reasoning_content = reasoningContent
          }
          messages.push(assistantMsg as OpenAI.ChatCompletionMessageParam)

          // Execute each tool
          for (const tc of completedCalls) {
            let args: Record<string, unknown> = {}
            try { args = JSON.parse(tc.args) } catch { /* malformed */ }

            const { result, action, sources } = await executeToolCall(
              virtualState,
              data.models,
              tc.name,
              args,
              { ai, write, projectId: data.projectId },
            )

            // Emit tool_call done with display-safe args + error flag
            if (tc.name !== 'run_coding_agent') {
              const isError = result.startsWith('{"error"')
              await write({ type: 'tool_call', tool: tc.name, args: stripLargeArgs(args), ...(isError && { error: true }) })
            }

            if (action) await write({ type: 'action', action })
            if (sources) await write({ type: 'resources', sources })

            messages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: result,
            })
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Agent error'
        await write({ type: 'error', message: msg })
      } finally {
        await writer.close()
      }
    })()

    return new Response(readable, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache',
      },
    })
  })

// Strip large fields from args before sending to the frontend.
// The UI only needs keys like path, command, query — not file contents or specs.
const LARGE_ARG_KEYS = new Set(['content', 'markdown', 'old_string', 'new_string', 'edits', 'features', 'data_models', 'acceptance_criteria'])

function stripLargeArgs(args: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(args)) {
    if (LARGE_ARG_KEYS.has(k)) continue
    if (k === 'path' && typeof v === 'string') {
      out[k] = v.replace(/^\/home\/user\/app\//, '')
    } else {
      out[k] = v
    }
  }
  return out
}

/**
 * Summarize tool call args stored in message history to prevent context bloat.
 * The orchestrator's big payloads are projectSpec and userMessage in run_coding_agent.
 */
function summarizeOrchestratorArgs(toolName: string, argsJson: string): string {
  // create_project_spec args are already structured (no giant string blob), keep as-is
  if (toolName === 'run_coding_agent') {
    try {
      const args = JSON.parse(argsJson)
      const msgLen = typeof args.userMessage === 'string' ? args.userMessage.length : 0
      return JSON.stringify({ sandboxId: args.sandboxId, persona: args.persona, userMessage: `[instructions: ${Math.round(msgLen / 1024)}KB]` })
    } catch { /* fall through */ }
  }
  if (toolName === 'deep_research' || toolName === 'create_pdf') {
    try {
      const args = JSON.parse(argsJson)
      if (args.markdown && typeof args.markdown === 'string') {
        return JSON.stringify({ ...args, markdown: `[${args.markdown.length} chars]` })
      }
    } catch { /* fall through */ }
  }
  return argsJson
}

// --- Project spec template generator ---

function generateProjectSpec(args: Record<string, unknown>): string {
  const tech = (args.tech_stack as Record<string, string>) ?? {}
  const design = (args.design_system as Record<string, unknown>) ?? {}
  const colors = (design.colors as Record<string, string>) ?? {}
  const typography = (design.typography as Record<string, string>) ?? {}
  const features = (args.features as Array<Record<string, unknown>>) ?? []
  const dataModels = (args.data_models as Array<Record<string, unknown>>) ?? []
  const apiOps = (args.api_operations as string[]) ?? []

  const featuresText = features.length > 0
    ? features.map((f, i) => {
        const title = (f.title as string) || `Feature ${i + 1}`
        const story = f.user_story ? `**User Story**: ${f.user_story}` : ''
        const criteria = Array.isArray(f.acceptance_criteria)
          ? `**Acceptance Criteria**:\n${(f.acceptance_criteria as string[]).map((c) => `- [ ] ${c}`).join('\n')}`
          : ''
        return `### ${i + 1}. ${title}\n${story}\n${criteria}`
      }).join('\n\n')
    : 'No features specified.'

  const modelsText = dataModels.length > 0
    ? dataModels.map((m) => {
        const name = (m.name as string) || 'Unknown'
        const fields = Array.isArray(m.fields) ? (m.fields as string[]).map((f) => `  ${f}`).join('\n') : ''
        const rels = m.relationships ? `*Relationships*: ${m.relationships}` : ''
        return `### ${name}\n\`\`\`\n${fields}\n\`\`\`\n${rels}`
      }).join('\n\n')
    : 'No data models specified.'

  const opsText = apiOps.length > 0
    ? apiOps.map((op) => `- ${op}`).join('\n')
    : 'No API operations specified (frontend only).'

  return `# Project: ${args.name || 'Untitled'}

## Overview
${args.overview || 'No description provided.'}

## Tech Stack
- **Frontend**: ${tech.frontend || 'React + TypeScript'}
- **Backend**: ${tech.backend || 'None'}
- **Database**: ${tech.database || 'None'}
- **Auth**: ${tech.auth || 'None'}
- **Styling**: ${tech.styling || 'Tailwind CSS'}

---

## Features

${featuresText}

---

## Data Models

${modelsText}

---

## API Operations

${opsText}

---

## Design System

### Colors
- **Primary**: ${colors.primary || '#3B82F6'}
- **Secondary**: ${colors.secondary || '#10B981'}
- **Background**: ${colors.background || '#0F172A'}
- **Text**: ${colors.text || '#F8FAFC'}
- **Accent**: ${colors.accent || '#F59E0B'}

### Typography
- **Headings**: ${typography.headings || 'Inter, bold'}
- **Body**: ${typography.body || 'Inter, regular'}

### Style Guidelines
- **Theme**: ${design.theme || 'Modern dark mode'}
- **Border Radius**: ${design.border_radius || 'rounded-lg (8px)'}
- **Animations**: ${design.animations || 'Subtle micro-animations'}

---

## Implementation Status

> This section is updated by agents as they complete work.

### Backend
- **Status**: pending

### Frontend
- **Status**: pending

### Tests
- **Status**: pending
`
}
