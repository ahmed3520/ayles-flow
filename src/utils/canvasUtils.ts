import type { Edge, Node } from '@xyflow/react'
import type { BlockNodeData, NodeContentType, PortType } from '@/types/nodes'
import { getNodeReadableText } from '@/utils/nodeTextUtils'

const DEFAULT_OUTPUT_PORT_BY_CONTENT_TYPE: Record<NodeContentType, PortType> = {
  image: 'image',
  text: 'text',
  video: 'video',
  audio: 'audio',
  music: 'audio',
  note: 'text',
  ticket: 'text',
  pdf: 'pdf',
  website: 'text',
}

/**
 * Generates a unique node ID
 */
export function generateNodeId(counter: number): string {
  return `node-${counter}`
}

function getNodeOutputPortType(node?: Node): PortType | null {
  if (!node) return null
  const data = node.data as BlockNodeData
  return (
    data.outputType ?? DEFAULT_OUTPUT_PORT_BY_CONTENT_TYPE[data.contentType]
  )
}

export function normalizeEdgeHandleIds(
  nodes: Array<Node>,
  edges: Array<Edge>,
): Array<Edge> {
  const nodeLookup = new Map(nodes.map((node) => [node.id, node]))

  return edges.map((edge) => {
    const sourcePortType = getNodeOutputPortType(nodeLookup.get(edge.source))

    if (!sourcePortType) return edge

    const nextSourceHandle =
      !edge.sourceHandle || edge.sourceHandle === 'output'
        ? `output-${sourcePortType}`
        : edge.sourceHandle

    const nextTargetHandle =
      !edge.targetHandle || edge.targetHandle === 'input'
        ? `input-${sourcePortType}`
        : edge.targetHandle

    if (
      nextSourceHandle === edge.sourceHandle &&
      nextTargetHandle === edge.targetHandle
    ) {
      return edge
    }

    return {
      ...edge,
      sourceHandle: nextSourceHandle,
      targetHandle: nextTargetHandle,
    }
  })
}

/**
 * Returns the highest numeric ID from existing nodes (pattern: node-{N}).
 * Used to initialize nodeIdRef so new nodes don't collide with loaded ones.
 */
export function computeMaxNodeId(nodes: Array<Node>): number {
  let max = 0
  for (const node of nodes) {
    const match = node.id.match(/^node-(\d+)$/)
    if (match) {
      const num = parseInt(match[1], 10)
      if (num > max) max = num
    }
  }
  return max
}

/**
 * Checks if a port type extracted from handle ID is valid
 */
export function extractPortType(
  handleId: string | null | undefined,
  prefix: 'input-' | 'output-',
): string | null {
  if (!handleId) return null
  return handleId.replace(prefix, '')
}

/**
 * Validates if a connection between two nodes is allowed
 */
export function validateConnection(
  connection: {
    source: string
    target: string
    sourceHandle?: string | null
    targetHandle?: string | null
  },
  edges: Array<Edge>,
): boolean {
  // Prevent self-connections
  if (connection.source === connection.target) return false

  // Extract port types from handle IDs
  const sourceType = extractPortType(connection.sourceHandle, 'output-')
  const targetType = extractPortType(connection.targetHandle, 'input-')

  if (!sourceType || !targetType) return false

  // Port types must match
  if (sourceType !== targetType) return false

  // Only one connection between any pair of nodes (either direction)
  const alreadyConnected = edges.some(
    (e) =>
      (e.source === connection.source && e.target === connection.target) ||
      (e.source === connection.target && e.target === connection.source),
  )
  if (alreadyConnected) return false

  // Only one connection per target handle
  const handleTaken = edges.some(
    (e) =>
      e.target === connection.target &&
      e.targetHandle === connection.targetHandle,
  )
  if (handleTaken) return false

  return true
}

/**
 * Copies selected nodes and their internal connections
 */
export function copyNodes(
  nodes: Array<Node>,
  edges: Array<Edge>,
  selectedNodeIds: Array<string>,
): { nodes: Array<Node>; edges: Array<Edge> } | null {
  const selectedNodes = nodes.filter((n) => selectedNodeIds.includes(n.id))
  if (selectedNodes.length === 0) return null

  // Find edges that connect only selected nodes
  const selectedEdges = edges.filter(
    (e) =>
      selectedNodeIds.includes(e.source) && selectedNodeIds.includes(e.target),
  )

  return {
    nodes: selectedNodes,
    edges: selectedEdges,
  }
}

/**
 * Pastes nodes at an offset position with new IDs
 */
export function pasteNodes(
  copiedData: { nodes: Array<Node>; edges: Array<Edge> },
  idCounter: number,
  offset = { x: 50, y: 50 },
): {
  nodes: Array<Node>
  edges: Array<Edge>
  newIdCounter: number
  newNodeIds: Array<string>
} {
  const idMap = new Map<string, string>()
  const newNodes: Array<Node> = []
  let currentCounter = idCounter

  // Create new nodes with updated IDs and positions
  copiedData.nodes.forEach((node) => {
    const newId = generateNodeId(++currentCounter)
    idMap.set(node.id, newId)

    newNodes.push({
      ...node,
      id: newId,
      position: {
        x: node.position.x + offset.x,
        y: node.position.y + offset.y,
      },
      selected: true, // Select the pasted nodes
    })
  })

  // Create new edges with updated node IDs
  const newEdges: Array<Edge> = copiedData.edges.map((edge) => ({
    ...edge,
    id: `${idMap.get(edge.source)}-${idMap.get(edge.target)}`,
    source: idMap.get(edge.source)!,
    target: idMap.get(edge.target)!,
  }))

  return {
    nodes: newNodes,
    edges: newEdges,
    newIdCounter: currentCounter,
    newNodeIds: Array.from(idMap.values()),
  }
}

/**
 * Resolves connected inputs for a node from incoming edges
 */
export function resolveConnectedInputs(
  nodeId: string,
  edges: Array<Edge>,
  getNode: (id: string) => Node | undefined,
): Record<string, string> {
  const connectedInputs: Record<string, string> = {}

  for (const edge of edges) {
    if (edge.target !== nodeId || !edge.targetHandle) continue

    const inputType = edge.targetHandle.replace('input-', '')
    const srcNode = getNode(edge.source)
    if (!srcNode) continue

    const srcData = srcNode.data as BlockNodeData

    if (inputType === 'text') {
      const text = getNodeReadableText(srcData)
      if (text.trim()) {
        connectedInputs[inputType] = text
      }
    } else {
      // Media input: use resultUrl from connected node
      if (srcData.resultUrl) {
        connectedInputs[inputType] = srcData.resultUrl
      }
    }
  }

  return connectedInputs
}
