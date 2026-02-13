import type { Edge, Node } from '@xyflow/react'
import { describe, expect, it } from 'vitest'

import type { BlockNodeData } from '@/types/nodes'
import {
  computeMaxNodeId,
  copyNodes,
  extractPortType,
  generateNodeId,
  pasteNodes,
  resolveConnectedInputs,
  validateConnection,
} from '@/utils/canvasUtils'

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
      label: '',
      prompt: '',
      model: '',
      generationStatus: 'idle',
      ...data,
    },
  }
}

function makeEdge(
  source: string,
  target: string,
  sourceHandle = 'output-image',
  targetHandle = 'input-image',
): Edge {
  return {
    id: `${source}-${target}`,
    source,
    target,
    sourceHandle,
    targetHandle,
  }
}

// ── generateNodeId ───────────────────────────────────────────────────────────

describe('generateNodeId', () => {
  it('returns node-{N} format', () => {
    expect(generateNodeId(1)).toBe('node-1')
    expect(generateNodeId(42)).toBe('node-42')
    expect(generateNodeId(0)).toBe('node-0')
  })
})

// ── computeMaxNodeId ─────────────────────────────────────────────────────────

describe('computeMaxNodeId', () => {
  it('returns 0 for empty array', () => {
    expect(computeMaxNodeId([])).toBe(0)
  })

  it('returns highest numeric ID', () => {
    const nodes = [makeNode('node-3'), makeNode('node-7'), makeNode('node-1')]
    expect(computeMaxNodeId(nodes)).toBe(7)
  })

  it('ignores nodes with non-matching IDs', () => {
    const nodes = [makeNode('node-5'), makeNode('custom-id'), makeNode('abc')]
    expect(computeMaxNodeId(nodes)).toBe(5)
  })

  it('returns 0 when no node matches the pattern', () => {
    const nodes = [makeNode('foo'), makeNode('bar')]
    expect(computeMaxNodeId(nodes)).toBe(0)
  })
})

// ── extractPortType ──────────────────────────────────────────────────────────

describe('extractPortType', () => {
  it('strips input- prefix', () => {
    expect(extractPortType('input-text', 'input-')).toBe('text')
    expect(extractPortType('input-image', 'input-')).toBe('image')
  })

  it('strips output- prefix', () => {
    expect(extractPortType('output-video', 'output-')).toBe('video')
  })

  it('returns null for null/undefined', () => {
    expect(extractPortType(null, 'input-')).toBeNull()
    expect(extractPortType(undefined, 'input-')).toBeNull()
  })
})

// ── validateConnection ───────────────────────────────────────────────────────

describe('validateConnection', () => {
  it('rejects self-connections', () => {
    const result = validateConnection(
      {
        source: 'node-1',
        target: 'node-1',
        sourceHandle: 'output-image',
        targetHandle: 'input-image',
      },
      [],
    )
    expect(result).toBe(false)
  })

  it('rejects mismatched port types', () => {
    const result = validateConnection(
      {
        source: 'node-1',
        target: 'node-2',
        sourceHandle: 'output-image',
        targetHandle: 'input-text',
      },
      [],
    )
    expect(result).toBe(false)
  })

  it('rejects when nodes are already connected (same direction)', () => {
    const edges = [makeEdge('node-1', 'node-2')]
    const result = validateConnection(
      {
        source: 'node-1',
        target: 'node-2',
        sourceHandle: 'output-text',
        targetHandle: 'input-text',
      },
      edges,
    )
    expect(result).toBe(false)
  })

  it('rejects when nodes are already connected (reverse direction)', () => {
    const edges = [makeEdge('node-2', 'node-1')]
    const result = validateConnection(
      {
        source: 'node-1',
        target: 'node-2',
        sourceHandle: 'output-text',
        targetHandle: 'input-text',
      },
      edges,
    )
    expect(result).toBe(false)
  })

  it('rejects when target handle is already taken', () => {
    const edges = [makeEdge('node-3', 'node-2', 'output-image', 'input-image')]
    const result = validateConnection(
      {
        source: 'node-1',
        target: 'node-2',
        sourceHandle: 'output-image',
        targetHandle: 'input-image',
      },
      edges,
    )
    expect(result).toBe(false)
  })

  it('rejects when handle IDs are missing', () => {
    expect(
      validateConnection(
        { source: 'node-1', target: 'node-2', sourceHandle: null, targetHandle: 'input-text' },
        [],
      ),
    ).toBe(false)

    expect(
      validateConnection(
        { source: 'node-1', target: 'node-2', sourceHandle: 'output-text', targetHandle: null },
        [],
      ),
    ).toBe(false)
  })

  it('accepts a valid connection', () => {
    const result = validateConnection(
      {
        source: 'node-1',
        target: 'node-2',
        sourceHandle: 'output-image',
        targetHandle: 'input-image',
      },
      [],
    )
    expect(result).toBe(true)
  })

  it('accepts connection when different target handle on same node', () => {
    const edges = [makeEdge('node-3', 'node-2', 'output-text', 'input-text')]
    const result = validateConnection(
      {
        source: 'node-1',
        target: 'node-2',
        sourceHandle: 'output-image',
        targetHandle: 'input-image',
      },
      edges,
    )
    expect(result).toBe(true)
  })
})

// ── copyNodes ────────────────────────────────────────────────────────────────

describe('copyNodes', () => {
  it('returns null for empty selection', () => {
    const nodes = [makeNode('node-1')]
    expect(copyNodes(nodes, [], [])).toBeNull()
  })

  it('copies selected nodes', () => {
    const nodes = [makeNode('node-1'), makeNode('node-2'), makeNode('node-3')]
    const result = copyNodes(nodes, [], ['node-1', 'node-3'])
    expect(result).not.toBeNull()
    expect(result!.nodes).toHaveLength(2)
    expect(result!.nodes.map((n) => n.id)).toEqual(['node-1', 'node-3'])
  })

  it('includes edges between selected nodes only', () => {
    const nodes = [makeNode('node-1'), makeNode('node-2'), makeNode('node-3')]
    const edges = [
      makeEdge('node-1', 'node-2'),
      makeEdge('node-2', 'node-3'),
    ]
    const result = copyNodes(nodes, edges, ['node-1', 'node-2'])
    expect(result!.edges).toHaveLength(1)
    expect(result!.edges[0].source).toBe('node-1')
    expect(result!.edges[0].target).toBe('node-2')
  })

  it('excludes edges to nodes outside the selection', () => {
    const nodes = [makeNode('node-1'), makeNode('node-2'), makeNode('node-3')]
    const edges = [makeEdge('node-1', 'node-3')]
    const result = copyNodes(nodes, edges, ['node-1', 'node-2'])
    expect(result!.edges).toHaveLength(0)
  })
})

// ── pasteNodes ───────────────────────────────────────────────────────────────

describe('pasteNodes', () => {
  it('creates new nodes with incremented IDs', () => {
    const copiedData = {
      nodes: [makeNode('node-1'), makeNode('node-2')],
      edges: [],
    }
    const result = pasteNodes(copiedData, 5)
    expect(result.nodes).toHaveLength(2)
    expect(result.nodes[0].id).toBe('node-6')
    expect(result.nodes[1].id).toBe('node-7')
    expect(result.newIdCounter).toBe(7)
  })

  it('offsets node positions', () => {
    const copiedData = {
      nodes: [
        { ...makeNode('node-1'), position: { x: 100, y: 200 } },
      ],
      edges: [],
    }
    const result = pasteNodes(copiedData, 0, { x: 30, y: 40 })
    expect(result.nodes[0].position).toEqual({ x: 130, y: 240 })
  })

  it('remaps edge source/target to new IDs', () => {
    const copiedData = {
      nodes: [makeNode('node-1'), makeNode('node-2')],
      edges: [makeEdge('node-1', 'node-2')],
    }
    const result = pasteNodes(copiedData, 10)
    expect(result.edges).toHaveLength(1)
    expect(result.edges[0].source).toBe('node-11')
    expect(result.edges[0].target).toBe('node-12')
    expect(result.edges[0].id).toBe('node-11-node-12')
  })

  it('marks pasted nodes as selected', () => {
    const copiedData = { nodes: [makeNode('node-1')], edges: [] }
    const result = pasteNodes(copiedData, 0)
    expect(result.nodes[0].selected).toBe(true)
  })

  it('returns the new node IDs', () => {
    const copiedData = {
      nodes: [makeNode('node-1'), makeNode('node-2')],
      edges: [],
    }
    const result = pasteNodes(copiedData, 0)
    expect(result.newNodeIds).toEqual(['node-1', 'node-2'])
  })
})

// ── resolveConnectedInputs ───────────────────────────────────────────────────

describe('resolveConnectedInputs', () => {
  it('resolves text input from connected node prompt', () => {
    const nodes = [
      makeNode('node-1', { prompt: 'a cute cat' }),
      makeNode('node-2'),
    ]
    const edges = [makeEdge('node-1', 'node-2', 'output-text', 'input-text')]
    const getNode = (id: string) => nodes.find((n) => n.id === id)

    const result = resolveConnectedInputs('node-2', edges, getNode)
    expect(result).toEqual({ text: 'a cute cat' })
  })

  it('resolves media input from connected node resultUrl', () => {
    const nodes = [
      makeNode('node-1', { resultUrl: 'https://example.com/img.png' }),
      makeNode('node-2'),
    ]
    const edges = [
      makeEdge('node-1', 'node-2', 'output-image', 'input-image'),
    ]
    const getNode = (id: string) => nodes.find((n) => n.id === id)

    const result = resolveConnectedInputs('node-2', edges, getNode)
    expect(result).toEqual({ image: 'https://example.com/img.png' })
  })

  it('skips text input with empty prompt', () => {
    const nodes = [makeNode('node-1', { prompt: '   ' }), makeNode('node-2')]
    const edges = [makeEdge('node-1', 'node-2', 'output-text', 'input-text')]
    const getNode = (id: string) => nodes.find((n) => n.id === id)

    const result = resolveConnectedInputs('node-2', edges, getNode)
    expect(result).toEqual({})
  })

  it('skips media input without resultUrl', () => {
    const nodes = [makeNode('node-1'), makeNode('node-2')]
    const edges = [
      makeEdge('node-1', 'node-2', 'output-image', 'input-image'),
    ]
    const getNode = (id: string) => nodes.find((n) => n.id === id)

    const result = resolveConnectedInputs('node-2', edges, getNode)
    expect(result).toEqual({})
  })

  it('resolves multiple inputs', () => {
    const nodes = [
      makeNode('node-1', { prompt: 'hello' }),
      makeNode('node-3', { resultUrl: 'https://example.com/audio.wav' }),
      makeNode('node-2'),
    ]
    const edges = [
      makeEdge('node-1', 'node-2', 'output-text', 'input-text'),
      makeEdge('node-3', 'node-2', 'output-audio', 'input-audio'),
    ]
    const getNode = (id: string) => nodes.find((n) => n.id === id)

    const result = resolveConnectedInputs('node-2', edges, getNode)
    expect(result).toEqual({
      text: 'hello',
      audio: 'https://example.com/audio.wav',
    })
  })

  it('returns empty object when no edges connect to the node', () => {
    const result = resolveConnectedInputs('node-1', [], () => undefined)
    expect(result).toEqual({})
  })
})
