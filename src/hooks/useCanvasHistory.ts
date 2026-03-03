import { useCallback, useRef, useState } from 'react'
import type { Edge, Node } from '@xyflow/react'

type Snapshot = {
  nodes: Node[]
  edges: Edge[]
}

type UseCanvasHistoryOptions = {
  nodesRef: React.RefObject<Node[]>
  edgesRef: React.RefObject<Edge[]>
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>
  maxHistory?: number
  onRestore?: (snapshot: Snapshot) => void
}

function sanitize(nodes: Node[], edges: Edge[]): Snapshot {
  return {
    nodes: nodes.map(({ selected, dragging, measured, resizing, ...rest }: any) => rest),
    edges: edges.map(({ selected, ...rest }: any) => rest),
  }
}

export function useCanvasHistory({
  nodesRef,
  edgesRef,
  setNodes,
  setEdges,
  maxHistory = 50,
  onRestore,
}: UseCanvasHistoryOptions) {
  const pastRef = useRef<Snapshot[]>([])
  const futureRef = useRef<Snapshot[]>([])
  const isRestoringRef = useRef(false)

  // Bump version to re-render so canUndo/canRedo update in the UI
  const [, setVersion] = useState(0)
  const bump = () => setVersion((v) => v + 1)

  const initializeHistory = useCallback(() => {
    pastRef.current = []
    futureRef.current = []
    bump()
  }, [])

  const pushSnapshot = useCallback(
    (nodes: Node[], edges: Edge[]) => {
      if (isRestoringRef.current) return

      pastRef.current.push(sanitize(nodes, edges))
      if (pastRef.current.length > maxHistory) {
        pastRef.current = pastRef.current.slice(-maxHistory)
      }
      futureRef.current = []
      bump()
    },
    [maxHistory],
  )

  const restore = useCallback(
    (snapshot: Snapshot) => {
      isRestoringRef.current = true
      setNodes(snapshot.nodes)
      setEdges(snapshot.edges)
      onRestore?.(snapshot)
      queueMicrotask(() => {
        isRestoringRef.current = false
      })
    },
    [setNodes, setEdges, onRestore],
  )

  const undo = useCallback(() => {
    if (pastRef.current.length === 0) return
    // Save current live canvas state to redo stack
    futureRef.current.push(sanitize(nodesRef.current, edgesRef.current))
    // Restore previous state
    const previous = pastRef.current.pop()!
    restore(previous)
    bump()
  }, [restore, nodesRef, edgesRef])

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return
    // Save current live canvas state to undo stack
    pastRef.current.push(sanitize(nodesRef.current, edgesRef.current))
    // Restore next state
    const next = futureRef.current.pop()!
    restore(next)
    bump()
  }, [restore, nodesRef, edgesRef])

  return {
    pushSnapshot,
    initializeHistory,
    undo,
    redo,
    canUndo: pastRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
  }
}
