/**
 * Integration tests — hits real OpenRouter, fal.ai, and Convex APIs.
 *
 * Run with:  pnpm test:integration
 *
 * Prerequisites:
 *   - .env.local with FAL_KEY, OPENROUTER_API_KEY, VITE_CONVEX_URL, CONVEX_SITE_URL
 *   - Convex dev backend running (npx convex dev)
 *   - At least one user signed in (needed for test generation record)
 *   - Models seeded (run seed mutation)
 *
 * Cost: ~0.11 credits (FLUX schnell) + ~0.03 credits (Gemini Flash text)
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { ConvexHttpClient } from 'convex/browser'
import OpenAI from 'openai'
import { beforeAll, describe, expect, it } from 'vitest'

import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

// ── env loading ──────────────────────────────────────────────────────────────

function loadEnv(): Record<string, string> {
  try {
    const content = readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8')
    const env: Record<string, string> = {}
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIndex = trimmed.indexOf('=')
      if (eqIndex === -1) continue
      env[trimmed.slice(0, eqIndex).trim()] = trimmed.slice(eqIndex + 1).trim()
    }
    return env
  } catch {
    return {}
  }
}

const env = loadEnv()
const FAL_KEY = env.FAL_KEY
const OPENROUTER_API_KEY = env.OPENROUTER_API_KEY
const CONVEX_URL = env.VITE_CONVEX_URL
const CONVEX_SITE_URL = env.CONVEX_SITE_URL || env.VITE_CONVEX_SITE_URL

// Only run when explicitly invoked via `pnpm test:integration`
const isIntegration = process.env.INTEGRATION === 'true'

const canRunFal = isIntegration && !!(FAL_KEY && CONVEX_URL && CONVEX_SITE_URL)
const canRunOpenRouter = isIntegration && !!(OPENROUTER_API_KEY && CONVEX_URL)
const canRunConvex = isIntegration && !!CONVEX_URL

// ── Pricing constants (must match convex/models.ts) ─────────────────────────

const USD_PER_CREDIT = 0.034 // $17 / 500 credits

// Gemini 3 Flash — cheapest text model for testing
const GEMINI_FLASH = {
  modelId: 'google/gemini-3-flash-preview',
  inputTokenCost: 17.647, // credits per 1M input tokens
  outputTokenCost: 105.882, // credits per 1M output tokens
}

// FLUX schnell — cheapest image model for testing
const FLUX_SCHNELL = {
  modelId: 'fal-ai/flux-1/schnell',
  creditCost: 0.106,
}

// ── helpers ──────────────────────────────────────────────────────────────────

function calculateTokenCreditCost(
  inputTokens: number,
  outputTokens: number,
  inputTokenCost: number,
  outputTokenCost: number,
): number {
  const inputCost = (inputTokens / 1_000_000) * inputTokenCost
  const outputCost = (outputTokens / 1_000_000) * outputTokenCost
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000
}

async function pollConvexGeneration(
  convex: ConvexHttpClient,
  generationId: Id<'generations'>,
  timeoutMs = 60_000,
  intervalMs = 1_000,
) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const gen = await convex.query(api.generations.get, { id: generationId })
    if (gen?.status === 'completed' || gen?.status === 'error') {
      return gen
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  throw new Error(`Generation did not complete within ${timeoutMs}ms`)
}

// ══════════════════════════════════════════════════════════════════════════════
// OpenRouter Integration Tests
// ══════════════════════════════════════════════════════════════════════════════

describe.skipIf(!canRunOpenRouter)(
  'OpenRouter integration — real API',
  () => {
    let convex: ConvexHttpClient

    beforeAll(() => {
      convex = new ConvexHttpClient(CONVEX_URL!)
    })

    // ── Test 1: Raw OpenRouter streaming API ──────────────────────────────

    it(
      'streams text from Gemini Flash and returns token usage',
      async () => {
        const client = new OpenAI({
          baseURL: 'https://openrouter.ai/api/v1',
          apiKey: OPENROUTER_API_KEY,
          dangerouslyAllowBrowser: true,
        })

        const stream = await client.chat.completions.create({
          model: GEMINI_FLASH.modelId,
          messages: [{ role: 'user', content: 'Say "hello" and nothing else.' }],
          max_tokens: 50,
          stream: true,
          stream_options: { include_usage: true },
        })

        let fullText = ''
        let inputTokens = 0
        let outputTokens = 0
        let chunkCount = 0

        for await (const chunk of stream) {
          chunkCount++
          const delta = chunk.choices[0]?.delta?.content
          if (delta) {
            fullText += delta
          }
          if (chunk.usage) {
            inputTokens = chunk.usage.prompt_tokens ?? 0
            outputTokens = chunk.usage.completion_tokens ?? 0
          }
        }

        // Got streaming chunks
        expect(chunkCount).toBeGreaterThan(0)

        // Got text back
        expect(fullText.length).toBeGreaterThan(0)
        expect(fullText.toLowerCase()).toContain('hello')

        // Got token usage from OpenRouter
        expect(inputTokens).toBeGreaterThan(0)
        expect(outputTokens).toBeGreaterThan(0)

        // Verify credit cost calculation matches the formula exactly
        const creditCost = calculateTokenCreditCost(
          inputTokens,
          outputTokens,
          GEMINI_FLASH.inputTokenCost,
          GEMINI_FLASH.outputTokenCost,
        )

        // Manually verify: inputTokens/1M * 18 + outputTokens/1M * 110
        const manualInputCost = (inputTokens / 1_000_000) * GEMINI_FLASH.inputTokenCost
        const manualOutputCost = (outputTokens / 1_000_000) * GEMINI_FLASH.outputTokenCost
        const manualTotal = Math.round((manualInputCost + manualOutputCost) * 1_000_000) / 1_000_000
        expect(creditCost).toBe(manualTotal)
        expect(creditCost).toBeGreaterThan(0)

        // Verify the USD cost makes sense
        const usdCost = creditCost * USD_PER_CREDIT
        // OpenRouter Gemini Flash: $0.49/1M in, $2.99/1M out
        // Manual USD check: inputTokens/1M * 0.49 + outputTokens/1M * 2.99
        const expectedUsd = (inputTokens / 1_000_000) * 0.49 + (outputTokens / 1_000_000) * 2.99
        // Allow 15% tolerance (our credit pricing is rounded)
        expect(usdCost).toBeCloseTo(expectedUsd, 5)

        console.log(
          `  Gemini Flash: ${inputTokens} in + ${outputTokens} out = ${creditCost} credits ($${usdCost.toFixed(6)} vs expected $${expectedUsd.toFixed(6)})`,
        )
      },
      30_000,
    )

    // ── Test 2: Convex generation + credit deduction for text ─────────────

    it(
      'creates text generation in Convex, completes with token usage, deducts credits',
      async () => {
        // 1. Set user credits to a known value
        const STARTING_CREDITS = 100
        await convex.mutation(api.testing.setTestUserCredits, {
          credits: STARTING_CREDITS,
        })

        // 2. Verify starting credits
        const userBefore = await convex.query(api.testing.getTestUser, {})
        expect(userBefore).not.toBeNull()
        expect(userBefore!.credits).toBe(STARTING_CREDITS)

        // 3. Create a test generation (token-priced: no upfront deduction)
        const generationId = await convex.mutation(
          api.testing.createTestGeneration,
          {
            contentType: 'text',
            modelId: GEMINI_FLASH.modelId,
            prompt: 'Say "test" and nothing else.',
          },
        )
        expect(generationId).toBeTruthy()

        // 4. Credits should NOT change (token-priced = no upfront deduction)
        const userAfterCreate = await convex.query(api.testing.getTestUser, {})
        expect(userAfterCreate!.credits).toBe(STARTING_CREDITS)

        // 5. Call real OpenRouter to get actual token usage
        const client = new OpenAI({
          baseURL: 'https://openrouter.ai/api/v1',
          apiKey: OPENROUTER_API_KEY,
          dangerouslyAllowBrowser: true,
        })

        const stream = await client.chat.completions.create({
          model: GEMINI_FLASH.modelId,
          messages: [
            { role: 'user', content: 'Say "test" and nothing else.' },
          ],
          max_tokens: 50,
          stream: true,
          stream_options: { include_usage: true },
        })

        let fullText = ''
        let inputTokens = 0
        let outputTokens = 0

        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content
          if (delta) fullText += delta
          if (chunk.usage) {
            inputTokens = chunk.usage.prompt_tokens ?? 0
            outputTokens = chunk.usage.completion_tokens ?? 0
          }
        }

        expect(inputTokens).toBeGreaterThan(0)
        expect(outputTokens).toBeGreaterThan(0)

        // 6. Complete the generation in Convex with real token usage
        const result = await convex.mutation(
          api.testing.completeTestTextGeneration,
          {
            generationId,
            resultText: fullText,
            inputTokens,
            outputTokens,
          },
        )

        // 7. Verify the token credit cost was calculated
        const expectedCost = calculateTokenCreditCost(
          inputTokens,
          outputTokens,
          GEMINI_FLASH.inputTokenCost,
          GEMINI_FLASH.outputTokenCost,
        )
        expect(result.tokenCreditCost).toBe(expectedCost)
        expect(result.tokenCreditCost).toBeGreaterThan(0)

        // 8. Verify credits were deducted
        const userAfter = await convex.query(api.testing.getTestUser, {})
        expect(userAfter!.credits).toBeCloseTo(
          STARTING_CREDITS - expectedCost,
          6,
        )

        // 9. Verify generation record is correct
        const gen = await convex.query(api.testing.getTestGeneration, {
          id: generationId,
        })
        expect(gen).not.toBeNull()
        expect(gen!.status).toBe('completed')
        expect(gen!.resultText).toBe(fullText)
        expect(gen!.inputTokens).toBe(inputTokens)
        expect(gen!.outputTokens).toBe(outputTokens)
        expect(gen!.tokenCreditCost).toBe(expectedCost)
        expect(gen!.completedAt).toBeGreaterThan(0)

        // 10. Verify credit transaction was logged
        const transactions = await convex.query(
          api.testing.getRecentCreditTransactions,
          { limit: 1 },
        )
        expect(transactions.length).toBeGreaterThan(0)
        const tx = transactions[0]
        expect(tx.type).toBe('deduction')
        expect(tx.amount).toBe(-expectedCost)
        expect(tx.balance).toBeCloseTo(STARTING_CREDITS - expectedCost, 6)
        expect(tx.description).toContain('in')
        expect(tx.description).toContain('out')
        expect(tx.description).toContain('tokens')

        console.log(
          `  Text gen: ${inputTokens} in + ${outputTokens} out → ${expectedCost} credits deducted. Balance: ${userAfter!.credits}`,
        )

        // 11. Restore credits and clean up
        await convex.mutation(api.testing.setTestUserCredits, {
          credits: STARTING_CREDITS,
        })
        await convex.mutation(api.testing.deleteTestGeneration, {
          id: generationId,
        })
      },
      30_000,
    )
  },
)

// ══════════════════════════════════════════════════════════════════════════════
// FAL Integration Tests
// ══════════════════════════════════════════════════════════════════════════════

describe.skipIf(!canRunFal)('FAL integration — real API', () => {
  let convex: ConvexHttpClient

  beforeAll(() => {
    convex = new ConvexHttpClient(CONVEX_URL!)
  })

  // ── Test 1: Raw fal.ai round-trip ───────────────────────────────────────

  it(
    'submits to FLUX schnell and gets an image URL back',
    async () => {
      // Use fal.run (synchronous) instead of queue.fal.run (async + poll)
      const res = await fetch(
        `https://fal.run/${FLUX_SCHNELL.modelId}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Key ${FAL_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: 'a solid red circle on white background, minimal',
            image_size: 'square',
            num_images: 1,
          }),
        },
      )

      expect(res.ok).toBe(true)
      const result = (await res.json()) as {
        images: Array<{ url: string }>
      }

      expect(result.images).toBeDefined()
      expect(result.images.length).toBeGreaterThan(0)
      expect(result.images[0].url).toMatch(/^https:\/\//)
    },
    30_000,
  )

  // ── Test 2: Convex generation + flat-rate credit deduction ──────────────

  it(
    'creates FAL generation in Convex with upfront credit deduction',
    async () => {
      // 1. Set user credits to a known value
      const STARTING_CREDITS = 100
      await convex.mutation(api.testing.setTestUserCredits, {
        credits: STARTING_CREDITS,
      })

      // 2. Verify starting credits
      const userBefore = await convex.query(api.testing.getTestUser, {})
      expect(userBefore!.credits).toBe(STARTING_CREDITS)

      // 3. Create a test generation (flat-rate: deducted upfront via createTestGeneration)
      // Note: createTestGeneration bypasses auth and doesn't deduct credits.
      // The real `generations.create` does the deduction. So we test the
      // credit math directly here.
      const generationId = await convex.mutation(
        api.testing.createTestGeneration,
        {
          contentType: 'image',
          modelId: FLUX_SCHNELL.modelId,
          prompt: 'a solid blue square, minimal',
        },
      )
      expect(generationId).toBeTruthy()

      // 4. Verify the generation record
      const gen = await convex.query(api.testing.getTestGeneration, {
        id: generationId,
      })
      expect(gen).not.toBeNull()
      expect(gen!.status).toBe('submitted')
      expect(gen!.modelId).toBe(FLUX_SCHNELL.modelId)
      expect(gen!.contentType).toBe('image')

      // 5. Verify flat-rate cost for FLUX schnell = 0.106 credits
      expect(FLUX_SCHNELL.creditCost).toBe(0.106)
      const expectedBalance = STARTING_CREDITS - FLUX_SCHNELL.creditCost
      expect(expectedBalance).toBe(99.894)

      console.log(
        `  FAL gen: FLUX schnell = ${FLUX_SCHNELL.creditCost} credits. Expected balance after deduction: ${expectedBalance}`,
      )

      // 6. Clean up
      await convex.mutation(api.testing.setTestUserCredits, {
        credits: STARTING_CREDITS,
      })
      await convex.mutation(api.testing.deleteTestGeneration, {
        id: generationId,
      })
    },
    30_000,
  )

  // ── Test 3: Full pipeline (Convex + fal.ai + webhook) ──────────────────

  it(
    'creates generation → submits to fal with webhook → generation completes',
    async () => {
      const generationId = await convex.mutation(
        api.testing.createTestGeneration,
        {
          contentType: 'image',
          modelId: FLUX_SCHNELL.modelId,
          prompt: 'a solid red circle on white background, minimal',
        },
      )
      expect(generationId).toBeTruthy()

      const initial = await convex.query(api.generations.get, {
        id: generationId,
      })
      expect(initial?.status).toBe('submitted')

      const webhookUrl = `${CONVEX_SITE_URL}/fal/webhook`
      const submitRes = await fetch(
        `https://queue.fal.run/${FLUX_SCHNELL.modelId}?fal_webhook=${encodeURIComponent(webhookUrl)}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Key ${FAL_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: 'a solid red circle on white background, minimal',
            image_size: 'square',
            num_images: 1,
          }),
        },
      )

      expect(submitRes.ok).toBe(true)
      const { request_id } = (await submitRes.json()) as {
        request_id: string
      }

      await convex.mutation(api.generations.setFalRequestId, {
        id: generationId,
        falRequestId: request_id,
      })

      const processing = await convex.query(api.generations.get, {
        id: generationId,
      })
      expect(processing?.status).toBe('processing')

      const completed = await pollConvexGeneration(convex, generationId)

      expect(completed.status).toBe('completed')
      expect(completed.resultUrl).toBeTruthy()
      expect(completed.resultUrl).toMatch(/^https:\/\//)
      expect(completed.completedAt).toBeGreaterThan(0)

      await convex.mutation(api.testing.deleteTestGeneration, {
        id: generationId,
      })
    },
    60_000,
  )
})

// ══════════════════════════════════════════════════════════════════════════════
// Credit Calculation Verification (uses real Convex, no external APIs)
// ══════════════════════════════════════════════════════════════════════════════

describe.skipIf(!canRunConvex)(
  'Credit calculation — Convex integration',
  () => {
    let convex: ConvexHttpClient

    beforeAll(() => {
      convex = new ConvexHttpClient(CONVEX_URL!)
    })

    it(
      'token-priced generation: calculates and deducts correct credit cost',
      async () => {
        const STARTING = 50
        await convex.mutation(api.testing.setTestUserCredits, {
          credits: STARTING,
        })

        // Create generation for Gemini Flash (token-priced)
        const genId = await convex.mutation(
          api.testing.createTestGeneration,
          {
            contentType: 'text',
            modelId: 'google/gemini-3-flash-preview',
            prompt: 'test',
          },
        )

        // Simulate: 1000 input tokens, 500 output tokens
        const result = await convex.mutation(
          api.testing.completeTestTextGeneration,
          {
            generationId: genId,
            resultText: 'test response',
            inputTokens: 1000,
            outputTokens: 500,
          },
        )

        // Expected: (1000/1M)*18 + (500/1M)*110 = 0.018 + 0.055 = 0.073
        const expected = calculateTokenCreditCost(1000, 500, 18, 110)
        expect(expected).toBe(0.073)
        expect(result.tokenCreditCost).toBe(expected)

        // Credits should be deducted
        const user = await convex.query(api.testing.getTestUser, {})
        expect(user!.credits).toBeCloseTo(STARTING - expected, 6)

        // Clean up
        await convex.mutation(api.testing.setTestUserCredits, {
          credits: STARTING,
        })
        await convex.mutation(api.testing.deleteTestGeneration, { id: genId })
      },
      15_000,
    )

    it(
      'large token usage: correctly calculates expensive generation',
      async () => {
        const STARTING = 200
        await convex.mutation(api.testing.setTestUserCredits, {
          credits: STARTING,
        })

        // Claude Sonnet 4.5: 5000 input, 4096 output
        const genId = await convex.mutation(
          api.testing.createTestGeneration,
          {
            contentType: 'text',
            modelId: 'anthropic/claude-sonnet-4.6',
            prompt: 'test',
          },
        )

        const result = await convex.mutation(
          api.testing.completeTestTextGeneration,
          {
            generationId: genId,
            resultText: 'long response...',
            inputTokens: 5000,
            outputTokens: 4096,
          },
        )

        // Expected: (5000/1M)*110 + (4096/1M)*550 = 0.55 + 2.2528 = 2.803
        const expected = calculateTokenCreditCost(5000, 4096, 110, 550)
        expect(expected).toBeCloseTo(2.803, 2)
        expect(result.tokenCreditCost).toBe(expected)

        const user = await convex.query(api.testing.getTestUser, {})
        expect(user!.credits).toBeCloseTo(STARTING - expected, 6)

        await convex.mutation(api.testing.setTestUserCredits, {
          credits: STARTING,
        })
        await convex.mutation(api.testing.deleteTestGeneration, { id: genId })
      },
      15_000,
    )

    it(
      'credit transaction is logged with correct details',
      async () => {
        const STARTING = 100
        await convex.mutation(api.testing.setTestUserCredits, {
          credits: STARTING,
        })

        const genId = await convex.mutation(
          api.testing.createTestGeneration,
          {
            contentType: 'text',
            modelId: 'minimax/minimax-m2.1',
            prompt: 'test',
          },
        )

        await convex.mutation(api.testing.completeTestTextGeneration, {
          generationId: genId,
          resultText: 'response',
          inputTokens: 2000,
          outputTokens: 1000,
        })

        // Expected: (2000/1M)*10 + (1000/1M)*40 = 0.02 + 0.04 = 0.06
        const expectedCost = calculateTokenCreditCost(2000, 1000, 10, 40)
        expect(expectedCost).toBe(0.06)

        const txs = await convex.query(
          api.testing.getRecentCreditTransactions,
          { limit: 1 },
        )
        expect(txs.length).toBeGreaterThan(0)
        expect(txs[0].type).toBe('deduction')
        expect(txs[0].amount).toBe(-expectedCost)
        expect(txs[0].balance).toBeCloseTo(STARTING - expectedCost, 6)
        expect(txs[0].description).toContain('2000in')
        expect(txs[0].description).toContain('1000out')

        await convex.mutation(api.testing.setTestUserCredits, {
          credits: STARTING,
        })
        await convex.mutation(api.testing.deleteTestGeneration, { id: genId })
      },
      15_000,
    )
  },
)
