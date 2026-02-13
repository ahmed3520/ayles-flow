import type { BlockNodeData } from '@/types/nodes'

const CONTENT_TYPE_EXTENSIONS: Record<string, string> = {
  image: 'png',
  video: 'mp4',
  audio: 'wav',
  music: 'wav',
  pdf: 'pdf',
}

export async function downloadNodeResult(data: BlockNodeData) {
  if (!data.resultUrl) return

  const ext = CONTENT_TYPE_EXTENSIONS[data.contentType] ?? 'bin'
  const filename = `${data.contentType}-${Date.now()}.${ext}`

  try {
    const response = await fetch(data.resultUrl)
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch {
    // Fallback: open in new tab
    window.open(data.resultUrl, '_blank')
  }
}
