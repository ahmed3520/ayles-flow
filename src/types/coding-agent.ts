// --- Coding Agent Types ---

export type CodingAgentPersona = 'frontend' | 'backend' | 'tester'

// --- E2B Templates ---

export type TemplateConfig = {
  id: string
  name: string
  category: 'frontend' | 'backend' | 'fullstack' | 'base'
  defaultPort: number
  workdir: string
  devCmd: string
  convex?: boolean
}

// --- Sandbox ---

export type SandboxInfo = {
  sandboxId: string
  templateName: string
  templateId: string
  previewUrl?: string
}

// --- Tool Execution ---

export type ToolResult = {
  success: boolean
  result: unknown
  error?: string
  validationError?: boolean
  expired?: boolean
}

export type BackgroundProcess = {
  pid: number
  command: string
  name: string
  logFile: string
  cwd: string
}

export type CodingToolContext = {
  backgroundProcesses: Map<string, BackgroundProcess>
  write: (event: Record<string, unknown>) => Promise<void>
  lspPort: number | null
  projectId: string
  workdir: string
}

// --- Stream Events ---

export type FileChangeEvent = {
  type: 'file_change'
  path: string
  action: 'create' | 'update' | 'delete'
}

export type TerminalOutputEvent = {
  type: 'terminal_output'
  content: string
  stream: 'stdout' | 'stderr'
}

export type PreviewUrlEvent = {
  type: 'preview_url'
  url: string
  port: number
}

export type SandboxStatusEvent = {
  type: 'sandbox_status'
  status: 'creating' | 'ready' | 'error' | 'killed'
  sandboxId?: string
  templateName?: string
}

export type SkillLoadedEvent = {
  type: 'skill_loaded'
  name: string
}

export type AgentStartEvent = {
  type: 'agent_start'
  persona: CodingAgentPersona
}

export type AgentDoneEvent = {
  type: 'agent_done'
  persona: CodingAgentPersona
}

export type CodingStreamEvent =
  | FileChangeEvent
  | TerminalOutputEvent
  | PreviewUrlEvent
  | SandboxStatusEvent
  | SkillLoadedEvent
  | AgentStartEvent
  | AgentDoneEvent
  | { type: 'text_delta'; content: string }
  | { type: 'tool_call'; tool: string; label: string }
  | { type: 'tool_status'; tool: string; status: string }
  | { type: 'done' }
  | { type: 'error'; message: string }

// --- Server Function Inputs ---

export type CodingAgentInput = {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  sandboxId: string
  projectId: string
  persona: CodingAgentPersona
  agentModel?: string
  templateName?: string
}

export type OrchestratorInput = {
  userMessage: string
  agentModel?: string
  sandboxId?: string // reconnect to existing sandbox
}

export type OrchestratorPlan = {
  templateName: string
  projectSpec: string
  agents: CodingAgentPersona[]
}
