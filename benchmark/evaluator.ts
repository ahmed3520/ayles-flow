import type {
  ArgChecker,
  CapturedToolCall,
  Scenario,
  ScenarioRunResult,
  ScenarioScore,
  ToolCallExpectation,
} from './types'

const ACTION_TOOLS = new Set([
  'add_node', 'connect_nodes', 'update_node',
  'delete_nodes', 'clear_canvas', 'deep_research', 'create_pdf',
])

const READ_ONLY_TOOLS = new Set(['get_canvas_state', 'get_available_models'])

export function evaluateScenario(
  scenario: Scenario,
  result: ScenarioRunResult,
): ScenarioScore {
  const notes: Array<string> = []
  const exp = scenario.expectation

  if (!result.success) {
    return {
      scenarioId: scenario.id,
      modelId: result.modelId,
      toolSelection: 0,
      parameterAccuracy: 0,
      ruleCompliance: 0,
      noUnnecessaryActions: 0,
      total: 0,
      notes: [`Run failed: ${result.error}`],
    }
  }

  const toolSelection = scoreToolSelection(exp.expectedToolCalls, result.allToolCalls, notes)
  const parameterAccuracy = scoreParameterAccuracy(exp.expectedToolCalls, result.allToolCalls, notes)
  const ruleCompliance = scoreRuleCompliance(scenario, result, notes)
  const noUnnecessaryActions = scoreNoUnnecessaryActions(exp.expectedToolCalls, result.allToolCalls, exp.expectNoActions ?? false, notes)

  // Weighted: tool selection is the most important signal
  const total =
    toolSelection * 0.4 +
    parameterAccuracy * 0.25 +
    ruleCompliance * 0.2 +
    noUnnecessaryActions * 0.15

  return {
    scenarioId: scenario.id,
    modelId: result.modelId,
    toolSelection,
    parameterAccuracy,
    ruleCompliance,
    noUnnecessaryActions,
    total,
    notes,
  }
}

// Tool Selection: ordered subsequence match of required tools
function scoreToolSelection(
  expected: Array<ToolCallExpectation>,
  actual: Array<CapturedToolCall>,
  notes: Array<string>,
): number {
  const required = expected.filter((e) => !e.optional)
  if (required.length === 0) return 1.0

  let actualIdx = 0
  let matched = 0

  for (const req of required) {
    while (actualIdx < actual.length) {
      if (actual[actualIdx].name === req.name) {
        matched++
        actualIdx++
        break
      }
      actualIdx++
    }
  }

  const score = matched / required.length
  if (score < 1) {
    const missing = required
      .filter((r) => !actual.some((a) => a.name === r.name))
      .map((r) => r.name)
    if (missing.length > 0) {
      notes.push(`Missing tools: ${missing.join(', ')} (${matched}/${required.length})`)
    }
  }
  return score
}

// Parameter Accuracy: check args against expectations
function scoreParameterAccuracy(
  expected: Array<ToolCallExpectation>,
  actual: Array<CapturedToolCall>,
  notes: Array<string>,
): number {
  const withArgs = expected.filter((e) => e.args && Object.keys(e.args).length > 0)
  if (withArgs.length === 0) return 1.0

  let totalChecks = 0
  let passedChecks = 0

  for (const exp of withArgs) {
    const candidates = actual.filter((a) => a.name === exp.name)
    if (candidates.length === 0) {
      // Tool wasn't called — all its arg checks count as failures
      totalChecks += Object.keys(exp.args!).length
      notes.push(`${exp.name} not called — args not verified`)
      continue
    }

    for (const [key, checker] of Object.entries(exp.args!)) {
      totalChecks++
      const passed = candidates.some((c) => matchArg(c.arguments[key], checker))
      if (passed) {
        passedChecks++
      } else {
        const actualVals = candidates.map((c) => c.arguments[key])
        notes.push(`${exp.name}.${key} = ${JSON.stringify(actualVals[0])} did not match`)
      }
    }
  }

  return totalChecks > 0 ? passedChecks / totalChecks : 1.0
}

function matchArg(actual: unknown, expected: ArgChecker): boolean {
  if (typeof expected === 'function') return expected(actual)
  if (expected instanceof RegExp) return typeof actual === 'string' && expected.test(actual)
  return JSON.stringify(actual) === JSON.stringify(expected)
}

// Rule Compliance: forbidden tools + custom validator
function scoreRuleCompliance(
  scenario: Scenario,
  result: ScenarioRunResult,
  notes: Array<string>,
): number {
  const exp = scenario.expectation
  let score = 1.0

  if (exp.forbiddenTools) {
    for (const forbidden of exp.forbiddenTools) {
      if (result.allToolCalls.some((tc) => tc.name === forbidden)) {
        score -= 0.5
        notes.push(`Forbidden tool used: '${forbidden}'`)
      }
    }
  }

  if (exp.expectNoActions) {
    const actions = result.allToolCalls.filter((tc) => ACTION_TOOLS.has(tc.name))
    if (actions.length > 0) {
      score -= 0.3
      notes.push(`Action tools used when none expected: ${actions.map((a) => a.name).join(', ')}`)
    }
  }

  if (exp.customValidator) {
    const custom = exp.customValidator(result)
    score = Math.min(score, custom.score)
    if (custom.score < 1) notes.push(`Custom: ${custom.reason}`)
  }

  return Math.max(0, score)
}

// No Unnecessary Actions: penalize extra action tools
function scoreNoUnnecessaryActions(
  expected: Array<ToolCallExpectation>,
  actual: Array<CapturedToolCall>,
  expectNoActions: boolean,
  notes: Array<string>,
): number {
  const actionCalls = actual.filter((tc) => !READ_ONLY_TOOLS.has(tc.name))

  if (expectNoActions) {
    return actionCalls.length === 0 ? 1.0 : Math.max(0, 1 - actionCalls.length * 0.25)
  }

  const expectedNames = expected
    .filter((e) => !READ_ONLY_TOOLS.has(e.name) && !e.optional)
    .map((e) => e.name)

  const budget = [...expectedNames]
  let unexpected = 0

  for (const tc of actionCalls) {
    const idx = budget.indexOf(tc.name)
    if (idx >= 0) {
      budget.splice(idx, 1)
    } else {
      unexpected++
    }
  }

  if (unexpected > 0) {
    notes.push(`${unexpected} extra action call(s)`)
    return Math.max(0, 1 - unexpected * 0.15)
  }
  return 1.0
}
