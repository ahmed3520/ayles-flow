import type { Edge, Node } from '@xyflow/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { BlockNodeData } from '@/types/nodes'
import {
  executeGeneration,
  type GenerationCallbacks,
  type GenerationDeps,
} from '@/data/generationFlow'

// ── helpers ──────────────────────────────────────────────────────────────────

function makeNode(
  id: string,
  data: Partial<BlockNodeData> = {},
): Node<BlockNodeData> {
  return {
    id,
    type: 'blockNode',
    position: { x: 0, y: 0 },
    data: {
      contentType: 'image',
      label: 'Test image block',
      prompt: 'a cute cat',
      model: 'fal-ai/flux-pro',
      generationStatus: 'idle',
      ...data,
    },
  }
}

function makeEdge(
  source: string,
  target: string,
  sourceHandle = 'output-text',
  targetHandle = 'input-text',
): Edge {
  return { id: `${source}-${target}`, source, target, sourceHandle, targetHandle }
}

function createMockDeps(
  nodes: Node<BlockNodeData>[],
  edges: Edge[] = [],
  overrides: Partial<GenerationDeps> = {},
): GenerationDeps {
  return {
    getNode: (id) => nodes.find((n) => n.id === id),
    edges,
    createGeneration: vi.fn().mockResolvedValue('gen-abc-123'),
    submitToFal: vi.fn().mockResolvedValue({ requestId: 'fal-req-456' }),
    setFalRequestId: vi.fn().mockResolvedValue(undefined),
    submitTextGeneration: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

function createMockCallbacks(): GenerationCallbacks & {
  updates: Array<Partial<BlockNodeData>>
} {
  const updates: Array<Partial<BlockNodeData>> = []
  return {
    updates,
    onUpdate: vi.fn((u) => updates.push(u)),
    onLock: vi.fn(),
    onUnlock: vi.fn(),
  }
}

// ── Happy path ───────────────────────────────────────────────────────────────

describe('executeGeneration — happy path', () => {
  let deps: GenerationDeps
  let callbacks: ReturnType<typeof createMockCallbacks>
  const node = makeNode('node-1')

  beforeEach(() => {
    deps = createMockDeps([node])
    callbacks = createMockCallbacks()
  })

  it('returns true when generation succeeds', async () => {
    const result = await executeGeneration('node-1', deps, callbacks)
    expect(result).toBe(true)
  })

  it('locks before starting and unlocks when done', async () => {
    await executeGeneration('node-1', deps, callbacks)
    expect(callbacks.onLock).toHaveBeenCalledOnce()
    expect(callbacks.onUnlock).toHaveBeenCalledOnce()

    // Lock before unlock
    const lockOrder = vi.mocked(callbacks.onLock).mock.invocationCallOrder[0]
    const unlockOrder = vi.mocked(callbacks.onUnlock).mock.invocationCallOrder[0]
    expect(lockOrder).toBeLessThan(unlockOrder)
  })

  it('sets status to generating and clears previous result', async () => {
    await executeGeneration('node-1', deps, callbacks)
    expect(callbacks.updates[0]).toEqual({
      generationStatus: 'generating',
      generationId: undefined,
      resultUrl: undefined,
      resultText: undefined,
      imageWidth: undefined,
      imageHeight: undefined,
      errorMessage: undefined,
    })
  })

  it('calls createGeneration with correct args', async () => {
    await executeGeneration('node-1', deps, callbacks)
    expect(deps.createGeneration).toHaveBeenCalledWith({
      contentType: 'image',
      modelId: 'fal-ai/flux-pro',
      prompt: 'a cute cat',
    })
  })

  it('updates node with generationId after creation', async () => {
    await executeGeneration('node-1', deps, callbacks)
    expect(callbacks.updates[1]).toEqual({ generationId: 'gen-abc-123' })
  })

  it('submits to fal with correct model and prompt', async () => {
    await executeGeneration('node-1', deps, callbacks)
    expect(deps.submitToFal).toHaveBeenCalledWith({
      data: {
        model: 'fal-ai/flux-pro',
        prompt: 'a cute cat',
        contentType: 'image',
        imageUrl: undefined,
        audioUrl: undefined,
        videoUrl: undefined,
      },
    })
  })

  it('links fal request ID to generation', async () => {
    await executeGeneration('node-1', deps, callbacks)
    expect(deps.setFalRequestId).toHaveBeenCalledWith({
      id: 'gen-abc-123',
      falRequestId: 'fal-req-456',
    })
  })

  it('calls mutations in the correct order', async () => {
    await executeGeneration('node-1', deps, callbacks)

    const createOrder = vi.mocked(deps.createGeneration).mock.invocationCallOrder[0]
    const submitOrder = vi.mocked(deps.submitToFal).mock.invocationCallOrder[0]
    const linkOrder = vi.mocked(deps.setFalRequestId).mock.invocationCallOrder[0]

    expect(createOrder).toBeLessThan(submitOrder)
    expect(submitOrder).toBeLessThan(linkOrder)
  })
})

// ── OpenRouter text generation ──────────────────────────────────────────────

describe('executeGeneration — OpenRouter text generation', () => {
  it('routes text content type to OpenRouter instead of FAL', async () => {
    const node = makeNode('node-1', {
      contentType: 'text',
      prompt: 'Write a poem about space',
      model: 'anthropic/claude-sonnet-4.6',
    })
    const deps = createMockDeps([node])
    const callbacks = createMockCallbacks()

    const result = await executeGeneration('node-1', deps, callbacks)

    expect(result).toBe(true)
    expect(deps.submitToOpenRouter).toHaveBeenCalledWith({
      data: {
        model: 'anthropic/claude-sonnet-4.6',
        prompt: 'Write a poem about space',
      },
      onDelta: expect.any(Function),
    })
    expect(deps.submitToFal).not.toHaveBeenCalled()
    expect(deps.setFalRequestId).not.toHaveBeenCalled()
  })

  it('calls completeTextGeneration with the generated text', async () => {
    const node = makeNode('node-1', {
      contentType: 'text',
      prompt: 'Hello',
      model: 'google/gemini-3-flash-preview',
    })
    const deps = createMockDeps([node])
    const callbacks = createMockCallbacks()

    await executeGeneration('node-1', deps, callbacks)

    expect(deps.completeTextGeneration).toHaveBeenCalledWith({
      generationId: 'gen-abc-123',
      resultText: 'Generated text response',
      inputTokens: 100,
      outputTokens: 50,
    })
  })

  it('streams text deltas via onDelta callback', async () => {
    const node = makeNode('node-1', {
      contentType: 'text',
      prompt: 'Hello',
      model: 'google/gemini-3-flash-preview',
    })
    const deltas: string[] = []
    const deps = createMockDeps([node], [], {
      submitToOpenRouter: vi.fn().mockImplementation(async ({ onDelta }) => {
        onDelta('Hello')
        onDelta('Hello world')
        deltas.push('tracked')
        return { text: 'Hello world', usage: { inputTokens: 10, outputTokens: 20 } }
      }),
    })
    const callbacks = createMockCallbacks()

    await executeGeneration('node-1', deps, callbacks)

    // onDelta should have caused onUpdate calls with progressive resultText
    const textUpdates = callbacks.updates.filter((u) => u.resultText !== undefined && !u.generationStatus)
    expect(textUpdates.length).toBe(2)
    expect(textUpdates[0].resultText).toBe('Hello')
    expect(textUpdates[1].resultText).toBe('Hello world')
  })

  it('updates node with completed status and resultText', async () => {
    const node = makeNode('node-1', {
      contentType: 'text',
      prompt: 'Hello',
      model: 'google/gemini-3-flash-preview',
    })
    const deps = createMockDeps([node])
    const callbacks = createMockCallbacks()

    await executeGeneration('node-1', deps, callbacks)

    const completedUpdate = callbacks.updates.find(
      (u) => u.generationStatus === 'completed',
    )
    expect(completedUpdate).toEqual({
      generationStatus: 'completed',
      resultText: 'Generated text response',
    })
  })

  it('sets error status when submitToOpenRouter fails', async () => {
    const node = makeNode('node-1', {
      contentType: 'text',
      prompt: 'Hello',
      model: 'anthropic/claude-sonnet-4.6',
    })
    const deps = createMockDeps([node], [], {
      submitToOpenRouter: vi.fn().mockRejectedValue(new Error('OpenRouter API error')),
    })
    const callbacks = createMockCallbacks()

    const result = await executeGeneration('node-1', deps, callbacks)

    expect(result).toBe(false)
    const errorUpdate = callbacks.updates.find((u) => u.generationStatus === 'error')
    expect(errorUpdate).toBeDefined()
    expect(errorUpdate!.errorMessage).toBe('OpenRouter API error')
  })

  it('does not call completeTextGeneration if submitToOpenRouter fails', async () => {
    const node = makeNode('node-1', {
      contentType: 'text',
      prompt: 'Hello',
      model: 'anthropic/claude-sonnet-4.6',
    })
    const deps = createMockDeps([node], [], {
      submitToOpenRouter: vi.fn().mockRejectedValue(new Error('fail')),
    })
    const callbacks = createMockCallbacks()

    await executeGeneration('node-1', deps, callbacks)

    expect(deps.completeTextGeneration).not.toHaveBeenCalled()
  })

  it('works for all text models', async () => {
    for (const model of [
      'anthropic/claude-sonnet-4.6',
      'openai/gpt-5.2',
      'google/gemini-3-flash-preview',
    ]) {
      const node = makeNode('node-1', {
        contentType: 'text',
        prompt: 'test',
        model,
      })
      const deps = createMockDeps([node])
      const callbacks = createMockCallbacks()
      const result = await executeGeneration('node-1', deps, callbacks)
      expect(result).toBe(true)
      expect(deps.submitToOpenRouter).toHaveBeenCalled()
    }
  })
})

// ── Connected inputs ─────────────────────────────────────────────────────────

describe('executeGeneration — connected inputs', () => {
  it('uses prompt from connected text node instead of own prompt', async () => {
    const textNode = makeNode('text-1', {
      contentType: 'text',
      prompt: 'an astronaut on mars',
    })
    const imageNode = makeNode('img-1', {
      contentType: 'image',
      prompt: 'should be ignored',
      model: 'fal-ai/flux-pro',
    })
    const edges = [makeEdge('text-1', 'img-1', 'output-text', 'input-text')]
    const deps = createMockDeps([textNode, imageNode], edges)
    const callbacks = createMockCallbacks()

    await executeGeneration('img-1', deps, callbacks)

    expect(deps.createGeneration).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: 'an astronaut on mars' }),
    )
    expect(deps.submitToFal).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ prompt: 'an astronaut on mars' }),
      }),
    )
  })

  it('passes connected media URLs to fal submission', async () => {
    const imgSource = makeNode('img-src', {
      contentType: 'image',
      resultUrl: 'https://cdn.example.com/photo.png',
    })
    const videoNode = makeNode('vid-1', {
      contentType: 'video',
      prompt: 'animate this image',
      model: 'fal-ai/minimax-video',
    })
    const edges = [makeEdge('img-src', 'vid-1', 'output-image', 'input-image')]
    const deps = createMockDeps([imgSource, videoNode], edges)
    const callbacks = createMockCallbacks()

    await executeGeneration('vid-1', deps, callbacks)

    expect(deps.submitToFal).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          imageUrl: 'https://cdn.example.com/photo.png',
        }),
      }),
    )
  })
})

// ── Validation / early returns ───────────────────────────────────────────────

describe('executeGeneration — validation', () => {
  it('returns false if node does not exist', async () => {
    const deps = createMockDeps([])
    const callbacks = createMockCallbacks()
    const result = await executeGeneration('nonexistent', deps, callbacks)
    expect(result).toBe(false)
    expect(deps.createGeneration).not.toHaveBeenCalled()
  })

  it('returns false for non-blockNode type', async () => {
    const node = { ...makeNode('node-1'), type: 'resultNode' }
    const deps = createMockDeps([node])
    const callbacks = createMockCallbacks()
    const result = await executeGeneration('node-1', deps, callbacks)
    expect(result).toBe(false)
  })

  it('returns false for non-generatable content types (note)', async () => {
    const node = makeNode('node-1', { contentType: 'note' })
    const deps = createMockDeps([node])
    const callbacks = createMockCallbacks()
    const result = await executeGeneration('node-1', deps, callbacks)
    expect(result).toBe(false)
  })

  it('returns false for non-generatable content types (ticket)', async () => {
    const node = makeNode('node-1', { contentType: 'ticket' })
    const deps = createMockDeps([node])
    const callbacks = createMockCallbacks()
    const result = await executeGeneration('node-1', deps, callbacks)
    expect(result).toBe(false)
  })

  it('returns false when prompt is empty', async () => {
    const node = makeNode('node-1', { prompt: '' })
    const deps = createMockDeps([node])
    const callbacks = createMockCallbacks()
    const result = await executeGeneration('node-1', deps, callbacks)
    expect(result).toBe(false)
  })

  it('returns false when prompt is whitespace only', async () => {
    const node = makeNode('node-1', { prompt: '   ' })
    const deps = createMockDeps([node])
    const callbacks = createMockCallbacks()
    const result = await executeGeneration('node-1', deps, callbacks)
    expect(result).toBe(false)
  })

  it('does not lock or call any mutation when validation fails', async () => {
    const node = makeNode('node-1', { prompt: '' })
    const deps = createMockDeps([node])
    const callbacks = createMockCallbacks()
    await executeGeneration('node-1', deps, callbacks)
    expect(callbacks.onLock).not.toHaveBeenCalled()
    expect(callbacks.onUnlock).not.toHaveBeenCalled()
    expect(callbacks.onUpdate).not.toHaveBeenCalled()
    expect(deps.createGeneration).not.toHaveBeenCalled()
  })

  it('works for all FAL content types (image, video, audio, music)', async () => {
    for (const contentType of ['image', 'video', 'audio', 'music'] as const) {
      const node = makeNode('node-1', { contentType, prompt: 'test' })
      const deps = createMockDeps([node])
      const callbacks = createMockCallbacks()
      const result = await executeGeneration('node-1', deps, callbacks)
      expect(result).toBe(true)
    }
  })

  it('works for text content type via OpenRouter', async () => {
    const node = makeNode('node-1', {
      contentType: 'text',
      prompt: 'test',
      model: 'anthropic/claude-sonnet-4.6',
    })
    const deps = createMockDeps([node])
    const callbacks = createMockCallbacks()
    const result = await executeGeneration('node-1', deps, callbacks)
    expect(result).toBe(true)
  })
})

// ── Error handling ───────────────────────────────────────────────────────────

describe('executeGeneration — error handling', () => {
  it('sets error status when createGeneration fails', async () => {
    const node = makeNode('node-1')
    const deps = createMockDeps([node], [], {
      createGeneration: vi.fn().mockRejectedValue(new Error('Server error')),
    })
    const callbacks = createMockCallbacks()

    const result = await executeGeneration('node-1', deps, callbacks)

    expect(result).toBe(false)
    const errorUpdate = callbacks.updates.find((u) => u.generationStatus === 'error')
    expect(errorUpdate).toBeDefined()
    expect(errorUpdate!.errorMessage).toBe('Server error')
  })

  it('shows credit-specific message for insufficient credits', async () => {
    const node = makeNode('node-1')
    const deps = createMockDeps([node], [], {
      createGeneration: vi
        .fn()
        .mockRejectedValue(
          new Error('Insufficient credits. Need 0.5, have 0.1'),
        ),
    })
    const callbacks = createMockCallbacks()

    await executeGeneration('node-1', deps, callbacks)

    const errorUpdate = callbacks.updates.find((u) => u.generationStatus === 'error')
    expect(errorUpdate!.errorMessage).toBe(
      'Out of credits. Upgrade your plan to continue.',
    )
  })

  it('sets error status when submitToFal fails', async () => {
    const node = makeNode('node-1')
    const deps = createMockDeps([node], [], {
      submitToFal: vi
        .fn()
        .mockRejectedValue(new Error('fal.ai submission failed (500): Internal')),
    })
    const callbacks = createMockCallbacks()

    const result = await executeGeneration('node-1', deps, callbacks)

    expect(result).toBe(false)
    const errorUpdate = callbacks.updates.find((u) => u.generationStatus === 'error')
    expect(errorUpdate!.errorMessage).toContain('fal.ai submission failed')
  })

  it('sets error status when setFalRequestId fails', async () => {
    const node = makeNode('node-1')
    const deps = createMockDeps([node], [], {
      setFalRequestId: vi
        .fn()
        .mockRejectedValue(new Error('Mutation failed')),
    })
    const callbacks = createMockCallbacks()

    const result = await executeGeneration('node-1', deps, callbacks)

    expect(result).toBe(false)
    const errorUpdate = callbacks.updates.find((u) => u.generationStatus === 'error')
    expect(errorUpdate!.errorMessage).toBe('Mutation failed')
  })

  it('handles non-Error throws gracefully', async () => {
    const node = makeNode('node-1')
    const deps = createMockDeps([node], [], {
      createGeneration: vi.fn().mockRejectedValue('string error'),
    })
    const callbacks = createMockCallbacks()

    await executeGeneration('node-1', deps, callbacks)

    const errorUpdate = callbacks.updates.find((u) => u.generationStatus === 'error')
    expect(errorUpdate!.errorMessage).toBe('Generation failed')
  })

  it('always unlocks even when an error occurs', async () => {
    const node = makeNode('node-1')
    const deps = createMockDeps([node], [], {
      createGeneration: vi.fn().mockRejectedValue(new Error('boom')),
    })
    const callbacks = createMockCallbacks()

    await executeGeneration('node-1', deps, callbacks)

    expect(callbacks.onLock).toHaveBeenCalledOnce()
    expect(callbacks.onUnlock).toHaveBeenCalledOnce()
  })

  it('does not call submitToFal if createGeneration fails', async () => {
    const node = makeNode('node-1')
    const deps = createMockDeps([node], [], {
      createGeneration: vi.fn().mockRejectedValue(new Error('fail')),
    })
    const callbacks = createMockCallbacks()

    await executeGeneration('node-1', deps, callbacks)

    expect(deps.submitToFal).not.toHaveBeenCalled()
    expect(deps.setFalRequestId).not.toHaveBeenCalled()
  })

  it('does not call setFalRequestId if submitToFal fails', async () => {
    const node = makeNode('node-1')
    const deps = createMockDeps([node], [], {
      submitToFal: vi.fn().mockRejectedValue(new Error('fal down')),
    })
    const callbacks = createMockCallbacks()

    await executeGeneration('node-1', deps, callbacks)

    expect(deps.createGeneration).toHaveBeenCalled()
    expect(deps.setFalRequestId).not.toHaveBeenCalled()
  })
})
