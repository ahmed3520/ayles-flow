import { describe, expect, it } from 'vitest'

import { MAX_FILE_SIZE } from '@/types/uploads'
import { formatFileSize, validateFile } from '@/utils/uploadValidation'

// Helper to create a mock File
function mockFile(
  name: string,
  size: number,
  type: string,
): File {
  const content = new ArrayBuffer(size)
  return new File([content], name, { type })
}

describe('validateFile', () => {
  it('accepts a valid image file', () => {
    const file = mockFile('photo.png', 1024, 'image/png')
    const result = validateFile(file, 'image')
    expect(result).toEqual({ valid: true })
  })

  it('accepts a valid audio file', () => {
    const file = mockFile('track.mp3', 5000, 'audio/mpeg')
    const result = validateFile(file, 'audio')
    expect(result).toEqual({ valid: true })
  })

  it('accepts a valid video file', () => {
    const file = mockFile('clip.mp4', 10000, 'video/mp4')
    const result = validateFile(file, 'video')
    expect(result).toEqual({ valid: true })
  })

  it('accepts a valid PDF file', () => {
    const file = mockFile('doc.pdf', 2048, 'application/pdf')
    const result = validateFile(file, 'pdf')
    expect(result).toEqual({ valid: true })
  })

  it('rejects file exceeding max size', () => {
    const file = mockFile('huge.png', MAX_FILE_SIZE + 1, 'image/png')
    const result = validateFile(file, 'image')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('File too large')
  })

  it('rejects invalid MIME type for image', () => {
    const file = mockFile('fake.bmp', 1024, 'image/bmp')
    const result = validateFile(file, 'image')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Invalid file type')
  })

  it('rejects invalid MIME type for audio', () => {
    const file = mockFile('fake.flac', 1024, 'audio/flac')
    const result = validateFile(file, 'audio')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Invalid file type')
  })
})

describe('formatFileSize', () => {
  it('formats 0 bytes', () => {
    expect(formatFileSize(0)).toBe('0 Bytes')
  })

  it('formats bytes', () => {
    expect(formatFileSize(500)).toBe('500 Bytes')
  })

  it('formats kilobytes', () => {
    expect(formatFileSize(1024)).toBe('1 KB')
  })

  it('formats megabytes', () => {
    expect(formatFileSize(1048576)).toBe('1 MB')
  })

  it('formats fractional megabytes', () => {
    expect(formatFileSize(1572864)).toBe('1.5 MB')
  })

  it('formats gigabytes', () => {
    expect(formatFileSize(1073741824)).toBe('1 GB')
  })
})
