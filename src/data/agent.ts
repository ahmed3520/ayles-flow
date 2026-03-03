import { createServerFn } from '@tanstack/react-start'

import type { AgentChatInput } from '@/types/agent'
import { LLM_SERVER_URL } from '@/config/llm'

/**
 * Orchestrator agent — thin proxy to the Python server which handles:
 * - Canvas state management (virtual nodes/edges)
 * - Web search & deep research (via Groq)
 * - E2B sandbox creation & management
 * - Coding sub-agent dispatch
 * - LLM agentic loop with tool calling
 *
 * Returns an NDJSON streaming response.
 */
export const agentChat = createServerFn({
  method: 'POST',
})
  .inputValidator((data: AgentChatInput) => data)
  .handler(async ({ data }) => {
    const response = await fetch(`${LLM_SERVER_URL}/v1/agent/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: data.messages,
        canvasState: data.canvasState,
        models: data.models,
        agentModel: data.agentModel,
        projectId: data.projectId,
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Agent error ${response.status}: ${text}`)
    }

    // Forward the NDJSON stream directly
    return new Response(response.body, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache',
      },
    })
  })
