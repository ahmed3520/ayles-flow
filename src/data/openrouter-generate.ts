import { createServerFn } from '@tanstack/react-start'

import { AIClient } from '@/config/llm'

type SubmitInput = {
  model: string
  prompt: string
}

/**
 * Streaming text generation via OpenRouter.
 * Returns an NDJSON stream:
 *   { type: "text_delta", content: "..." }
 *   { type: "done", text: "full text" }
 *   { type: "error", message: "..." }
 */
export const submitToOpenRouter = createServerFn({
  method: 'POST',
})
  .inputValidator((data: SubmitInput) => data)
  .handler(({ data }) => {
    if (!data.prompt.trim()) {
      throw new Error('Prompt cannot be empty')
    }

    const ai = new AIClient({ model: data.model, maxTokens: 4096 })

    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()
    const encoder = new TextEncoder()

    const write = (event: Record<string, unknown>) => {
      return writer.write(encoder.encode(JSON.stringify(event) + '\n'))
    }

    ;(async () => {
      try {
        let fullText = ''

        for await (const event of ai.streamChat([{ role: 'user', content: data.prompt }])) {
          switch (event.type) {
            case 'content':
              fullText += event.content
              await write({ type: 'text_delta', content: event.content })
              break
            case 'done':
              await write({ type: 'done', text: fullText })
              break
            case 'error':
              await write({ type: 'error', message: event.error })
              break
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Text generation failed'
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
