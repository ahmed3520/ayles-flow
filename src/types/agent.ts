import type { NodeContentType, PortType } from './nodes'

// --- Agent Actions (canvas modifications) ---

export type AddNodeAction = {
  type: 'add_node'
  nodeId: string
  contentType: NodeContentType
  prompt?: string
  model?: string
  label?: string
  x: number
  y: number
  previewUrl?: string
  sandboxId?: string
}

export type ConnectNodesAction = {
  type: 'connect_nodes'
  edgeId: string
  sourceNodeId: string
  targetNodeId: string
  portType: PortType
}

export type UpdateNodeAction = {
  type: 'update_node'
  nodeId: string
  prompt?: string
  model?: string
  label?: string
}

export type DeleteNodesAction = {
  type: 'delete_nodes'
  nodeIds: Array<string>
}

export type ClearCanvasAction = {
  type: 'clear_canvas'
}

export type CreatePdfAction = {
  type: 'create_pdf'
  title: string
  markdown: string
  sources: Array<{ title: string; url: string }>
  x: number
  y: number
}

export type AgentAction =
  | AddNodeAction
  | ConnectNodesAction
  | UpdateNodeAction
  | DeleteNodesAction
  | ClearCanvasAction
  | CreatePdfAction

// --- Message Parts (ordered segments within an assistant message) ---

export type TextPart = { type: 'text'; content: string }
export type ReasoningPart = { type: 'reasoning'; content: string }
export type ActionPart = { type: 'action'; action: AgentAction }
export type ToolCallPart = { type: 'tool_call'; tool: string; args: Record<string, unknown>; status?: 'pending' | 'done'; error?: boolean }
export type ResourcesPart = {
  type: 'resources'
  sources: Array<{ title: string; url: string }>
}
export type MessagePart =
  | TextPart
  | ReasoningPart
  | ActionPart
  | ToolCallPart
  | ResourcesPart

// --- Chat Messages ---

export type ChatMessage = {
  id?: string
  role: 'user' | 'assistant'
  content: string
  actions?: Array<AgentAction>
  parts?: Array<MessagePart>
  createdAt?: number
}

// --- Stream Events (SSE from server) ---

export type TextDeltaEvent = {
  type: 'text_delta'
  content: string
}

export type ActionEvent = {
  type: 'action'
  action: AgentAction
}

export type ToolStartEvent = {
  type: 'tool_start'
  tool: string
  args: Record<string, unknown>
}

export type ToolCallEvent = {
  type: 'tool_call'
  tool: string
  args: Record<string, unknown>
  error?: boolean
}

export type ResourcesEvent = {
  type: 'resources'
  sources: Array<{ title: string; url: string }>
}

export type ReasoningEvent = {
  type: 'reasoning'
  content: string
}

export type DoneEvent = {
  type: 'done'
}

export type ErrorEvent = {
  type: 'error'
  message: string
}

export type ToolStatusEvent = {
  type: 'tool_status'
  tool: string
  status: string
}

export type StreamEvent =
  | TextDeltaEvent
  | ReasoningEvent
  | ActionEvent
  | ToolStartEvent
  | ToolCallEvent
  | ResourcesEvent
  | ToolStatusEvent
  | DoneEvent
  | ErrorEvent

// --- Context sent to server ---

export type CanvasNode = {
  id: string
  contentType: NodeContentType
  label: string
  prompt: string
  model: string
  generationStatus: string
  resultUrl?: string
  x: number
  y: number
}

export type CanvasEdge = {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
}

export type AvailableModel = {
  falId: string
  name: string
  provider: string
  contentType: string
  inputs: Array<{ name: string; type: string; required: boolean }>
  outputType: string
}

export type AgentChatInput = {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  canvasState: {
    nodes: Array<CanvasNode>
    edges: Array<CanvasEdge>
  }
  models: Array<AvailableModel>
  agentModel?: string
  projectId: string
}
