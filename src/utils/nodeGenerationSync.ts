import type { BlockNodeData } from '@/types/nodes'

type GenerationSnapshot = {
  status: string
  resultUrl?: string
  resultText?: string
  resultMeta?: { width?: number; height?: number } | null
  errorMessage?: string
}

export function getGenerationSyncUpdate(
  data: BlockNodeData,
  generation: GenerationSnapshot | null | undefined,
): Partial<BlockNodeData> | null {
  if (!generation) return null

  if (generation.status === 'completed') {
    const nextResultUrl = generation.resultUrl ?? undefined
    const nextResultText = generation.resultText ?? undefined

    if (!nextResultUrl && !nextResultText) {
      return null
    }

    const hasLocalResult = Boolean(data.resultUrl || data.resultText)
    const localResultDiffers =
      data.resultUrl !== nextResultUrl || data.resultText !== nextResultText

    // Manual edits or replacements should win over a stale generation record.
    if (
      hasLocalResult &&
      localResultDiffers &&
      data.generationStatus !== 'generating'
    ) {
      return data.generationId ? { generationId: undefined } : null
    }

    const meta = generation.resultMeta ?? undefined

    return {
      generationStatus: 'completed',
      generationId: undefined,
      resultUrl: nextResultUrl,
      resultText: nextResultText,
      imageWidth: meta?.width,
      imageHeight: meta?.height,
      errorMessage: undefined,
    }
  }

  if (generation.status === 'error') {
    return {
      generationStatus: 'error',
      generationId: undefined,
      errorMessage: generation.errorMessage || 'Generation failed',
    }
  }

  return null
}
