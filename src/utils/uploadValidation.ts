import type { UploadContentCategory } from '@/types/uploads'
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from '@/types/uploads'

type ValidationResult = {
  valid: boolean
  error?: string
}

/**
 * Validate file size and MIME type
 */
export function validateFile(
  file: File,
  category: UploadContentCategory,
): ValidationResult {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    }
  }

  // Check MIME type
  const allowedTypes = ALLOWED_MIME_TYPES[category]
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed: ${allowedTypes.join(', ')}`,
    }
  }

  return { valid: true }
}

/**
 * Validate image file with dimension checks
 */
export async function validateImage(file: File): Promise<ValidationResult> {
  // First check basic file validation
  const basicValidation = validateFile(file, 'image')
  if (!basicValidation.valid) {
    return basicValidation
  }

  return new Promise((resolve) => {
    const img = new Image()

    img.onload = () => {
      // Check dimensions (max 8192x8192)
      if (img.width > 8192 || img.height > 8192) {
        resolve({
          valid: false,
          error: 'Image dimensions too large (max 8192x8192)',
        })
      } else {
        resolve({ valid: true })
      }
      URL.revokeObjectURL(img.src)
    }

    img.onerror = () => {
      resolve({ valid: false, error: 'Invalid image file' })
      URL.revokeObjectURL(img.src)
    }

    img.src = URL.createObjectURL(file)
  })
}

/**
 * Get human-readable file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}
