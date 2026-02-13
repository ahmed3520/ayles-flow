import { STATIC_SYSTEM_PROMPT, tools } from '../src/data/agent-config'
import { MockToolExecutor } from './mocks'

import type OpenAI from 'openai'
import type {
  AgentRound,
  BenchmarkModel,
  CapturedToolCall,
  Scenario,
  ScenarioRunResult,
} from './types'

const MAX_TOOL_ROUNDS = 10

export async function runScenario(
  client: OpenAI,
  model: BenchmarkModel,
  scenario: Scenario,
): Promise<ScenarioRunResult> {
  const startTime = Date.now()
  const rounds: Array<AgentRound> = []
  const allToolCalls: Array<CapturedToolCall> = []

  const mockExecutor = new MockToolExecutor(
    scenario.canvasState.nodes,
    scenario.canvasState.edges,
  )

  // OpenRouter cache_control extension doesn't match OpenAI types
  const messages: Array<any> = [
    {
      role: 'system',
      content: [
        {
          type: 'text',
          text: STATIC_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
    },
    { role: 'user', content: scenario.userMessage },
  ]

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await client.chat.completions.create({
        model: model.openRouterId,
        messages,
        tools,
      })

      const choice = response.choices[0]
      const message = choice.message
      const assistantText = message.content || ''
      const roundToolCalls: Array<CapturedToolCall> = []

      if (!message.tool_calls || message.tool_calls.length === 0) {
        rounds.push({ roundIndex: round, assistantText, toolCalls: [] })
        break
      }

      messages.push({
        role: 'assistant',
        content: assistantText || null,
        tool_calls: message.tool_calls,
      })

      for (const tc of message.tool_calls) {
        // Filter to function tool calls only
        if (tc.type !== 'function') continue

        let args: Record<string, unknown> = {}
        try {
          args = JSON.parse(tc.function.arguments)
        } catch {
          // malformed
        }

        const mockResponse = mockExecutor.execute(tc.function.name, args)

        const captured: CapturedToolCall = {
          id: tc.id,
          name: tc.function.name,
          arguments: args,
          response: mockResponse,
        }
        roundToolCalls.push(captured)
        allToolCalls.push(captured)

        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: mockResponse,
        })
      }

      rounds.push({ roundIndex: round, assistantText, toolCalls: roundToolCalls })
    }

    return {
      scenarioId: scenario.id,
      modelId: model.id,
      rounds,
      allToolCalls,
      durationMs: Date.now() - startTime,
      success: true,
    }
  } catch (error) {
    return {
      scenarioId: scenario.id,
      modelId: model.id,
      rounds,
      allToolCalls,
      durationMs: Date.now() - startTime,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
