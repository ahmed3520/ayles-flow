/**
 * AI Client — thin HTTP client to the Python LLM server.
 *
 * Same public interface as before (streamChat, chat) so all consumers
 * (agent.ts, coding-agent.ts, research.ts, openrouter-generate.ts, benchmark)
 * need zero changes. Caching is handled server-side in Python.
 */

import type OpenAI from 'openai'

// ─── Configuration ──────────────────────────────────────────────────

export const LLM_SERVER_URL = process.env.LLM_SERVER_URL
  || (process.env.NODE_ENV === 'production' ? 'https://lm.aylesflow.com' : 'http://localhost:9400')

export const LLM_CONFIG = {
  defaultModel: 'anthropic/claude-sonnet-4.6',
  maxTokens: 16384,
  temperature: 0.4,
  maxToolRounds: 500,
  continuationPrompt:
    'You were cut off mid-response. Continue building from where you stopped. Do NOT repeat work already done.',
} as const

// ─── Stream Event Types ─────────────────────────────────────────────

export type CompletedToolCall = {
  id: string
  name: string
  args: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ReasoningDetail = Record<string, any>

export type LLMStreamEvent =
  | { type: 'content'; content: string }
  | { type: 'reasoning'; content: string }
  | { type: 'tool_start'; index: number; id: string; name: string }
  | { type: 'tool_delta'; index: number; id: string; args: string }
  | { type: 'tool_complete'; toolCalls: CompletedToolCall[]; finishReason: string; reasoningContent?: string; reasoningDetails?: ReasoningDetail[] }
  | { type: 'done'; finishReason: string; reasoningContent?: string; reasoningDetails?: ReasoningDetail[] }
  | { type: 'error'; error: string }

// ─── AI Client ──────────────────────────────────────────────────────

export class AIClient {
  readonly model: string
  readonly maxTokens: number
  readonly temperature: number

  constructor(opts: { model?: string; maxTokens?: number; temperature?: number } = {}) {
    this.model = opts.model ?? LLM_CONFIG.defaultModel
    this.maxTokens = opts.maxTokens ?? LLM_CONFIG.maxTokens
    this.temperature = opts.temperature ?? LLM_CONFIG.temperature
  }

  private _reqCount = 0

  /** Log current settings to console. */
  logSettings(label: string): void {
    console.log(
      `[AIClient:${label}] model=${this.model} max_tokens=${this.maxTokens} temperature=${this.temperature} server=${LLM_SERVER_URL}`,
    )
  }

  /** Build the request body sent to the Python LLM server. */
  private _buildBody(
    messages: OpenAI.ChatCompletionMessageParam[],
    tools?: OpenAI.ChatCompletionTool[],
  ) {
    return {
      model: this.model,
      messages,
      tools: tools?.length ? tools : undefined,
      max_tokens: this.maxTokens,
      temperature: this.temperature,
    }
  }

  /**
   * Stream a chat completion via the Python LLM server.
   * Yields the same typed events as before — consumers don't change.
   */
  async *streamChat(
    messages: OpenAI.ChatCompletionMessageParam[],
    tools?: OpenAI.ChatCompletionTool[],
  ): AsyncGenerator<LLMStreamEvent> {
    const idx = String(this._reqCount++).padStart(4, '0')
    console.log(`[llm] #${idx} → ${this.model} | ${messages.length} msgs (stream)`)

    try {
      const response = await fetch(`${LLM_SERVER_URL}/v1/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this._buildBody(messages, tools)),
      })

      if (!response.ok) {
        const text = await response.text()
        yield { type: 'error', error: `LLM server error ${response.status}: ${text}` }
        return
      }

      if (!response.body) {
        yield { type: 'error', error: 'No response body from LLM server' }
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const event = JSON.parse(line) as LLMStreamEvent
            yield event
          } catch {
            // skip malformed lines
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        try {
          const event = JSON.parse(buffer) as LLMStreamEvent
          yield event
        } catch {
          // skip
        }
      }
    } catch (err) {
      yield { type: 'error', error: err instanceof Error ? err.message : String(err) }
    }
  }

  /** Non-streaming chat completion via the Python LLM server. */
  async chat(
    messages: OpenAI.ChatCompletionMessageParam[],
    tools?: OpenAI.ChatCompletionTool[],
  ): Promise<{
    content: string | null
    toolCalls: CompletedToolCall[]
    finishReason: string
  }> {
    const response = await fetch(`${LLM_SERVER_URL}/v1/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this._buildBody(messages, tools)),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`LLM server error ${response.status}: ${text}`)
    }

    const data = await response.json()
    return {
      content: data.content ?? null,
      toolCalls: data.toolCalls ?? [],
      finishReason: data.finishReason ?? 'stop',
    }
  }
}
