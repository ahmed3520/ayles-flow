export type NodeContentType =
  | 'image'
  | 'text'
  | 'video'
  | 'audio'
  | 'music'
  | 'note'
  | 'ticket'
  | 'pdf'
  | 'website'

export type PortType = 'text' | 'image' | 'audio' | 'video' | 'pdf'

export type ModelInput = {
  name: string
  type: PortType
  required: boolean
  falParam: string
}

export type AIModel = {
  _id: string
  falId: string
  name: string
  provider: string
  contentType: string
  creditCost: number
  pricingUnit: string
  inputs: Array<ModelInput>
  outputType: PortType
}

export const PORT_TYPE_COLORS: Record<PortType, string> = {
  text: '#a1a1aa',
  image: '#60a5fa',
  audio: '#f472b6',
  video: '#a78bfa',
  pdf: '#34d399',
}

export type GenerationStatus =
  | 'idle'
  | 'generating'
  | 'completed'
  | 'error'
  | 'uploading'
  | 'uploaded'

export type BlockNodeData = {
  contentType: NodeContentType
  label: string
  prompt: string
  model: string
  generationStatus: GenerationStatus
  generationId?: string
  resultUrl?: string
  resultText?: string
  imageWidth?: number
  imageHeight?: number
  rotationDeg?: number
  flipX?: boolean
  flipY?: boolean
  errorMessage?: string
  outputType?: PortType
  // Upload-related fields
  uploadId?: string
  isUpload?: boolean
  // Website preview (E2B sandbox)
  previewUrl?: string
  sandboxId?: string
  viewportPreset?: 'desktop' | 'tablet' | 'mobile'
  // Deployment
  deploymentUrl?: string
  deploymentStatus?: 'idle' | 'deploying' | 'ready' | 'error'
  // Restore status (transient, set during sandbox restoration)
  restoreStep?: string | null
}

export const AI_CONTENT_TYPES: Array<NodeContentType> = [
  'image',
  'text',
  'video',
  'audio',
  'music',
  'pdf',
]

export const FAL_CONTENT_TYPES: Array<NodeContentType> = [
  'image',
  'video',
  'audio',
  'music',
]

export const OPENROUTER_CONTENT_TYPES: Array<NodeContentType> = ['text']

export const GENERATABLE_CONTENT_TYPES: Array<NodeContentType> = [
  ...FAL_CONTENT_TYPES,
  ...OPENROUTER_CONTENT_TYPES,
]

export const NODE_DEFAULTS: Record<
  NodeContentType,
  { width: number; height: number; minWidth: number; minHeight: number }
> = {
  image: { width: 320, height: 280, minWidth: 200, minHeight: 150 },
  text: { width: 320, height: 280, minWidth: 200, minHeight: 150 },
  video: { width: 320, height: 280, minWidth: 200, minHeight: 150 },
  audio: { width: 320, height: 180, minWidth: 200, minHeight: 120 },
  music: { width: 320, height: 180, minWidth: 200, minHeight: 120 },
  note: { width: 280, height: 260, minWidth: 180, minHeight: 120 },
  ticket: { width: 300, height: 240, minWidth: 200, minHeight: 150 },
  pdf: { width: 320, height: 400, minWidth: 200, minHeight: 200 },
  website: { width: 640, height: 480, minWidth: 320, minHeight: 280 },
}
