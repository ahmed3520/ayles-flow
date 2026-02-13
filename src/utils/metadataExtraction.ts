import type { UploadContentCategory, UploadMetadata } from '@/types/uploads'

/**
 * Extract metadata from a file based on its category
 */
export async function extractMetadata(
  file: File,
  category: UploadContentCategory,
): Promise<UploadMetadata> {
  const baseMetadata: UploadMetadata = {
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
    contentCategory: category,
  }

  try {
    switch (category) {
      case 'image':
        return await extractImageMetadata(file, baseMetadata)
      case 'audio':
        return await extractAudioMetadata(file, baseMetadata)
      case 'video':
        return await extractVideoMetadata(file, baseMetadata)
      case 'pdf':
        return baseMetadata
      default:
        return baseMetadata
    }
  } catch (error) {
    console.error('Error extracting metadata:', error)
    return baseMetadata
  }
}

/**
 * Extract image dimensions
 */
async function extractImageMetadata(
  file: File,
  baseMetadata: UploadMetadata,
): Promise<UploadMetadata> {
  return new Promise((resolve) => {
    const img = new Image()

    img.onload = () => {
      resolve({
        ...baseMetadata,
        width: img.width,
        height: img.height,
      })
      URL.revokeObjectURL(img.src)
    }

    img.onerror = () => {
      resolve(baseMetadata)
      URL.revokeObjectURL(img.src)
    }

    img.src = URL.createObjectURL(file)
  })
}

/**
 * Extract audio duration
 */
async function extractAudioMetadata(
  file: File,
  baseMetadata: UploadMetadata,
): Promise<UploadMetadata> {
  return new Promise((resolve) => {
    const audio = new Audio()

    audio.onloadedmetadata = () => {
      resolve({
        ...baseMetadata,
        duration: Math.round(audio.duration),
      })
      URL.revokeObjectURL(audio.src)
    }

    audio.onerror = () => {
      resolve(baseMetadata)
      URL.revokeObjectURL(audio.src)
    }

    audio.src = URL.createObjectURL(file)
  })
}

/**
 * Extract video duration and dimensions
 */
async function extractVideoMetadata(
  file: File,
  baseMetadata: UploadMetadata,
): Promise<UploadMetadata> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.preload = 'metadata'

    video.onloadedmetadata = () => {
      resolve({
        ...baseMetadata,
        width: video.videoWidth,
        height: video.videoHeight,
        duration: Math.round(video.duration),
      })
      URL.revokeObjectURL(video.src)
    }

    video.onerror = () => {
      resolve(baseMetadata)
      URL.revokeObjectURL(video.src)
    }

    video.src = URL.createObjectURL(file)
  })
}

/**
 * Format duration from seconds to MM:SS
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
