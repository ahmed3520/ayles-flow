import { describe, expect, it } from 'vitest'

import { createDocxDocument } from '@/utils/textExport'

async function blobToUint8Array(blob: Blob): Promise<Uint8Array> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(new Uint8Array(reader.result))
        return
      }
      reject(new Error('Failed to read blob bytes'))
    }
    reader.onerror = () => reject(reader.error || new Error('Failed to read blob bytes'))
    reader.readAsArrayBuffer(blob)
  })
}

describe('createDocxDocument', () => {
  it('creates a real docx archive with wordprocessing parts', async () => {
    const blob = await createDocxDocument(
      'The Pharaohs',
      '<h1>The Pharaohs</h1><p>Ancient Egypt story.</p>',
    )

    expect(blob.type).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    )

    const bytes = await blobToUint8Array(blob)
    const content = new TextDecoder().decode(bytes)

    expect(String.fromCharCode(bytes[0], bytes[1])).toBe('PK')
    expect(content).toContain('[Content_Types].xml')
    expect(content).toContain('word/document.xml')
    expect(content).toContain('word/styles.xml')
    expect(content).toContain('Ancient Egypt story.')
  })
})
