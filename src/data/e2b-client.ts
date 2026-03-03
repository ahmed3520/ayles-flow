import { Sandbox } from 'e2b'

import type { SandboxInfo } from '@/types/coding-agent'

import { getTemplate, isConvexTemplate } from '@/config/e2bTemplates'

const DEFAULT_TIMEOUT_MS = 60 * 60 * 1000 // 1 hour

export async function createSandbox(
  templateName: string,
  envVars?: Record<string, string>,
): Promise<{ sandbox: Sandbox; info: SandboxInfo }> {
  const apiKey = process.env.E2B_API_KEY
  if (!apiKey) {
    throw new Error('E2B_API_KEY environment variable is not configured')
  }

  const template = getTemplate(templateName)
  if (!template) {
    throw new Error(`Unknown E2B template: ${templateName}`)
  }

  // Check for Convex credentials BEFORE creating sandbox (avoids wasting E2B resources)
  if (isConvexTemplate(templateName) && (!process.env.CONVEX_TEAM_ID || !process.env.CONVEX_TEAM_TOKEN)) {
    throw new Error(
      'CONVEX_TEAM_ID and CONVEX_TEAM_TOKEN are required for Convex templates. Use vite-express instead for fullstack apps.',
    )
  }

  const sandbox = await Sandbox.create(template.id, {
    timeoutMs: DEFAULT_TIMEOUT_MS,
    envs: envVars,
    apiKey,
  })

  // Convex templates need runtime provisioning
  if (isConvexTemplate(templateName)) {
    await provisionConvex(sandbox, template.workdir)
  }

  const info: SandboxInfo = {
    sandboxId: sandbox.sandboxId,
    templateName,
    templateId: template.id,
  }

  return { sandbox, info }
}

export async function reconnectSandbox(
  sandboxId: string,
): Promise<{ sandbox: Sandbox; info: SandboxInfo }> {
  const apiKey = process.env.E2B_API_KEY
  if (!apiKey) {
    throw new Error('E2B_API_KEY environment variable is not configured')
  }

  const sandbox = await Sandbox.connect(sandboxId, { apiKey })

  const info: SandboxInfo = {
    sandboxId: sandbox.sandboxId,
    templateName: 'unknown',
    templateId: '',
  }

  return { sandbox, info }
}

export async function killSandbox(sandboxId: string): Promise<void> {
  const apiKey = process.env.E2B_API_KEY
  if (!apiKey) return
  await Sandbox.kill(sandboxId, { apiKey })
}

export function getPreviewUrl(sandbox: Sandbox, port: number): string {
  const host = sandbox.getHost(port)
  return `https://${host}`
}

// --- Convex provisioning ---

const CONVEX_API = 'https://api.convex.dev/v1'

async function provisionConvex(sandbox: Sandbox, workdir: string) {
  const teamId = process.env.CONVEX_TEAM_ID
  const teamToken = process.env.CONVEX_TEAM_TOKEN
  if (!teamId || !teamToken) {
    throw new Error('CONVEX_TEAM_ID and CONVEX_TEAM_TOKEN are required for Convex templates')
  }

  const headers = {
    Authorization: `Bearer ${teamToken}`,
    'Content-Type': 'application/json',
  }

  // 1. Create a new Convex project + dev deployment via Management API
  const projectName = `sandbox-${Date.now()}`
  const createRes = await fetch(`${CONVEX_API}/teams/${teamId}/create_project`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ projectName, deploymentType: 'dev' }),
  })

  if (!createRes.ok) {
    const body = await createRes.text()
    throw new Error(`Convex project creation failed (${createRes.status}): ${body}`)
  }

  const project = (await createRes.json()) as {
    projectId: number
    deploymentName?: string
    deploymentUrl?: string
  }

  if (!project.deploymentName) {
    throw new Error('Convex project created but no deployment was provisioned')
  }

  // 2. Create a deploy key for the deployment
  const keyRes = await fetch(`${CONVEX_API}/deployments/${project.deploymentName}/create_deploy_key`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: 'sandbox-deploy' }),
  })

  if (!keyRes.ok) {
    const body = await keyRes.text()
    throw new Error(`Convex deploy key creation failed (${keyRes.status}): ${body}`)
  }

  const { deployKey } = (await keyRes.json()) as { deployKey: string }

  // 3. Build the deployment URL from the deployment name
  const deploymentUrl = project.deploymentUrl || `https://${project.deploymentName}.convex.cloud`

  // 4. Write .env.local with Convex credentials
  const envContent = [
    `CONVEX_DEPLOYMENT=${project.deploymentName}`,
    `CONVEX_DEPLOY_KEY=${deployKey}`,
    `NEXT_PUBLIC_CONVEX_URL=${deploymentUrl}`,
    `VITE_CONVEX_URL=${deploymentUrl}`,
  ].join('\n')

  await sandbox.files.write(`${workdir}/.env.local`, envContent)

  // 5. Run convex dev --once to push schema and generate _generated/ folder
  await sandbox.commands.run(`CONVEX_DEPLOY_KEY="${deployKey}" npx convex dev --once`, {
    cwd: workdir,
    timeoutMs: 60_000,
  })
}
