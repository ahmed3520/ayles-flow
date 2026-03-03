import { createServerFn } from '@tanstack/react-start'

import type { CodingAgentInput } from '@/types/coding-agent'
import { LLM_SERVER_URL } from '@/config/llm'

/**
 * Coding agent — proxies to the Python server which handles:
 * - E2B sandbox connection
 * - Agentic tool loop (file ops, shell, grep, etc.)
 * - R2 sync on file changes
 * - LSP diagnostics
 *
 * Returns an NDJSON streaming response.
 */
export const codingAgentChat = createServerFn({ method: 'POST' })
  .inputValidator((data: CodingAgentInput) => data)
  .handler(async ({ data }) => {
    const response = await fetch(`${LLM_SERVER_URL}/v1/coding/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: data.messages,
        sandbox_id: data.sandboxId,
        project_id: data.projectId,
        persona: data.persona,
        agent_model: data.agentModel,
        template_name: data.templateName,
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Coding agent error ${response.status}: ${text}`)
    }

    // Forward the NDJSON stream directly
    return new Response(response.body, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache',
      },
    })
  })
