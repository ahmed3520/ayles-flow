'use node'

import { v } from 'convex/values'

import { internal } from './_generated/api'
import { action } from './_generated/server'

function normalizeOpenRouterText(content: unknown) {
  if (typeof content === 'string') {
    return content.replace(/\r\n?/g, '\n').trim()
  }

  if (Array.isArray(content)) {
    return content
      .flatMap((part) => {
        if (typeof part === 'string') return [part]
        if (
          part &&
          typeof part === 'object' &&
          'text' in part &&
          typeof part.text === 'string'
        ) {
          return [part.text]
        }
        return []
      })
      .join('')
      .replace(/\r\n?/g, '\n')
      .trim()
  }

  return ''
}

export const submit = action({
  args: {
    generationId: v.id('generations'),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not authenticated')

    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured')

    const generation = await ctx.runQuery(internal.generations.getInternal, {
      id: args.generationId,
    })
    if (!generation) throw new Error('Generation not found')

    try {
      const response = await fetch(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: generation.modelId,
            messages: [{ role: 'user', content: generation.prompt }],
            max_tokens: 4096,
          }),
        },
      )

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(`OpenRouter error ${response.status}: ${errText}`)
      }

      const result = await response.json()
      const text = normalizeOpenRouterText(
        result.choices?.[0]?.message?.content,
      )
      const inputTokens = result.usage?.prompt_tokens ?? 0
      const outputTokens = result.usage?.completion_tokens ?? 0

      await ctx.runMutation(internal.generations.completeTextGeneration, {
        generationId: args.generationId,
        resultText: text,
        inputTokens,
        outputTokens,
      })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Text generation failed'
      await ctx.runMutation(internal.generations.failTextGeneration, {
        generationId: args.generationId,
        errorMessage: message,
      })
    }
  },
})
