import { createServerFn } from '@tanstack/react-start'
import OpenAI from 'openai'

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

// --- Tool execution ---

type ToolCallResult = {
  result: string
  action: AgentAction | null
  sources: Array<{ title: string; url: string }> | null
}

type ToolContext = {
  client: OpenAI
  model: string
  write: (event: Record<string, unknown>) => Promise<void>
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
      const nodeId = `node-${state.nextNodeId++}`
      const contentType = (args.contentType as string) || 'image'
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

      const action: AgentAction = {
        type: 'add_node',
        nodeId,
        contentType: node.contentType,
        prompt: node.prompt || undefined,
        model: node.model || undefined,
        label: node.label,
        x,
        y,
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
          context.client,
          context.model,
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

    default:
      return {
        result: JSON.stringify({ error: `Unknown tool: ${name}` }),
        action: null,
        sources: null,
      }
  }
}

// --- Streaming server function ---

const MAX_TOOL_ROUNDS = 10

export const agentChat = createServerFn({
  method: 'POST',
})
  .inputValidator((data: AgentChatInput) => data)
  .handler(({ data }) => {
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      throw new Error(
        'OPENROUTER_API_KEY environment variable is not configured',
      )
    }

    const model = data.agentModel || 'anthropic/claude-sonnet-4.5'
    const virtualState = initVirtualState(
      data.canvasState.nodes,
      data.canvasState.edges,
    )

    const client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey,
    })

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
            content: [
              {
                type: 'text' as const,
                text: STATIC_SYSTEM_PROMPT,
                cache_control: { type: 'ephemeral' },
              },
            ],
          } as any,
          ...data.messages.map(
            (m) =>
              ({
                role: m.role,
                content: m.content,
              }) as OpenAI.ChatCompletionMessageParam,
          ),
        ]

        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const stream = await client.chat.completions.create({
            model,
            messages,
            tools,
            stream: true,
          })

          let assistantContent = ''
          const toolCalls: Map<
            number,
            { id: string; name: string; args: string }
          > = new Map()

          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta

            if (delta.content) {
              assistantContent += delta.content
              await write({ type: 'text_delta', content: delta.content })
            }

            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index
                if (!toolCalls.has(idx)) {
                  toolCalls.set(idx, {
                    id: tc.id || '',
                    name: tc.function?.name || '',
                    args: '',
                  })
                }
                const entry = toolCalls.get(idx)!
                if (tc.id) entry.id = tc.id
                if (tc.function?.name) entry.name = tc.function.name
                if (tc.function?.arguments) entry.args += tc.function.arguments
              }
            }
          }

          if (toolCalls.size === 0) {
            await write({ type: 'done' })
            break
          }

          const assistantMessage: OpenAI.ChatCompletionMessageParam = {
            role: 'assistant',
            content: assistantContent || null,
            tool_calls: Array.from(toolCalls.values()).map((tc) => ({
              id: tc.id,
              type: 'function' as const,
              function: { name: tc.name, arguments: tc.args },
            })),
          }
          messages.push(assistantMessage)

          const toolLabels: Record<string, (a: Record<string, unknown>) => string> = {
            get_canvas_state: () => 'Inspected canvas',
            get_available_models: () => 'Loaded models',
            web_search: (a) => `Searched: ${(a.query as string) || ''}`,
            add_node: (a) => `Added ${(a.contentType as string) || 'node'}`,
            connect_nodes: (a) => `Connected ${a.sourceNodeId} → ${a.targetNodeId}`,
            update_node: (a) => `Updated ${a.nodeId}`,
            delete_nodes: (a) => `Deleted ${(a.nodeIds as Array<string>).length} node(s)`,
            clear_canvas: () => 'Cleared canvas',
            deep_research: (a) => `Researched: ${(a.topic as string) || ''}`,
            create_pdf: (a) => `Creating PDF: ${(a.title as string) || ''}`,
          }

          for (const tc of toolCalls.values()) {
            let args: Record<string, unknown> = {}
            try {
              args = JSON.parse(tc.args)
            } catch {
              // Malformed args from LLM
            }

            if (tc.name === 'web_search') {
              const query = (args.query as string) || ''
              await write({
                type: 'tool_status',
                tool: 'web_search',
                status: `Searching: ${query}`,
              })
            }
            if (tc.name === 'deep_research') {
              const topic = (args.topic as string) || ''
              await write({
                type: 'tool_status',
                tool: 'deep_research',
                status: `Researching: ${topic}`,
              })
            }

            const { result, action, sources } = await executeToolCall(
              virtualState,
              data.models,
              tc.name,
              args,
              { client, model, write },
            )

            const label = toolLabels[tc.name](args)
            await write({ type: 'tool_call', tool: tc.name, label })

            if (action) {
              await write({ type: 'action', action })
            }

            if (sources) {
              await write({ type: 'resources', sources })
            }

            messages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: result,
            })
          }

          assistantContent = ''
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
