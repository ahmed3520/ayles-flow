import { AwsClient } from 'aws4fetch'

// --- R2 S3-compatible API client ---

export type ProjectMeta = {
  templateName: string
  lastSync: number
  envVars?: Record<string, string>
}

const EXCLUDED_PREFIXES = [
  'node_modules/',
  '.git/',
  'dist/',
  '.next/',
  'build/',
  '__pycache__/',
  '.cache/',
  '.turbo/',
]

function isExcluded(path: string): boolean {
  return EXCLUDED_PREFIXES.some((p) => path.startsWith(p))
}

function getClient() {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  const accountId = process.env.CF_ACCOUNT_ID
  const bucket = process.env.R2_BUCKET_NAME

  if (!accountId || !bucket) {
    throw new Error('CF_ACCOUNT_ID and R2_BUCKET_NAME are required')
  }

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY are required')
  }

  return {
    client: new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto' }),
    base: `https://${accountId}.r2.cloudflarestorage.com/${bucket}`,
  }
}

// --- File operations ---

export async function r2Put(projectId: string, relativePath: string, content: string): Promise<void> {
  if (isExcluded(relativePath)) return
  const { client, base } = getClient()
  const url = `${base}/projects/${projectId}/${relativePath}`
  console.log(`[r2] PUT ${relativePath} (${content.length} bytes) → ${url}`)
  const res = await client.fetch(url, {
    method: 'PUT',
    body: content,
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`R2 PUT failed (${res.status}): ${body}`)
  }
  console.log(`[r2] PUT ${relativePath} OK`)
}

export async function r2Get(projectId: string, relativePath: string): Promise<string | null> {
  const { client, base } = getClient()
  const res = await client.fetch(`${base}/projects/${projectId}/${relativePath}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`R2 GET failed (${res.status})`)
  return res.text()
}

export async function r2Delete(projectId: string, relativePath: string): Promise<void> {
  const { client, base } = getClient()
  await client.fetch(`${base}/projects/${projectId}/${relativePath}`, { method: 'DELETE' })
}

export async function r2ListFiles(projectId: string): Promise<string[]> {
  const { client, base } = getClient()
  const prefix = `projects/${projectId}/`
  const files: string[] = []
  let token: string | undefined

  do {
    const params = new URLSearchParams({ 'list-type': '2', prefix, 'max-keys': '1000' })
    if (token) params.set('continuation-token', token)

    const res = await client.fetch(`${base.split('/').slice(0, -1).join('/')}/${base.split('/').pop()}?${params}`)
    if (!res.ok) throw new Error(`R2 LIST failed (${res.status})`)

    const xml = await res.text()
    for (const m of xml.matchAll(/<Key>([^<]+)<\/Key>/g)) {
      const rel = m[1].slice(prefix.length)
      if (rel && rel !== '_meta.json') files.push(rel)
    }

    token = xml.includes('<IsTruncated>true')
      ? xml.match(/<NextContinuationToken>([^<]+)/)?.[1]
      : undefined
  } while (token)

  return files
}

// --- Metadata ---

export async function r2PutMeta(projectId: string, meta: ProjectMeta): Promise<void> {
  const { client, base } = getClient()
  await client.fetch(`${base}/projects/${projectId}/_meta.json`, {
    method: 'PUT',
    body: JSON.stringify(meta),
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function r2GetMeta(projectId: string): Promise<ProjectMeta | null> {
  const { client, base } = getClient()
  const res = await client.fetch(`${base}/projects/${projectId}/_meta.json`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`R2 GET meta failed (${res.status})`)
  return res.json() as Promise<ProjectMeta>
}

// --- Path helper ---

const DEFAULT_WORKDIR = '/home/user/app/'

export function toRelativePath(absolutePath: string, workdir = DEFAULT_WORKDIR): string {
  if (absolutePath.startsWith(workdir)) return absolutePath.slice(workdir.length)
  if (absolutePath.startsWith('./')) return absolutePath.slice(2)
  return absolutePath
}
