import type { Edge, Node } from '@xyflow/react'

import type { BlockNodeData } from '@/types/nodes'
import { FAL_CONTENT_TYPES } from '@/types/nodes'
import { resolveConnectedInputs } from '@/utils/canvasUtils'

export type GenerationDeps = {
  getNode: (id: string) => Node | undefined
  edges: Edge[]
  createGeneration: (args: {
    contentType: string
    modelId: string
    prompt: string
  }) => Promise<string>
  submitToFal: (args: {
    data: {
      model: string
      prompt: string
      contentType: string
      imageUrl?: string
      audioUrl?: string
      videoUrl?: string
    }
  }) => Promise<{ requestId: string }>
  setFalRequestId: (args: {
    id: string
    falRequestId: string
  }) => Promise<void>
}

export type GenerationCallbacks = {
  onUpdate: (updates: Partial<BlockNodeData>) => void
  onLock: () => void
  onUnlock: () => void
}

/**
 * Core generation pipeline extracted from Canvas.handleGenerate.
 * Returns true if generation was initiated, false if it was skipped.
 */
export async function executeGeneration(
  sourceNodeId: string,
  deps: GenerationDeps,
  callbacks: GenerationCallbacks,
): Promise<boolean> {
  const sourceNode = deps.getNode(sourceNodeId)
  if (!sourceNode || sourceNode.type !== 'blockNode') return false

  const blockData = sourceNode.data as BlockNodeData

  if (!FAL_CONTENT_TYPES.includes(blockData.contentType)) return false

  const connectedInputs = resolveConnectedInputs(
    sourceNodeId,
    deps.edges,
    deps.getNode,
  )
  const effectivePrompt = connectedInputs['text'] || blockData.prompt
  if (!effectivePrompt.trim()) return false

  callbacks.onLock()

  callbacks.onUpdate({
    generationStatus: 'generating',
    generationId: undefined,
    resultUrl: undefined,
    imageWidth: undefined,
    imageHeight: undefined,
    errorMessage: undefined,
  })

  try {
    const generationId = await deps.createGeneration({
      contentType: blockData.contentType,
      modelId: blockData.model,
      prompt: effectivePrompt,
    })

    callbacks.onUpdate({ generationId })

    const { requestId } = await deps.submitToFal({
      data: {
        model: blockData.model,
        prompt: effectivePrompt,
        contentType: blockData.contentType,
        imageUrl: connectedInputs['image'],
        audioUrl: connectedInputs['audio'],
        videoUrl: connectedInputs['video'],
      },
    })

    await deps.setFalRequestId({
      id: generationId,
      falRequestId: requestId,
    })

    return true
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Generation failed'
    const isCreditsError = message.includes('Insufficient credits')
    callbacks.onUpdate({
      generationStatus: 'error',
      errorMessage: isCreditsError
        ? 'Out of credits. Upgrade your plan to continue.'
        : message,
    })
    return false
  } finally {
    callbacks.onUnlock()
  }
}
