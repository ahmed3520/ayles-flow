import { readFileSync } from 'fs'
import { resolve } from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Load .env.local (same pattern as generationFlow.integration.test.ts)
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

// Mock aws4fetch before importing r2-client
const mockFetch = vi.fn()
vi.mock('aws4fetch', () => ({
  AwsClient: vi.fn().mockImplementation(() => ({ fetch: mockFetch })),
}))

import {
  r2Put,
  r2Get,
  r2Delete,
  r2ListFiles,
  r2PutMeta,
  r2GetMeta,
  toRelativePath,
} from '@/data/r2-client'

describe('toRelativePath', () => {
  it('strips default workdir prefix', () => {
    expect(toRelativePath('/home/user/app/src/App.tsx')).toBe('src/App.tsx')
  })

  it('strips custom workdir prefix', () => {
    expect(toRelativePath('/home/user/app/index.ts', '/home/user/app/')).toBe('index.ts')
  })

  it('strips ./ prefix', () => {
    expect(toRelativePath('./src/main.ts')).toBe('src/main.ts')
  })

  it('returns path as-is if no prefix matches', () => {
    expect(toRelativePath('src/utils.ts')).toBe('src/utils.ts')
  })
})

describe('r2Put', () => {
  beforeEach(() => mockFetch.mockReset())

  it('uploads file content to correct key', async () => {
    mockFetch.mockResolvedValue({ ok: true })

    await r2Put('proj-123', 'src/App.tsx', 'const App = () => {}')

    expect(mockFetch).toHaveBeenCalledOnce()
    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toContain('/projects/proj-123/src/App.tsx')
    expect(opts.method).toBe('PUT')
    expect(opts.body).toBe('const App = () => {}')
  })

  it('skips excluded paths (node_modules)', async () => {
    await r2Put('proj-123', 'node_modules/react/index.js', 'module.exports = {}')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('skips excluded paths (.git)', async () => {
    await r2Put('proj-123', '.git/HEAD', 'ref: refs/heads/main')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('skips excluded paths (dist)', async () => {
    await r2Put('proj-123', 'dist/bundle.js', 'bundled')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 })
    await expect(r2Put('proj-123', 'src/a.ts', 'x')).rejects.toThrow('R2 PUT failed (500)')
  })
})

describe('r2Get', () => {
  beforeEach(() => mockFetch.mockReset())

  it('returns file content', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve('file content') })

    const result = await r2Get('proj-123', 'src/App.tsx')
    expect(result).toBe('file content')
    const [url] = mockFetch.mock.calls[0]
    expect(url).toContain('/projects/proj-123/src/App.tsx')
  })

  it('returns null on 404', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 })
    const result = await r2Get('proj-123', 'nonexistent.ts')
    expect(result).toBeNull()
  })

  it('throws on other errors', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 403 })
    await expect(r2Get('proj-123', 'src/a.ts')).rejects.toThrow('R2 GET failed (403)')
  })
})

describe('r2Delete', () => {
  beforeEach(() => mockFetch.mockReset())

  it('sends DELETE request', async () => {
    mockFetch.mockResolvedValue({ ok: true })
    await r2Delete('proj-123', 'src/old.ts')

    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toContain('/projects/proj-123/src/old.ts')
    expect(opts.method).toBe('DELETE')
  })
})

describe('r2ListFiles', () => {
  beforeEach(() => mockFetch.mockReset())

  it('parses S3 XML response and strips prefix', async () => {
    const xml = `<?xml version="1.0"?>
      <ListBucketResult>
        <IsTruncated>false</IsTruncated>
        <Contents><Key>projects/proj-123/src/App.tsx</Key></Contents>
        <Contents><Key>projects/proj-123/src/main.ts</Key></Contents>
        <Contents><Key>projects/proj-123/package.json</Key></Contents>
        <Contents><Key>projects/proj-123/_meta.json</Key></Contents>
      </ListBucketResult>`
    mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve(xml) })

    const files = await r2ListFiles('proj-123')

    expect(files).toEqual(['src/App.tsx', 'src/main.ts', 'package.json'])
    expect(files).not.toContain('_meta.json')
  })

  it('handles pagination', async () => {
    const page1 = `<ListBucketResult>
      <IsTruncated>true</IsTruncated>
      <NextContinuationToken>abc123</NextContinuationToken>
      <Contents><Key>projects/proj-123/a.ts</Key></Contents>
    </ListBucketResult>`
    const page2 = `<ListBucketResult>
      <IsTruncated>false</IsTruncated>
      <Contents><Key>projects/proj-123/b.ts</Key></Contents>
    </ListBucketResult>`

    mockFetch
      .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(page1) })
      .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(page2) })

    const files = await r2ListFiles('proj-123')
    expect(files).toEqual(['a.ts', 'b.ts'])
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('returns empty array when no files', async () => {
    const xml = `<ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>`
    mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve(xml) })

    const files = await r2ListFiles('proj-123')
    expect(files).toEqual([])
  })
})

describe('r2PutMeta / r2GetMeta', () => {
  beforeEach(() => mockFetch.mockReset())

  it('puts meta as JSON', async () => {
    mockFetch.mockResolvedValue({ ok: true })

    await r2PutMeta('proj-123', { templateName: 'vite', lastSync: 1000 })

    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toContain('/projects/proj-123/_meta.json')
    expect(opts.method).toBe('PUT')
    expect(JSON.parse(opts.body)).toEqual({ templateName: 'vite', lastSync: 1000 })
  })

  it('gets meta', async () => {
    const meta = { templateName: 'nextjs', lastSync: 2000 }
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(meta),
    })

    const result = await r2GetMeta('proj-123')
    expect(result).toEqual(meta)
  })

  it('returns null on 404', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 })
    const result = await r2GetMeta('proj-123')
    expect(result).toBeNull()
  })
})
