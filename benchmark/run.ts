import { scenarios } from './scenarios'
import { runScenario } from './runner'
import { evaluateScenario } from './evaluator'

import type { BenchmarkModel, ScenarioScore } from './types'

// --- Models to benchmark ---

const MODELS: Array<BenchmarkModel> = [
  {
    id: 'claude-sonnet-4.5',
    label: 'Claude 4.5',
    openRouterId: 'anthropic/claude-sonnet-4.5',
  },
  { id: 'gpt-4.1', label: 'GPT 4.1', openRouterId: 'openai/gpt-4.1' },
  {
    id: 'gemini-flash',
    label: 'Gemini Flash',
    openRouterId: 'google/gemini-2.5-flash',
  },
  { id: 'deepseek', label: 'DeepSeek', openRouterId: 'deepseek/deepseek-chat' },
]

// --- CLI args ---

function parseArgs() {
  const args = process.argv.slice(2)
  let models = MODELS
  let scenarioFilter: string | undefined
  let verbose = false

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--model' || args[i] === '-m') && args[i + 1]) {
      const id = args[++i]
      models = MODELS.filter((m) => m.id === id)
      if (models.length === 0) {
        console.error(
          `Unknown model: ${id}. Available: ${MODELS.map((m) => m.id).join(', ')}`,
        )
        process.exit(1)
      }
    }
    if ((args[i] === '--scenario' || args[i] === '-s') && args[i + 1]) {
      scenarioFilter = args[++i]
    }
    if (args[i] === '--verbose' || args[i] === '-v') {
      verbose = true
    }
  }

  return { models, scenarioFilter, verbose }
}

// --- Table output ---

function fmt(n: number): string {
  return n.toFixed(2)
}

function printTable(
  models: Array<BenchmarkModel>,
  scores: Array<ScenarioScore>,
) {
  const lookup = new Map<string, Map<string, number>>()
  for (const s of scores) {
    if (!lookup.has(s.scenarioId)) lookup.set(s.scenarioId, new Map())
    lookup.get(s.scenarioId)!.set(s.modelId, s.total)
  }

  const scenarioIds = [...new Set(scores.map((s) => s.scenarioId))]
  const col = 16
  const nameCol = 28

  const header = [
    'Scenario'.padEnd(nameCol),
    ...models.map((m) => m.label.padStart(col)),
  ].join(' | ')
  const sep = '-'.repeat(header.length)

  console.log('\n' + sep)
  console.log(header)
  console.log(sep)

  let lastCategory = ''
  for (const sid of scenarioIds) {
    const scenario = scenarios.find((s) => s.id === sid)
    if (scenario && scenario.category !== lastCategory) {
      lastCategory = scenario.category
      console.log(`  ${lastCategory}`)
    }

    const name = scenario?.name ?? sid
    const row = [
      `    ${name}`.padEnd(nameCol),
      ...models.map((m) => {
        const score = lookup.get(sid)?.get(m.id)
        return score !== undefined
          ? fmt(score).padStart(col)
          : '-'.padStart(col)
      }),
    ].join(' | ')
    console.log(row)
  }

  console.log(sep)

  const totals = models.map((m) => {
    const ms = scores.filter((s) => s.modelId === m.id)
    return ms.reduce((sum, s) => sum + s.total, 0) / ms.length
  })
  const totalRow = [
    'TOTAL'.padEnd(nameCol),
    ...totals.map((t) => fmt(t).padStart(col)),
  ].join(' | ')
  console.log(totalRow)
  console.log(sep + '\n')
}

// --- Main ---

async function main() {
  const { models, scenarioFilter, verbose } = parseArgs()
  const filtered = scenarioFilter
    ? scenarios.filter(
        (s) =>
          s.id.includes(scenarioFilter) ||
          s.category.toLowerCase().includes(scenarioFilter.toLowerCase()),
      )
    : scenarios

  console.log(
    `\nBenchmarking ${models.length} model(s) x ${filtered.length} scenario(s)`,
  )
  console.log(`Models: ${models.map((m) => m.label).join(', ')}\n`)

  const allScores: Array<ScenarioScore> = []

  for (const model of models) {
    console.log(`--- ${model.label} ---`)

    for (const scenario of filtered) {
      process.stdout.write(`  ${scenario.name}...`)

      const result = await runScenario(model, scenario)
      const score = evaluateScenario(scenario, result)
      allScores.push(score)

      const tag =
        score.total >= 0.9 ? 'PASS' : score.total >= 0.5 ? 'PARTIAL' : 'FAIL'
      console.log(` ${tag} (${fmt(score.total)}) [${result.durationMs}ms]`)

      if (verbose) {
        console.log(
          `    Scores: tools=${fmt(score.toolSelection)} params=${fmt(score.parameterAccuracy)} rules=${fmt(score.ruleCompliance)} extras=${fmt(score.noUnnecessaryActions)}`,
        )
        if (score.notes.length > 0) {
          for (const note of score.notes) {
            console.log(`    - ${note}`)
          }
        }
        console.log(
          `    Tools: ${result.allToolCalls.map((tc) => tc.name).join(' -> ')}`,
        )
      }
    }
    console.log()
  }

  printTable(models, allScores)

  // Summary
  for (const model of models) {
    const ms = allScores.filter((s) => s.modelId === model.id)
    const avg = ms.reduce((sum, s) => sum + s.total, 0) / ms.length
    const perfect = ms.filter((s) => s.total >= 0.95).length
    console.log(
      `${model.label}: avg=${fmt(avg)}, perfect=${perfect}/${ms.length}`,
    )
  }
}

main().catch((err) => {
  console.error('Benchmark failed:', err)
  process.exit(1)
})
