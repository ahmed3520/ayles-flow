export type NodeContentType =
  | 'image'
  | 'text'
  | 'video'
  | 'audio'
  | 'music'
  | 'note'
  | 'ticket'
  | 'pdf'

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
  imageWidth?: number
  imageHeight?: number
  errorMessage?: string
  outputType?: PortType
  // Upload-related fields
  uploadId?: string
  isUpload?: boolean
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
