/**
 * Integration test — hits real fal.ai + Convex APIs.
 *
 * Run with:  pnpm test:integration
 *
 * Prerequisites:
 *   - .env.local with FAL_KEY, VITE_CONVEX_URL, CONVEX_SITE_URL
 *   - Convex dev backend running (npx convex dev)
 *   - At least one user signed in (needed for test generation record)
 *
 * Cost: ~0.003 credits per run (FLUX.1 schnell)
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { ConvexHttpClient } from 'convex/browser'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

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
const CONVEX_URL = env.VITE_CONVEX_URL
const CONVEX_SITE_URL = env.CONVEX_SITE_URL

const canRun = !!(FAL_KEY && CONVEX_URL && CONVEX_SITE_URL)

// ── helpers ──────────────────────────────────────────────────────────────────

const TEST_MODEL = 'fal-ai/flux-1/schnell'
const TEST_PROMPT = 'a solid red circle on white background, minimal'

async function pollFalStatus(
  model: string,
  requestId: string,
  timeoutMs = 30_000,
  intervalMs = 1_000,
): Promise<Record<string, unknown>> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(
      `https://queue.fal.run/${model}/requests/${requestId}/status`,
      { headers: { Authorization: `Key ${FAL_KEY}` } },
    )
    const data = (await res.json()) as { status: string }
    if (data.status === 'COMPLETED') {
      const result = await fetch(
        `https://queue.fal.run/${model}/requests/${requestId}`,
        { headers: { Authorization: `Key ${FAL_KEY}` } },
      )
      return (await result.json()) as Record<string, unknown>
    }
    if (data.status === 'FAILED') {
      throw new Error(`fal.ai request failed: ${JSON.stringify(data)}`)
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  throw new Error(`fal.ai request timed out after ${timeoutMs}ms`)
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

// ── tests ────────────────────────────────────────────────────────────────────

describe.skipIf(!canRun)('Generation flow — integration', () => {
  let convex: ConvexHttpClient

  beforeAll(() => {
    convex = new ConvexHttpClient(CONVEX_URL!)
  })

  afterAll(() => {
    convex?.close()
  })

  // ── Test 1: fal.ai round-trip (no Convex, no webhook) ───────────────────

  it(
    'submits to FLUX schnell and gets an image URL back',
    async () => {
      // Submit to fal queue (no webhook — we poll manually)
      const submitRes = await fetch(
        `https://queue.fal.run/${TEST_MODEL}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Key ${FAL_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: TEST_PROMPT,
            image_size: 'square',
            num_images: 1,
          }),
        },
      )

      expect(submitRes.ok).toBe(true)
      const { request_id } = (await submitRes.json()) as { request_id: string }
      expect(request_id).toBeTruthy()

      // Poll until done
      const result = await pollFalStatus(TEST_MODEL, request_id)
      const images = result.images as Array<{ url: string }> | undefined

      expect(images).toBeDefined()
      expect(images!.length).toBeGreaterThan(0)
      expect(images![0].url).toMatch(/^https:\/\//)
    },
    { timeout: 30_000 },
  )

  // ── Test 2: Full pipeline (Convex + fal.ai + webhook) ───────────────────

  it(
    'creates generation in Convex → submits to fal with webhook → generation completes',
    async () => {
      // 1. Create a test generation record in Convex
      const generationId = await convex.mutation(
        api.testing.createTestGeneration,
        {
          contentType: 'image',
          modelId: TEST_MODEL,
          prompt: TEST_PROMPT,
        },
      )
      expect(generationId).toBeTruthy()

      // 2. Verify initial status is 'submitted'
      const initial = await convex.query(api.generations.get, {
        id: generationId,
      })
      expect(initial?.status).toBe('submitted')

      // 3. Submit to fal.ai WITH webhook pointing to Convex
      const webhookUrl = `${CONVEX_SITE_URL}/fal/webhook`
      const submitRes = await fetch(
        `https://queue.fal.run/${TEST_MODEL}?fal_webhook=${encodeURIComponent(webhookUrl)}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Key ${FAL_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: TEST_PROMPT,
            image_size: 'square',
            num_images: 1,
          }),
        },
      )

      expect(submitRes.ok).toBe(true)
      const { request_id } = (await submitRes.json()) as { request_id: string }

      // 4. Link the fal request ID to the generation
      await convex.mutation(api.generations.setFalRequestId, {
        id: generationId,
        falRequestId: request_id,
      })

      // Verify status moved to 'processing'
      const processing = await convex.query(api.generations.get, {
        id: generationId,
      })
      expect(processing?.status).toBe('processing')

      // 5. Wait for the webhook to complete the generation
      const completed = await pollConvexGeneration(convex, generationId)

      expect(completed.status).toBe('completed')
      expect(completed.resultUrl).toBeTruthy()
      expect(completed.resultUrl).toMatch(/^https:\/\//)
      expect(completed.completedAt).toBeGreaterThan(0)

      // 6. Clean up
      await convex.mutation(api.testing.deleteTestGeneration, {
        id: generationId,
      })
    },
    { timeout: 60_000 },
  )
})
