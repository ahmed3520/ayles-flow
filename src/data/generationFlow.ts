import type { Edge, Node } from '@xyflow/react'

import type { BlockNodeData } from '@/types/nodes'
import {
  GENERATABLE_CONTENT_TYPES,
  OPENROUTER_CONTENT_TYPES,
} from '@/types/nodes'
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
  submitTextGeneration: (args: {
    generationId: string
  }) => Promise<void>
}

export type GenerationCallbacks = {
  onUpdate: (updates: Partial<BlockNodeData>) => void
  onLock: () => void
  onUnlock: () => void
}

/**
 * Checks if any incoming media connections (image, video, audio) point to
 * source nodes that haven't completed generation yet (no resultUrl).
 * Returns info about missing upstream nodes so we can show a clear error.
 */
function getMissingUpstreamInputs(
  nodeId: string,
  edges: Edge[],
  getNode: (id: string) => Node | undefined,
): Array<{ id: string; label: string }> {
  const missing: Array<{ id: string; label: string }> = []

  for (const edge of edges) {
    if (edge.target !== nodeId || !edge.targetHandle) continue
    const inputType = edge.targetHandle.replace('input-', '')
    if (inputType === 'text') continue // text inputs use prompt, not resultUrl
    const srcNode = getNode(edge.source)
    if (!srcNode) continue
    const srcData = srcNode.data as BlockNodeData
    if (!srcData.resultUrl) {
      missing.push({ id: srcNode.id, label: srcData.label || srcNode.id })
    }
  }

  return missing
}

/**
 * Core generation pipeline.
 * Routes to FAL for media types and OpenRouter (streaming) for text types.
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

  if (!GENERATABLE_CONTENT_TYPES.includes(blockData.contentType)) return false

  const connectedInputs = resolveConnectedInputs(
    sourceNodeId,
    deps.edges,
    deps.getNode,
  )
  const effectivePrompt = connectedInputs['text'] || blockData.prompt
  if (!effectivePrompt.trim()) return false

  // Check for incoming media connections whose source nodes haven't generated yet.
  // Without this, FAL rejects the request with "image_url: field required" etc.
  const missingUpstream = getMissingUpstreamInputs(
    sourceNodeId,
    deps.edges,
    deps.getNode,
  )
  if (missingUpstream.length > 0) {
    const names = missingUpstream.map((m) => `"${m.label}"`).join(', ')
    callbacks.onUpdate({
      generationStatus: 'error',
      errorMessage: `Generate ${names} first — this node needs ${missingUpstream.length === 1 ? 'its' : 'their'} output as input.`,
    })
    return false
  }

  callbacks.onLock()

  callbacks.onUpdate({
    generationStatus: 'generating',
    generationId: undefined,
    resultUrl: undefined,
    resultText: undefined,
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

    if (OPENROUTER_CONTENT_TYPES.includes(blockData.contentType)) {
      // Text generation — fires Convex action, result comes back reactively
      await deps.submitTextGeneration({ generationId })
    } else {
      // Media generation via FAL — async with webhook
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
    }

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
