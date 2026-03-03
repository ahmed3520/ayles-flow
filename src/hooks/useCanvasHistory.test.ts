import type { Edge, Node } from '@xyflow/react'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { BlockNodeData } from '@/types/nodes'
import { useCanvasHistory } from '@/hooks/useCanvasHistory'

// ── helpers ──────────────────────────────────────────────────────────────────

function makeNode(
  id: string,
  data: Partial<BlockNodeData> = {},
  overrides: Partial<Node> = {},
): Node<BlockNodeData> {
  return {
    id,
    type: 'blockNode',
    position: { x: 0, y: 0 },
    data: {
      contentType: 'image',
      label: '',
      prompt: '',
      model: '',
      generationStatus: 'idle',
      ...data,
    },
    ...overrides,
  }
}

function makeEdge(source: string, target: string): Edge {
  return {
    id: `${source}-${target}`,
    source,
    target,
    sourceHandle: 'output-image',
    targetHandle: 'input-image',
  }
}

type HookSetup = {
  nodesRef: { current: Node[] }
  edgesRef: { current: Edge[] }
  setNodes: ReturnType<typeof vi.fn>
  setEdges: ReturnType<typeof vi.fn>
  onRestore: ReturnType<typeof vi.fn>
}

function setup(initialNodes: Node[] = [], initialEdges: Edge[] = []) {
  const refs: HookSetup = {
    nodesRef: { current: initialNodes },
    edgesRef: { current: initialEdges },
    setNodes: vi.fn((nodes: Node[]) => {
      refs.nodesRef.current = nodes
    }),
    setEdges: vi.fn((edges: Edge[]) => {
      refs.edgesRef.current = edges
    }),
    onRestore: vi.fn(),
  }

  const { result, rerender } = renderHook(() =>
    useCanvasHistory({
      nodesRef: refs.nodesRef,
      edgesRef: refs.edgesRef,
      setNodes: refs.setNodes,
      setEdges: refs.setEdges,
      onRestore: refs.onRestore,
    }),
  )

  return { result, rerender, refs }
}

/** Flush pending microtasks (isRestoring resets) */
async function flushMicrotasks() {
  await act(async () => {
    await new Promise((r) => queueMicrotask(r))
  })
}

/** Simulate what Canvas does: pushSnapshot with current state, then mutate the refs */
async function simulateAction(
  result: { current: ReturnType<typeof useCanvasHistory> },
  refs: HookSetup,
  newNodes: Node[],
  newEdges?: Edge[],
) {
  await flushMicrotasks()
  act(() => {
    result.current.pushSnapshot(refs.nodesRef.current, refs.edgesRef.current)
  })
  refs.nodesRef.current = newNodes
  refs.edgesRef.current = newEdges ?? refs.edgesRef.current
}

// ── initializeHistory ────────────────────────────────────────────────────────

describe('initializeHistory', () => {
  it('starts with empty stacks', () => {
    const { result } = setup()

    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)
  })

  it('clears all history', async () => {
    const nodeA = makeNode('node-1')
    const { result, refs } = setup([])

    await simulateAction(result, refs, [nodeA])

    expect(result.current.canUndo).toBe(true)

    act(() => result.current.initializeHistory())

    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)
  })
})

// ── pushSnapshot ─────────────────────────────────────────────────────────────

describe('pushSnapshot', () => {
  it('enables undo after pushing', async () => {
    const { result, refs } = setup([])

    await simulateAction(result, refs, [makeNode('node-1')])

    expect(result.current.canUndo).toBe(true)
    expect(result.current.canRedo).toBe(false)
  })

  it('clears redo stack on new action', async () => {
    const nodeA = makeNode('node-1')
    const nodeB = makeNode('node-2')
    const { result, refs } = setup([])

    await simulateAction(result, refs, [nodeA])
    await simulateAction(result, refs, [nodeA, nodeB])

    // Undo once to get redo
    act(() => result.current.undo())
    expect(result.current.canRedo).toBe(true)

    // New action should clear redo
    await simulateAction(result, refs, [nodeA, makeNode('node-3')])
    expect(result.current.canRedo).toBe(false)
  })

  it('strips transient properties from snapshots', async () => {
    const nodeWithTransient = makeNode('node-1', {}, {
      selected: true,
      dragging: true,
      measured: { width: 200, height: 100 },
    } as any)

    const { result, refs } = setup([nodeWithTransient])

    await simulateAction(result, refs, [])

    act(() => result.current.undo())

    const restoredNodes = refs.setNodes.mock.calls.at(-1)?.[0] as Node[]
    expect(restoredNodes).toHaveLength(1)
    expect(restoredNodes[0].id).toBe('node-1')
    expect((restoredNodes[0] as any).selected).toBeUndefined()
    expect((restoredNodes[0] as any).dragging).toBeUndefined()
    expect((restoredNodes[0] as any).measured).toBeUndefined()
  })

  it('strips selected from edges', async () => {
    const edge = { ...makeEdge('node-1', 'node-2'), selected: true } as Edge
    const { result, refs } = setup([makeNode('node-1'), makeNode('node-2')], [edge])

    await simulateAction(result, refs, [], [])

    act(() => result.current.undo())

    const restoredEdges = refs.setEdges.mock.calls.at(-1)?.[0] as Edge[]
    expect(restoredEdges).toHaveLength(1)
    expect((restoredEdges[0] as any).selected).toBeUndefined()
  })
})

// ── undo ─────────────────────────────────────────────────────────────────────

describe('undo', () => {
  it('restores previous state via setNodes/setEdges', async () => {
    const nodeA = makeNode('node-1')
    const { result, refs } = setup([])

    await simulateAction(result, refs, [nodeA])

    act(() => result.current.undo())

    expect(refs.setNodes.mock.calls.at(-1)?.[0]).toHaveLength(0)
  })

  it('does nothing when stack is empty', () => {
    const { result, refs } = setup([makeNode('node-1')])

    act(() => result.current.undo())

    expect(refs.setNodes).not.toHaveBeenCalled()
  })

  it('enables redo after undo', async () => {
    const { result, refs } = setup([])

    await simulateAction(result, refs, [makeNode('node-1')])
    expect(result.current.canRedo).toBe(false)

    act(() => result.current.undo())
    expect(result.current.canRedo).toBe(true)
  })

  it('saves current canvas state to redo stack', async () => {
    const nodeA = makeNode('node-1')
    const nodeB = makeNode('node-2')
    const { result, refs } = setup([])

    await simulateAction(result, refs, [nodeA])
    await simulateAction(result, refs, [nodeA, nodeB])

    // Canvas currently has [A, B]. Undo should save this to redo.
    act(() => result.current.undo())

    // Canvas restored to [A] (before add B)
    const undoRestoredNodes = refs.setNodes.mock.calls.at(-1)?.[0] as Node[]
    expect(undoRestoredNodes).toHaveLength(1)
    expect(undoRestoredNodes[0].id).toBe('node-1')

    // Now redo should bring back [A, B]
    act(() => result.current.redo())

    const redoRestoredNodes = refs.setNodes.mock.calls.at(-1)?.[0] as Node[]
    expect(redoRestoredNodes).toHaveLength(2)
    expect(redoRestoredNodes.map((n) => n.id)).toEqual(['node-1', 'node-2'])
  })

  it('multiple undos walk back through history', async () => {
    const nodeA = makeNode('node-1')
    const nodeB = makeNode('node-2')
    const nodeC = makeNode('node-3')
    const { result, refs } = setup([])

    await simulateAction(result, refs, [nodeA])
    await simulateAction(result, refs, [nodeA, nodeB])
    await simulateAction(result, refs, [nodeA, nodeB, nodeC])

    act(() => result.current.undo()) // → [A, B]
    expect((refs.setNodes.mock.calls.at(-1)?.[0] as Node[]).length).toBe(2)

    act(() => result.current.undo()) // → [A]
    expect((refs.setNodes.mock.calls.at(-1)?.[0] as Node[]).length).toBe(1)

    act(() => result.current.undo()) // → []
    expect((refs.setNodes.mock.calls.at(-1)?.[0] as Node[]).length).toBe(0)

    expect(result.current.canUndo).toBe(false)
  })

  it('calls onRestore callback', async () => {
    const nodeA = makeNode('node-1')
    const { result, refs } = setup([])

    await simulateAction(result, refs, [nodeA])

    act(() => result.current.undo())

    expect(refs.onRestore).toHaveBeenCalledWith(
      expect.objectContaining({
        nodes: expect.any(Array),
        edges: expect.any(Array),
      }),
    )
  })
})

// ── redo ─────────────────────────────────────────────────────────────────────

describe('redo', () => {
  it('restores the undone state', async () => {
    const nodeA = makeNode('node-1')
    const { result, refs } = setup([])

    await simulateAction(result, refs, [nodeA])

    act(() => result.current.undo())

    act(() => result.current.redo())
    const restoredNodes = refs.setNodes.mock.calls.at(-1)?.[0] as Node[]
    expect(restoredNodes).toHaveLength(1)
    expect(restoredNodes[0].id).toBe('node-1')
  })

  it('does nothing when redo stack is empty', () => {
    const { result, refs } = setup([makeNode('node-1')])

    const callCountBefore = refs.setNodes.mock.calls.length

    act(() => result.current.redo())

    expect(refs.setNodes.mock.calls.length).toBe(callCountBefore)
  })

  it('re-enables undo after redo', async () => {
    const nodeA = makeNode('node-1')
    const { result, refs } = setup([])

    await simulateAction(result, refs, [nodeA])

    act(() => result.current.undo())
    expect(result.current.canUndo).toBe(false)

    act(() => result.current.redo())
    expect(result.current.canUndo).toBe(true)
  })

  it('calls onRestore callback', async () => {
    const { result, refs } = setup([])

    await simulateAction(result, refs, [makeNode('node-1')])
    act(() => result.current.undo())

    refs.onRestore.mockClear()

    act(() => result.current.redo())
    expect(refs.onRestore).toHaveBeenCalledTimes(1)
  })
})

// ── full undo/redo cycle ─────────────────────────────────────────────────────

describe('full undo/redo cycle', () => {
  it('add → add → undo → redo → undo → undo', async () => {
    const nodeA = makeNode('node-1')
    const nodeB = makeNode('node-2')
    const { result, refs } = setup([])

    await simulateAction(result, refs, [nodeA])
    expect(refs.nodesRef.current).toHaveLength(1)

    await simulateAction(result, refs, [nodeA, nodeB])
    expect(refs.nodesRef.current).toHaveLength(2)

    // Undo (remove B) → [A]
    act(() => result.current.undo())
    expect(refs.nodesRef.current).toHaveLength(1)
    expect(refs.nodesRef.current[0].id).toBe('node-1')

    // Redo (restore B) → [A, B]
    act(() => result.current.redo())
    expect(refs.nodesRef.current).toHaveLength(2)

    // Undo → [A]
    act(() => result.current.undo())
    expect(refs.nodesRef.current).toHaveLength(1)

    // Undo → []
    act(() => result.current.undo())
    expect(refs.nodesRef.current).toHaveLength(0)

    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(true)
  })

  it('undo → new action clears redo (fork in history)', async () => {
    const nodeA = makeNode('node-1')
    const nodeB = makeNode('node-2')
    const nodeC = makeNode('node-3')
    const { result, refs } = setup([])

    await simulateAction(result, refs, [nodeA])
    await simulateAction(result, refs, [nodeA, nodeB])

    // Undo to [A]
    act(() => result.current.undo())
    expect(result.current.canRedo).toBe(true)

    // New action: add C instead of B → [A, C]
    await simulateAction(result, refs, [nodeA, nodeC])

    // Redo should be gone (history forked)
    expect(result.current.canRedo).toBe(false)

    // Undo brings back [A]
    act(() => result.current.undo())
    expect(refs.nodesRef.current).toHaveLength(1)
    expect(refs.nodesRef.current[0].id).toBe('node-1')
  })

  it('tracks edges alongside nodes', async () => {
    const nodeA = makeNode('node-1')
    const nodeB = makeNode('node-2')
    const edge = makeEdge('node-1', 'node-2')
    const { result, refs } = setup([nodeA, nodeB])

    await simulateAction(result, refs, [nodeA, nodeB], [edge])
    expect(refs.edgesRef.current).toHaveLength(1)

    // Undo removes the edge
    act(() => result.current.undo())
    expect(refs.edgesRef.current).toHaveLength(0)

    // Redo restores the edge
    act(() => result.current.redo())
    expect(refs.edgesRef.current).toHaveLength(1)
    expect(refs.edgesRef.current[0].id).toBe('node-1-node-2')
  })

  it('node position change via drag', async () => {
    const nodeAtOriginal = makeNode('node-1')
    nodeAtOriginal.position = { x: 0, y: 0 }

    const nodeAtMoved = makeNode('node-1')
    nodeAtMoved.position = { x: 200, y: 150 }

    const { result, refs } = setup([nodeAtOriginal])

    // Drag: pushSnapshot before, then update position
    await simulateAction(result, refs, [nodeAtMoved])

    // Undo restores original position
    act(() => result.current.undo())
    expect(refs.nodesRef.current[0].position).toEqual({ x: 0, y: 0 })

    // Redo restores moved position
    act(() => result.current.redo())
    expect(refs.nodesRef.current[0].position).toEqual({ x: 200, y: 150 })
  })
})

// ── maxHistory ───────────────────────────────────────────────────────────────

describe('maxHistory', () => {
  it('enforces max history limit', () => {
    const nodesRef = { current: [] as Node[] }
    const edgesRef = { current: [] as Edge[] }
    const setNodes = vi.fn((n: Node[]) => { nodesRef.current = n })
    const setEdges = vi.fn((e: Edge[]) => { edgesRef.current = e })

    const { result } = renderHook(() =>
      useCanvasHistory({
        nodesRef,
        edgesRef,
        setNodes,
        setEdges,
        maxHistory: 3,
      }),
    )

    // Push 5 snapshots (max is 3)
    for (let i = 1; i <= 5; i++) {
      const nodes = Array.from({ length: i }, (_, j) => makeNode(`node-${j + 1}`))
      act(() => {
        result.current.pushSnapshot(nodesRef.current, edgesRef.current)
      })
      nodesRef.current = nodes
    }

    // Should only be able to undo 3 times (oldest 2 were pruned)
    let undoCount = 0
    while (result.current.canUndo) {
      act(() => result.current.undo())
      undoCount++
    }
    expect(undoCount).toBe(3)
  })
})

// ── isRestoring guard ────────────────────────────────────────────────────────

describe('isRestoring guard', () => {
  it('ignores pushSnapshot calls during restore', async () => {
    const nodeA = makeNode('node-1')
    const { result, refs } = setup([])

    await simulateAction(result, refs, [nodeA])

    // Undo triggers restore (isRestoring = true)
    act(() => result.current.undo())

    // Simulate a pushSnapshot that happens during restore
    // (e.g., from an onNodesChange wrapper detecting a removal)
    act(() => {
      result.current.pushSnapshot(refs.nodesRef.current, refs.edgesRef.current)
    })

    // The redo stack should still be intact (pushSnapshot was ignored)
    expect(result.current.canRedo).toBe(true)

    // Wait for queueMicrotask to reset isRestoring
    await flushMicrotasks()

    // Now pushSnapshot should work again
    await simulateAction(result, refs, [makeNode('node-2')])

    // Redo should be cleared by the new action
    expect(result.current.canRedo).toBe(false)
  })
})
