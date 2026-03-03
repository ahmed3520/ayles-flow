import { readFileSync } from 'fs'
import { resolve } from 'path'
import { beforeAll, describe, expect, it } from 'vitest'

// Load .env.local
function loadEnv(): Record<string, string> {
  try {
    const content = readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8')
    const env: Record<string, string> = {}
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIndex = trimmed.indexOf('=')
      if (eqIndex === -1) continue
      env[trimmed.slice(0, eqIndex).trim()] = trimmed.slice(eqIndex + 1).trim().replace(/^["']|["']$/g, '')
    }
    return env
  } catch {
    return {}
  }
}

const env = loadEnv()
Object.assign(process.env, env)

const isIntegration = process.env.INTEGRATION === 'true'

import {
  r2Put,
  r2Get,
  r2Delete,
  r2ListFiles,
  r2PutMeta,
  r2GetMeta,
} from '@/data/r2-client'

const TEST_PROJECT_ID = `test-${Date.now()}`

describe.skipIf(!isIntegration)('R2 integration', () => {
  beforeAll(() => {
    if (!env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
      throw new Error('R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY must be set in .env.local')
    }
  })

  it('puts and gets a file', async () => {
    const content = `// test file created at ${Date.now()}`
    await r2Put(TEST_PROJECT_ID, 'src/test.ts', content)

    const result = await r2Get(TEST_PROJECT_ID, 'src/test.ts')
    expect(result).toBe(content)
  })

  it('lists files', async () => {
    // Put a second file
    await r2Put(TEST_PROJECT_ID, 'package.json', '{"name":"test"}')

    const files = await r2ListFiles(TEST_PROJECT_ID)
    expect(files).toContain('src/test.ts')
    expect(files).toContain('package.json')
  })

  it('puts and gets meta', async () => {
    const meta = { templateName: 'vite', lastSync: Date.now() }
    await r2PutMeta(TEST_PROJECT_ID, meta)

    const result = await r2GetMeta(TEST_PROJECT_ID)
    expect(result).toEqual(meta)
  })

  it('returns null for nonexistent file', async () => {
    const result = await r2Get(TEST_PROJECT_ID, 'does-not-exist.ts')
    expect(result).toBeNull()
  })

  it('deletes a file', async () => {
    await r2Delete(TEST_PROJECT_ID, 'src/test.ts')

    const result = await r2Get(TEST_PROJECT_ID, 'src/test.ts')
    expect(result).toBeNull()
  })

  // Cleanup
  it('cleans up test files', async () => {
    await r2Delete(TEST_PROJECT_ID, 'package.json')
    await r2Delete(TEST_PROJECT_ID, '_meta.json')

    const files = await r2ListFiles(TEST_PROJECT_ID)
    expect(files).toEqual([])
  })
})
