import { useCallback, useRef } from 'react'
import type { Edge, Node } from '@xyflow/react'
import { copyNodes, pasteNodes } from '@/utils/canvasUtils'

type UseCopyPasteOptions = {
  nodes: Node[]
  edges: Edge[]
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>
  nodeIdCounter: React.MutableRefObject<number>
}

export function useCopyPaste({
  nodes,
  edges,
  setNodes,
  setEdges,
  nodeIdCounter,
}: UseCopyPasteOptions) {
  const clipboardRef = useRef<{ nodes: Node[]; edges: Edge[] } | null>(null)

  const handleCopy = useCallback(() => {
    const selectedNodeIds = nodes.filter((n) => n.selected).map((n) => n.id)
    const copiedData = copyNodes(nodes, edges, selectedNodeIds)

    if (copiedData) {
      clipboardRef.current = copiedData
      console.log(`Copied ${copiedData.nodes.length} node(s)`)
    }
  }, [nodes, edges])

  const handlePaste = useCallback(() => {
    if (!clipboardRef.current) return

    const { nodes: newNodes, edges: newEdges, newIdCounter, newNodeIds } = pasteNodes(
      clipboardRef.current,
      nodeIdCounter.current,
    )

    nodeIdCounter.current = newIdCounter

    // Deselect all existing nodes and select only the pasted ones
    setNodes((nds) =>
      [...nds.map((n) => ({ ...n, selected: false })), ...newNodes],
    )
    setEdges((eds) => [...eds, ...newEdges])

    console.log(`Pasted ${newNodes.length} node(s)`)
  }, [setNodes, setEdges, nodeIdCounter])

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
      }
    },
    [handleCopy, handlePaste],
  )

  return {
    handleKeyDown,
    handleCopy,
    handlePaste,
  }
}
