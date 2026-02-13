import type { AvailableModel, CanvasEdge, CanvasNode } from '../src/types/agent'

// --- Tool call record captured during execution ---

export type CapturedToolCall = {
  id: string
  name: string
  arguments: Record<string, unknown>
  response: string
}

// --- A single round of the agentic loop ---

export type AgentRound = {
  roundIndex: number
  assistantText: string
  toolCalls: Array<CapturedToolCall>
}

// --- Full result of running one scenario against one model ---

export type ScenarioRunResult = {
  scenarioId: string
  modelId: string
  rounds: Array<AgentRound>
  allToolCalls: Array<CapturedToolCall>
  durationMs: number
  success: boolean
  error?: string
}

// --- Expected behavior for evaluation ---

export type ArgChecker = string | number | boolean | RegExp | ((val: unknown) => boolean)

export type ToolCallExpectation = {
  name: string
  args?: Record<string, ArgChecker>
  optional?: boolean
}

export type CustomValidationResult = {
  score: number
  reason: string
}

export type ScenarioExpectation = {
  expectedToolCalls: Array<ToolCallExpectation>
  forbiddenTools?: Array<string>
  expectNoActions?: boolean
  customValidator?: (result: ScenarioRunResult) => CustomValidationResult
}

// --- Score breakdown ---

export type ScenarioScore = {
  scenarioId: string
  modelId: string
  toolSelection: number
  parameterAccuracy: number
  ruleCompliance: number
  noUnnecessaryActions: number
  total: number
  notes: Array<string>
}

// --- Scenario definition ---

export type Scenario = {
  id: string
  category: string
  name: string
  userMessage: string
  canvasState: {
    nodes: Array<CanvasNode>
    edges: Array<CanvasEdge>
  }
  expectation: ScenarioExpectation
}

// --- Model config ---

export type BenchmarkModel = {
  id: string
  label: string
  openRouterId: string
}
