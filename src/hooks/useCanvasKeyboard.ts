import { useCallback, useRef } from 'react'
import type { Edge, Node } from '@xyflow/react'
import { copyNodes, pasteNodes } from '@/utils/canvasUtils'

type UseCanvasKeyboardOptions = {
  nodes: Node[]
  edges: Edge[]
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>
  nodeIdCounter: React.MutableRefObject<number>
  pushSnapshot: (nodes: Node[], edges: Edge[]) => void
  undo: () => void
  redo: () => void
}

export function useCanvasKeyboard({
  nodes,
  edges,
  setNodes,
  setEdges,
  nodeIdCounter,
  pushSnapshot,
  undo,
  redo,
}: UseCanvasKeyboardOptions) {
  const clipboardRef = useRef<{ nodes: Node[]; edges: Edge[] } | null>(null)

  const handleCopy = useCallback(() => {
    const selectedNodeIds = nodes.filter((n) => n.selected).map((n) => n.id)
    const copiedData = copyNodes(nodes, edges, selectedNodeIds)

    if (copiedData) {
      clipboardRef.current = copiedData
    }
  }, [nodes, edges])

  const handlePaste = useCallback(() => {
    if (!clipboardRef.current) return

    pushSnapshot(nodes, edges)

    const { nodes: newNodes, edges: newEdges, newIdCounter } = pasteNodes(
      clipboardRef.current,
      nodeIdCounter.current,
    )

    nodeIdCounter.current = newIdCounter

    setNodes((nds) =>
      [...nds.map((n) => ({ ...n, selected: false })), ...newNodes],
    )
    setEdges((eds) => [...eds, ...newEdges])
  }, [setNodes, setEdges, nodeIdCounter, nodes, edges, pushSnapshot])

  const handleDelete = useCallback(() => {
    const selectedIds = new Set(
      nodes.filter((n) => n.selected).map((n) => n.id),
    )
    if (selectedIds.size === 0) return

    pushSnapshot(nodes, edges)

    setNodes((nds) => nds.filter((n) => !selectedIds.has(n.id)))
    setEdges((eds) =>
      eds.filter((e) => !selectedIds.has(e.source) && !selectedIds.has(e.target)),
    )
  }, [nodes, edges, setNodes, setEdges, pushSnapshot])

  const handleDuplicate = useCallback(() => {
    const selectedNodeIds = nodes.filter((n) => n.selected).map((n) => n.id)
    const copiedData = copyNodes(nodes, edges, selectedNodeIds)
    if (!copiedData) return

    pushSnapshot(nodes, edges)

    const { nodes: newNodes, edges: newEdges, newIdCounter } = pasteNodes(
      copiedData,
      nodeIdCounter.current,
    )

    nodeIdCounter.current = newIdCounter

    setNodes((nds) =>
      [...nds.map((n) => ({ ...n, selected: false })), ...newNodes],
    )
    setEdges((eds) => [...eds, ...newEdges])
  }, [nodes, edges, setNodes, setEdges, nodeIdCounter, pushSnapshot])

  const handleSelectAll = useCallback(() => {
    setNodes((nds) => nds.map((n) => ({ ...n, selected: true })))
  }, [setNodes])

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const isCtrlOrCmd = isMac ? event.metaKey : event.ctrlKey

      // Ignore if user is typing in an input/textarea
      const target = event.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return
      }

      if (isCtrlOrCmd && event.key === 'c') {
        event.preventDefault()
        handleCopy()
      } else if (isCtrlOrCmd && event.key === 'v') {
        event.preventDefault()
        handlePaste()
      } else if (isCtrlOrCmd && event.key === 'd') {
        event.preventDefault()
        handleDuplicate()
      } else if (isCtrlOrCmd && event.key === 'a') {
        event.preventDefault()
        handleSelectAll()
      } else if (isCtrlOrCmd && event.key.toLowerCase() === 'z' && event.shiftKey) {
        event.preventDefault()
        redo()
      } else if (isCtrlOrCmd && event.key.toLowerCase() === 'z' && !event.shiftKey) {
        event.preventDefault()
        undo()
      } else if (isCtrlOrCmd && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        redo()
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        handleDelete()
      }
    },
    [handleCopy, handlePaste, handleDuplicate, handleSelectAll, handleDelete, undo, redo],
  )

  return {
    handleKeyDown,
    handleCopy,
    handlePaste,
    handleDelete,
    handleDuplicate,
    handleSelectAll,
  }
}
