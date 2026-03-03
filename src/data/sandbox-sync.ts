import { createServerFn } from '@tanstack/react-start'

import { LLM_SERVER_URL } from '@/config/llm'

// --- Reconnect or Restore (thin proxy to Python server) ---

export const reconnectOrRestore = createServerFn({ method: 'POST' })
  .inputValidator((data: { sandboxId?: string; projectId: string; templateName?: string }) => data)
  .handler(async ({ data }) => {
    const response = await fetch(`${LLM_SERVER_URL}/v1/sandbox/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sandbox_id: data.sandboxId,
        project_id: data.projectId,
        template_name: data.templateName,
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Restore error ${response.status}: ${text}`)
    }

    return new Response(response.body, {
      headers: { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-cache' },
    })
  })

// --- Deploy to Vercel (thin proxy to Python server) ---

export const deployToVercel = createServerFn({ method: 'POST' })
  .inputValidator(
    (data: { sandboxId: string; projectName: string; envVars?: Record<string, string> }) => data,
  )
  .handler(async ({ data }) => {
    const response = await fetch(`${LLM_SERVER_URL}/v1/deploy/vercel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sandbox_id: data.sandboxId,
        project_name: data.projectName,
        env_vars: data.envVars,
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Deploy error ${response.status}: ${text}`)
    }

    return new Response(response.body, {
      headers: { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-cache' },
    })
  })

// --- Full sync (thin proxy to Python server) ---

export const fullSync = createServerFn({ method: 'POST' })
  .inputValidator((data: { sandboxId: string; projectId: string; templateName: string }) => data)
  .handler(async ({ data }) => {
    const response = await fetch(`${LLM_SERVER_URL}/v1/sandbox/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sandbox_id: data.sandboxId,
        project_id: data.projectId,
        template_name: data.templateName,
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Sync error ${response.status}: ${text}`)
    }

    return response.json()
  })

// --- Download project (thin proxy to Python server) ---

export const downloadProject = createServerFn({ method: 'POST' })
  .inputValidator((data: { sandboxId: string; projectName: string }) => data)
  .handler(async ({ data }) => {
    const response = await fetch(`${LLM_SERVER_URL}/v1/sandbox/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sandbox_id: data.sandboxId,
        project_name: data.projectName,
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Download error ${response.status}: ${text}`)
    }

    return response.json()
  })
