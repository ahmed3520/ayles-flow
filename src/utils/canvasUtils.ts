import type { Edge, Node } from '@xyflow/react'
import type { BlockNodeData } from '@/types/nodes'

/**
 * Generates a unique node ID
 */
export function generateNodeId(counter: number): string {
  return `node-${counter}`
}

/**
 * Returns the highest numeric ID from existing nodes (pattern: node-{N}).
 * Used to initialize nodeIdRef so new nodes don't collide with loaded ones.
 */
export function computeMaxNodeId(nodes: Node[]): number {
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
  connection: { source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null },
  edges: Edge[],
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
  nodes: Node[],
  edges: Edge[],
  selectedNodeIds: string[],
): { nodes: Node[]; edges: Edge[] } | null {
  const selectedNodes = nodes.filter((n) => selectedNodeIds.includes(n.id))
  if (selectedNodes.length === 0) return null

  // Find edges that connect only selected nodes
  const selectedEdges = edges.filter(
    (e) => selectedNodeIds.includes(e.source) && selectedNodeIds.includes(e.target),
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
  copiedData: { nodes: Node[]; edges: Edge[] },
  idCounter: number,
  offset = { x: 50, y: 50 },
): {
  nodes: Node[]
  edges: Edge[]
  newIdCounter: number
  newNodeIds: string[]
} {
  const idMap = new Map<string, string>()
  const newNodes: Node[] = []
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
  const newEdges: Edge[] = copiedData.edges.map((edge) => ({
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
  edges: Edge[],
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
      // Text input: use prompt from connected node
      if (srcData.prompt?.trim()) {
        connectedInputs[inputType] = srcData.prompt
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
