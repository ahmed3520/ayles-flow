/**
 * Sandbox I/O benchmark
 * Measures raw E2B sandbox operation latencies to find bottlenecks.
 *
 * Usage: npx tsx benchmark/sandbox-io.ts
 */

import { Sandbox } from 'e2b'

const SMALL_CONTENT = 'export const hello = "world";\n'
const MEDIUM_CONTENT = Array(100).fill('export const line = "some code here with enough content to be realistic";\n').join('')
const LARGE_CONTENT = Array(1000).fill('export const line = "some code here with enough content to be realistic and test larger file writes";\n').join('')

interface BenchResult {
  name: string
  runs: number[]
  avg: number
  min: number
  max: number
  p50: number
  p95: number
}

function stats(name: string, runs: number[]): BenchResult {
  const sorted = [...runs].sort((a, b) => a - b)
  return {
    name,
    runs,
    avg: runs.reduce((a, b) => a + b, 0) / runs.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    p50: sorted[Math.floor(sorted.length * 0.5)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
  }
}

async function time(fn: () => Promise<void>): Promise<number> {
  const start = performance.now()
  await fn()
  return Math.round(performance.now() - start)
}

async function bench(name: string, iterations: number, fn: () => Promise<void>): Promise<BenchResult> {
  const runs: number[] = []
  // warmup
  await fn()
  for (let i = 0; i < iterations; i++) {
    runs.push(await time(fn))
  }
  return stats(name, runs)
}

function printResults(results: BenchResult[]) {
  const col = { name: 36, avg: 10, min: 10, max: 10, p50: 10, p95: 10 }

  const header = [
    'Operation'.padEnd(col.name),
    'Avg'.padStart(col.avg),
    'Min'.padStart(col.min),
    'Max'.padStart(col.max),
    'P50'.padStart(col.p50),
    'P95'.padStart(col.p95),
  ].join(' | ')
  const sep = '-'.repeat(header.length)

  console.log('\n' + sep)
  console.log(header)
  console.log(sep)

  for (const r of results) {
    const row = [
      r.name.padEnd(col.name),
      `${r.avg.toFixed(0)}ms`.padStart(col.avg),
      `${r.min}ms`.padStart(col.min),
      `${r.max}ms`.padStart(col.max),
      `${r.p50}ms`.padStart(col.p50),
      `${r.p95}ms`.padStart(col.p95),
    ].join(' | ')
    console.log(row)
  }

  console.log(sep + '\n')
}

async function main() {
  const apiKey = process.env.E2B_API_KEY
  if (!apiKey) {
    console.error('E2B_API_KEY required')
    process.exit(1)
  }

  const N = 10

  console.log('Creating sandbox...')
  const t0 = performance.now()
  const sandbox = await Sandbox.create('m8vig10ovz8jgg537fnv', { // vite template
    timeoutMs: 5 * 60 * 1000,
    apiKey,
  })
  console.log(`Sandbox created in ${Math.round(performance.now() - t0)}ms (${sandbox.sandboxId})\n`)

  console.log(`Running ${N} iterations per operation...\n`)

  const results: BenchResult[] = []

  // --- sandbox.files.write ---
  results.push(await bench(`files.write (small, ${SMALL_CONTENT.length}B)`, N, async () => {
    await sandbox.files.write('/home/user/app/bench-small.ts', SMALL_CONTENT)
  }))

  results.push(await bench(`files.write (medium, ${MEDIUM_CONTENT.length}B)`, N, async () => {
    await sandbox.files.write('/home/user/app/bench-medium.ts', MEDIUM_CONTENT)
  }))

  results.push(await bench(`files.write (large, ${LARGE_CONTENT.length}B)`, N, async () => {
    await sandbox.files.write('/home/user/app/bench-large.ts', LARGE_CONTENT)
  }))

  // --- sandbox.files.read ---
  results.push(await bench('files.read (small)', N, async () => {
    await sandbox.files.read('/home/user/app/bench-small.ts')
  }))

  results.push(await bench('files.read (large)', N, async () => {
    await sandbox.files.read('/home/user/app/bench-large.ts')
  }))

  // --- sandbox.commands.run (simple) ---
  results.push(await bench('commands.run (echo)', N, async () => {
    await sandbox.commands.run('echo hello')
  }))

  results.push(await bench('commands.run (ls)', N, async () => {
    await sandbox.commands.run('ls /home/user/app')
  }))

  // --- mkdir -p (what write tool does) ---
  results.push(await bench('commands.run (mkdir -p)', N, async () => {
    await sandbox.commands.run("mkdir -p '/home/user/app/src/components/ui'")
  }))

  // --- Full write tool flow: mkdir + write ---
  results.push(await bench('FULL write tool (mkdir + write)', N, async () => {
    await sandbox.commands.run("mkdir -p '/home/user/app/src/components'")
    await sandbox.files.write('/home/user/app/src/components/Bench.tsx', MEDIUM_CONTENT)
  }))

  // --- Full write tool flow + LSP diagnostics ---
  results.push(await bench('FULL write + LSP curl (no server)', N, async () => {
    await sandbox.commands.run("mkdir -p '/home/user/app/src/components'")
    await sandbox.files.write('/home/user/app/src/components/Bench2.tsx', MEDIUM_CONTENT)
    // This will fail/timeout since no LSP server — shows the cost of the curl attempt
    await sandbox.commands.run(
      "curl -s -m 5 -X POST http://localhost:7998/diagnostics -H 'Content-Type: application/json' -d '{\"path\":\"/home/user/app/src/components/Bench2.tsx\"}'",
      { timeoutMs: 8_000 },
    ).catch(() => {})
  }))

  // --- Sequential vs parallel writes ---
  const FILES_COUNT = 5
  const fileContents = Array.from({ length: FILES_COUNT }, (_, i) =>
    ({ path: `/home/user/app/src/bench-seq-${i}.tsx`, content: MEDIUM_CONTENT }))

  results.push(await bench(`${FILES_COUNT}x write SEQUENTIAL`, 3, async () => {
    for (const f of fileContents) {
      await sandbox.files.write(f.path, f.content)
    }
  }))

  results.push(await bench(`${FILES_COUNT}x write PARALLEL`, 3, async () => {
    await Promise.all(fileContents.map(f => sandbox.files.write(f.path, f.content)))
  }))

  // --- Sequential vs parallel: full write tool (mkdir + write) ---
  results.push(await bench(`${FILES_COUNT}x full write SEQUENTIAL`, 3, async () => {
    for (let i = 0; i < FILES_COUNT; i++) {
      await sandbox.commands.run(`mkdir -p '/home/user/app/src/seq-dir-${i}'`)
      await sandbox.files.write(`/home/user/app/src/seq-dir-${i}/index.tsx`, MEDIUM_CONTENT)
    }
  }))

  results.push(await bench(`${FILES_COUNT}x full write PARALLEL`, 3, async () => {
    await Promise.all(Array.from({ length: FILES_COUNT }, async (_, i) => {
      await sandbox.commands.run(`mkdir -p '/home/user/app/src/par-dir-${i}'`)
      await sandbox.files.write(`/home/user/app/src/par-dir-${i}/index.tsx`, MEDIUM_CONTENT)
    }))
  }))

  // --- Print ---
  printResults(results)

  // Cleanup
  console.log('Killing sandbox...')
  await Sandbox.kill(sandbox.sandboxId, { apiKey })
  console.log('Done.')
}

main().catch((err) => {
  console.error('Benchmark failed:', err)
  process.exit(1)
})
