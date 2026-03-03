import { STATIC_SYSTEM_PROMPT, tools } from '../src/data/agent-config'
import { MockToolExecutor } from './mocks'
import { AIClient } from '../src/config/llm'

import type {
  AgentRound,
  BenchmarkModel,
  CapturedToolCall,
  Scenario,
  ScenarioRunResult,
} from './types'

const MAX_TOOL_ROUNDS = 10

export async function runScenario(
  model: BenchmarkModel,
  scenario: Scenario,
): Promise<ScenarioRunResult> {
  const startTime = Date.now()
  const rounds: Array<AgentRound> = []
  const allToolCalls: Array<CapturedToolCall> = []

  const ai = new AIClient({ model: model.openRouterId })

  const mockExecutor = new MockToolExecutor(
    scenario.canvasState.nodes,
    scenario.canvasState.edges,
  )

  const messages: Array<any> = [
    { role: 'system', content: STATIC_SYSTEM_PROMPT },
    { role: 'user', content: scenario.userMessage },
  ]

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const result = await ai.chat(messages, tools)

      const assistantText = result.content || ''
      const roundToolCalls: Array<CapturedToolCall> = []

      if (result.toolCalls.length === 0) {
        rounds.push({ roundIndex: round, assistantText, toolCalls: [] })
        break
      }

      messages.push({
        role: 'assistant',
        content: assistantText || null,
        tool_calls: result.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.name, arguments: tc.args },
        })),
      })

      for (const tc of result.toolCalls) {
        let args: Record<string, unknown> = {}
        try {
          args = JSON.parse(tc.args)
        } catch {
          // malformed
        }

        const mockResponse = mockExecutor.execute(tc.name, args)

        const captured: CapturedToolCall = {
          id: tc.id,
          name: tc.name,
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
