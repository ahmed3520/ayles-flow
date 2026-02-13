export type UploadContentCategory = 'image' | 'audio' | 'video' | 'pdf'

export type UploadState = {
  status: 'idle' | 'uploading' | 'processing' | 'completed' | 'error'
  progress: number
  errorMessage?: string
}

export type UploadMetadata = {
  fileName: string
  fileType: string
  fileSize: number
  contentCategory: UploadContentCategory
  width?: number
  height?: number
  duration?: number
}

export const ALLOWED_MIME_TYPES: Record<UploadContentCategory, string[]> = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4'],
  video: ['video/mp4', 'video/webm', 'video/quicktime'],
  pdf: ['application/pdf'],
}

export const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB in bytes
