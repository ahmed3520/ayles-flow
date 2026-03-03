import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useMutation, useQuery } from 'convex/react'
import { Bot, Check, Clock, Loader2, Undo2, Redo2 } from 'lucide-react'

import { api } from '../../../convex/_generated/api'

import AgentPanel from './AgentPanel'
import BlockNodeComponent from './nodes/BlockNode'
import ContextMenu from './ContextMenu'
import Sidebar from './Sidebar'
import VersionPanel from './VersionPanel'
import type { Connection, Edge, Node, OnConnect } from '@xyflow/react'
import type { Id } from '../../../convex/_generated/dataModel'
import type { BlockNodeData, NodeContentType, PortType } from '@/types/nodes'
import type { SaveStatus } from '@/hooks/useAutoSave'
import { submitToFal } from '@/data/fal'
import { executeGeneration } from '@/data/generationFlow'
import { submitToOpenRouter } from '@/data/openrouter-generate'
import { useAgentChat } from '@/hooks/useAgentChat'
import { useAutoSave } from '@/hooks/useAutoSave'
import { reconnectOrRestore } from '@/data/sandbox-sync'
import { useCanvasThumbnail } from '@/hooks/useCanvasThumbnail'
import { useCanvasHistory } from '@/hooks/useCanvasHistory'
import { useCanvasKeyboard } from '@/hooks/useCanvasKeyboard'
import {
  NODE_DEFAULTS,
  PORT_TYPE_COLORS,
} from '@/types/nodes'
import {
  computeMaxNodeId,
  generateNodeId,
  validateConnection,
} from '@/utils/canvasUtils'

const nodeTypes = {
  blockNode: BlockNodeComponent,
}

type CanvasActions = {
  onGenerate: (nodeId: string) => void
}

export const CanvasActionsContext = createContext<CanvasActions>({
  onGenerate: () => { },
})

export const useCanvasActions = () => useContext(CanvasActionsContext)

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === 'saving') {
    return (
      <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
        <Loader2 size={10} className="animate-spin" />
        <span>Saving...</span>
      </div>
    )
  }
  if (status === 'unsaved') {
    return (
      <div className="flex items-center gap-1.5 text-[10px] text-amber-500/70">
        <Clock size={10} />
        <span>Unsaved</span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-zinc-600">
      <Check size={10} />
      <span>Saved</span>
    </div>
  )
}

interface CanvasFlowProps {
  projectId: Id<'projects'>
  onVersionRestore: () => void
}

function CanvasFlow({ projectId, onVersionRestore }: CanvasFlowProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const nodeIdRef = useRef(0)
  const generatingRef = useRef(new Set<string>())
  const initialLoadRef = useRef(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [showVersions, setShowVersions] = useState(false)
  const [showAgent, setShowAgent] = useState(false)
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    targetNode: Node<BlockNodeData> | null
    flowPosition: { x: number; y: number }
  } | null>(null)

  const [nodes, setNodes, onNodesChangeBase] = useNodesState<Node>(
    [] as Array<Node>,
  )
  const [edges, setEdges, onEdgesChangeBase] = useEdgesState<Edge>(
    [] as Array<Edge>,
  )
  const { screenToFlowPosition, getNode } = useReactFlow()

  // Stable refs for accessing current nodes/edges in callbacks without adding them as deps
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  nodesRef.current = nodes
  edgesRef.current = edges

  const { pushSnapshot, initializeHistory, undo, redo, canUndo, canRedo } =
    useCanvasHistory({
      nodesRef,
      edgesRef,
      setNodes,
      setEdges,
      maxHistory: 50,
      onRestore: (snapshot) => {
        nodeIdRef.current = Math.max(nodeIdRef.current, computeMaxNodeId(snapshot.nodes))
      },
    })

  // Wrap onNodesChange/onEdgesChange to push history before removals
  const onNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChangeBase>[0]) => {
      if (changes.some((c) => c.type === 'remove')) {
        pushSnapshot(nodesRef.current, edgesRef.current)
      }
      onNodesChangeBase(changes)
    },
    [onNodesChangeBase, pushSnapshot],
  )

  const onEdgesChange = useCallback(
    (changes: Parameters<typeof onEdgesChangeBase>[0]) => {
      if (changes.some((c) => c.type === 'remove')) {
        pushSnapshot(nodesRef.current, edgesRef.current)
      }
      onEdgesChangeBase(changes)
    },
    [onEdgesChangeBase, pushSnapshot],
  )

  const project = useQuery(api.projects.get, { id: projectId })
  const allModels = useQuery(api.models.list) ?? []
  const createGeneration = useMutation(api.generations.create)
  const setFalRequestId = useMutation(api.generations.setFalRequestId)
  const completeTextGeneration = useMutation(api.generations.completeTextGeneration)

  const agentModels = allModels.map((m) => ({
    falId: m.falId,
    name: m.name,
    provider: m.provider,
    contentType: m.contentType,
    inputs: m.inputs.map((i) => ({
      name: i.name,
      type: i.type,
      required: i.required,
    })),
    outputType: m.outputType,
  }))

  const agent = useAgentChat({
    projectId,
    nodes,
    edges,
    setNodes,
    setEdges,
    nodeIdRef,
    models: agentModels,
    pushSnapshot,
  })

  const { saveStatus, initializeBaseline } = useAutoSave({
    projectId,
    nodes,
    edges,
    enabled: isLoaded,
  })

  const { capture: captureThumbnail } = useCanvasThumbnail(projectId)
  const prevSaveStatusRef = useRef<SaveStatus>('saved')

  // Capture thumbnail after each successful save (throttled inside the hook)
  useEffect(() => {
    if (prevSaveStatusRef.current === 'saving' && saveStatus === 'saved') {
      captureThumbnail()
    }
    prevSaveStatusRef.current = saveStatus
  }, [saveStatus, captureThumbnail])

  // Also capture on unmount (navigating away)
  useEffect(() => {
    return () => {
      captureThumbnail()
    }
  }, [captureThumbnail])

  // One-time initialization from project data
  useEffect(() => {
    if (project && !initialLoadRef.current) {
      initialLoadRef.current = true
      const loadedNodes = project.nodes as Array<Node>
      const loadedEdges = project.edges as Array<Edge>
      setNodes(loadedNodes)
      setEdges(loadedEdges)
      nodeIdRef.current = computeMaxNodeId(loadedNodes)
      initializeBaseline()
      initializeHistory()
      requestAnimationFrame(() => setIsLoaded(true))

      // Restore dead sandboxes for website nodes
      for (const node of loadedNodes) {
        const nd = node.data as Record<string, unknown>
        if (nd?.contentType !== 'website' || !nd?.sandboxId) continue

        // Mark node as restoring
        const updateNodeData = (patch: Record<string, unknown>) =>
          setNodes((prev) => prev.map((n) =>
            n.id === node.id ? { ...n, data: { ...n.data, ...patch } } : n,
          ))

        updateNodeData({ restoreStep: 'Connecting...' })

        reconnectOrRestore({
          data: {
            sandboxId: nd.sandboxId as string,
            projectId: projectId as string,
            templateName: (nd.templateName as string) || undefined,
          },
        }).then(async (response) => {
          const res = response as unknown as Response
          const reader = res.body?.getReader()
          if (!reader) return
          const decoder = new TextDecoder()
          let buffer = ''
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''
            for (const line of lines) {
              if (!line.trim()) continue
              try {
                const event = JSON.parse(line)
                if (event.type === 'status') {
                  updateNodeData({ restoreStep: event.step })
                } else if (event.type === 'done') {
                  updateNodeData({
                    sandboxId: event.sandboxId,
                    previewUrl: event.previewUrl,
                    restoreStep: null,
                  })
                } else if (event.type === 'error') {
                  updateNodeData({ restoreStep: `Error: ${event.message}` })
                }
              } catch { /* skip */ }
            }
          }
        }).catch((e) => {
          console.error('[sandbox-restore]', e)
          updateNodeData({ restoreStep: 'Restore failed' })
        })
      }
    }
  }, [project])

  const getNextId = () => generateNodeId(++nodeIdRef.current)

  const isValidConnection = useCallback(
    (connection: Edge | Connection) => validateConnection(connection, edges),
    [edges],
  )

  // Keyboard shortcuts (copy, paste, delete, duplicate, select-all)
  const { handleKeyDown, handleDelete, handleDuplicate } = useCanvasKeyboard({
    nodes,
    edges,
    setNodes,
    setEdges,
    nodeIdCounter: nodeIdRef,
    pushSnapshot,
    undo,
    redo,
  })

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const onConnect: OnConnect = useCallback(
    (connection) => {
      pushSnapshot(nodesRef.current, edgesRef.current)

      const sourceType = connection.sourceHandle?.replace(
        'output-',
        '',
      ) as PortType
      const color =
        sourceType in PORT_TYPE_COLORS
          ? PORT_TYPE_COLORS[sourceType]
          : '#71717a'

      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            style: { stroke: color, strokeWidth: 2 },
          },
          eds,
        ),
      )
    },
    [setEdges, pushSnapshot],
  )

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      const rawContentType = event.dataTransfer.getData('application/reactflow')
      if (!rawContentType) return

      pushSnapshot(nodesRef.current, edgesRef.current)
      const contentType = rawContentType as NodeContentType

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      const id = getNextId()
      const defaults = NODE_DEFAULTS[contentType]
      const newNode: Node<BlockNodeData> = {
        id,
        type: 'blockNode',
        position,
        style: { width: defaults.width, height: defaults.height },
        data: {
          contentType,
          label: `New ${contentType} block`,
          prompt: '',
          model: '',
          generationStatus: 'idle',
        },
      }

      setNodes((nds) => [...nds, newNode])
    },
    [screenToFlowPosition, setNodes, pushSnapshot],
  )

  const addNodeAtCenter = useCallback(
    (contentType: NodeContentType) => {
      if (!reactFlowWrapper.current) return

      pushSnapshot(nodesRef.current, edgesRef.current)
      const rect = reactFlowWrapper.current.getBoundingClientRect()
      const position = screenToFlowPosition({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      })

      const id = getNextId()
      const defaults = NODE_DEFAULTS[contentType]
      const newNode: Node<BlockNodeData> = {
        id,
        type: 'blockNode',
        position,
        style: { width: defaults.width, height: defaults.height },
        data: {
          contentType,
          label: `New ${contentType} block`,
          prompt: '',
          model: '',
          generationStatus: 'idle',
        },
      }

      setNodes((nds) => [...nds, newNode])
    },
    [screenToFlowPosition, setNodes, pushSnapshot],
  )

  const addUploadNode = useCallback(
    (contentType: NodeContentType, uploadId: string, url: string) => {
      if (!reactFlowWrapper.current) return

      pushSnapshot(nodesRef.current, edgesRef.current)
      const rect = reactFlowWrapper.current.getBoundingClientRect()
      const position = screenToFlowPosition({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      })

      const id = getNextId()
      const defaults = NODE_DEFAULTS[contentType]
      const newNode: Node<BlockNodeData> = {
        id,
        type: 'blockNode',
        position,
        style: { width: defaults.width, height: defaults.height },
        data: {
          contentType,
          label: `Uploaded ${contentType}`,
          prompt: '',
          model: '',
          generationStatus: 'completed',
          uploadId,
          isUpload: true,
          resultUrl: url,
        },
      }

      setNodes((nds) => [...nds, newNode])
    },
    [screenToFlowPosition, setNodes, pushSnapshot],
  )

  const addNodeAtPosition = useCallback(
    (contentType: NodeContentType, position: { x: number; y: number }) => {
      pushSnapshot(nodesRef.current, edgesRef.current)
      const id = getNextId()
      const defaults = NODE_DEFAULTS[contentType]
      const newNode: Node<BlockNodeData> = {
        id,
        type: 'blockNode',
        position,
        style: { width: defaults.width, height: defaults.height },
        data: {
          contentType,
          label: `New ${contentType} block`,
          prompt: '',
          model: '',
          generationStatus: 'idle',
        },
      }
      setNodes((nds) => [...nds, newNode])
    },
    [setNodes, pushSnapshot],
  )

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault()
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        targetNode: node as Node<BlockNodeData>,
        flowPosition: screenToFlowPosition({ x: event.clientX, y: event.clientY }),
      })
    },
    [screenToFlowPosition],
  )

  const onPaneContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent) => {
      event.preventDefault()
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        targetNode: null,
        flowPosition: screenToFlowPosition({ x: event.clientX, y: event.clientY }),
      })
    },
    [screenToFlowPosition],
  )

  const onNodeDragStart = useCallback(() => {
    pushSnapshot(nodesRef.current, edgesRef.current)
  }, [pushSnapshot])

  const handleGenerate = useCallback(
    async (sourceNodeId: string) => {
      if (generatingRef.current.has(sourceNodeId)) return

      await executeGeneration(
        sourceNodeId,
        {
          getNode,
          edges: edgesRef.current,
          createGeneration: async (args) => {
            const id = await createGeneration(args)
            return id as unknown as string
          },
          submitToFal: (args) => submitToFal(args),
          setFalRequestId: async (args) => {
            await setFalRequestId({ id: args.id as never, falRequestId: args.falRequestId })
          },
          submitToOpenRouter: async ({ data, onDelta }) => {
            const response = await submitToOpenRouter({ data })
            const res = response instanceof Response
              ? response
              : new Response(JSON.stringify(response))
            if (!res.body) throw new Error('No response body')

            const reader = res.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''
            let fullText = ''
            let usage = { inputTokens: 0, outputTokens: 0 }

            for (;;) {
              const { done, value } = await reader.read()
              if (done) break
              buffer += decoder.decode(value, { stream: true })
              const lines = buffer.split('\n')
              buffer = lines.pop() || ''

              for (const line of lines) {
                if (!line.trim()) continue
                let event: Record<string, unknown>
                try { event = JSON.parse(line) } catch { continue }

                if (event.type === 'text_delta') {
                  fullText += event.content as string
                  onDelta(fullText)
                } else if (event.type === 'done') {
                  fullText = (event.text as string) || fullText
                  const u = event.usage as { inputTokens: number; outputTokens: number } | undefined
                  if (u) usage = u
                } else if (event.type === 'error') {
                  throw new Error(event.message as string)
                }
              }
            }

            return { text: fullText, usage }
          },
          completeTextGeneration: async (args) => {
            await completeTextGeneration({
              generationId: args.generationId as never,
              resultText: args.resultText,
              inputTokens: args.inputTokens,
              outputTokens: args.outputTokens,
            })
          },
        },
        {
          onUpdate: (updates) => {
            setNodes((nds) =>
              nds.map((n) =>
                n.id === sourceNodeId
                  ? { ...n, data: { ...n.data, ...updates } as BlockNodeData }
                  : n,
              ),
            )
          },
          onLock: () => generatingRef.current.add(sourceNodeId),
          onUnlock: () => generatingRef.current.delete(sourceNodeId),
        },
      )
    },
    [getNode, setNodes, createGeneration, setFalRequestId, completeTextGeneration],
  )

  // Show loading until project data arrives
  if (!project) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={24} className="text-zinc-500 animate-spin" />
          <span className="text-sm text-zinc-500">Loading project...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full relative">
      <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
        <Sidebar onAddNode={addNodeAtCenter} onAddUploadNode={addUploadNode} />
      </div>

      <div ref={reactFlowWrapper} className="w-full h-full">
        <CanvasActionsContext.Provider value={{ onGenerate: handleGenerate }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            isValidConnection={isValidConnection}
            connectionRadius={20}
            selectionOnDrag
            selectionMode={SelectionMode.Partial}
            panOnDrag={[1, 2]}
            panOnScroll
            zoomOnScroll={false}
            zoomOnPinch
            elevateNodesOnSelect
            onNodeDragStart={onNodeDragStart}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeContextMenu={onNodeContextMenu}
            onPaneContextMenu={onPaneContextMenu}
            onPaneClick={() => setContextMenu(null)}
            onNodeClick={() => setContextMenu(null)}
            onMoveStart={() => setContextMenu(null)}
            nodeTypes={nodeTypes}
            fitView
            colorMode="dark"
            style={{ cursor: 'default' }}
            proOptions={{ hideAttribution: true }}
          >
            <Background
              variant={BackgroundVariant.Cross}
              gap={40}
              size={1}
              color="#52525b"
              style={{ backgroundColor: '#09090b' }}
            />
            <Panel position="top-center">
              <div className="bg-zinc-900 px-5 py-2.5 rounded-xl border border-zinc-800 shadow-[0_4px_16px_rgba(0,0,0,0.4)] mt-5 flex items-center gap-4">
                <div>
                  <div className="text-sm font-semibold text-zinc-200">
                    {project.name}
                  </div>
                  <SaveIndicator status={saveStatus} />
                </div>
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={undo}
                    disabled={!canUndo}
                    className={`p-1.5 rounded-lg transition-colors ${
                      canUndo
                        ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                        : 'text-zinc-700 cursor-not-allowed'
                    }`}
                    title="Undo (Ctrl+Z)"
                  >
                    <Undo2 size={14} />
                  </button>
                  <button
                    onClick={redo}
                    disabled={!canRedo}
                    className={`p-1.5 rounded-lg transition-colors ${
                      canRedo
                        ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                        : 'text-zinc-700 cursor-not-allowed'
                    }`}
                    title="Redo (Ctrl+Shift+Z)"
                  >
                    <Redo2 size={14} />
                  </button>
                </div>
                <button
                  onClick={() => setShowVersions(!showVersions)}
                  className={`px-2.5 py-1 text-[10px] font-medium rounded-lg transition-colors ${
                    showVersions
                      ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                      : 'bg-zinc-800 text-zinc-400 hover:text-zinc-300 border border-zinc-700/50'
                  }`}
                >
                  Versions
                </button>
                <button
                  onClick={() => setShowAgent(!showAgent)}
                  className={`px-2.5 py-1 text-[10px] font-medium rounded-lg transition-colors flex items-center gap-1 ${
                    showAgent
                      ? 'bg-zinc-700 text-zinc-200 border border-zinc-600'
                      : 'bg-zinc-800 text-zinc-400 hover:text-zinc-300 border border-zinc-700/50'
                  }`}
                >
                  <Bot size={10} />
                  Agent
                </button>
              </div>
            </Panel>
          </ReactFlow>
        </CanvasActionsContext.Provider>
      </div>

      {showVersions && (
        <VersionPanel
          projectId={projectId}
          onClose={() => setShowVersions(false)}
          onRestore={onVersionRestore}
        />
      )}

      {showAgent && (
        <AgentPanel
          messages={agent.messages}
          isStreaming={agent.isStreaming}
          toolStatus={agent.toolStatus}
          agentModel={agent.agentModel}
          onModelChange={agent.setAgentModel}
          onSend={agent.send}
          onStop={agent.stopStreaming}
          onClear={agent.clearChat}
          onClose={() => setShowAgent(false)}
          chats={agent.chats}
          activeChatId={agent.activeChatId}
          onNewChat={agent.newChat}
          onSwitchChat={agent.switchChat}
          onDeleteChat={agent.deleteChat}
        />
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          targetNode={contextMenu.targetNode}
          flowPosition={contextMenu.flowPosition}
          onClose={() => setContextMenu(null)}
          onDelete={() => {
            if (contextMenu.targetNode) {
              pushSnapshot(nodesRef.current, edgesRef.current)
              const nodeId = contextMenu.targetNode.id
              setNodes((nds) => nds.filter((n) => n.id !== nodeId))
              setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId))
            } else {
              handleDelete()
            }
          }}
          onDuplicate={() => {
            if (contextMenu.targetNode) {
              // Select only the target node, then duplicate
              setNodes((nds) =>
                nds.map((n) => ({ ...n, selected: n.id === contextMenu.targetNode!.id })),
              )
              // Need a tick for selection to propagate
              requestAnimationFrame(() => handleDuplicate())
            } else {
              handleDuplicate()
            }
          }}
          onAddNode={addNodeAtPosition}
        />
      )}
    </div>
  )
}

interface CanvasProps {
  projectId: Id<'projects'>
}

export default function Canvas({ projectId }: CanvasProps) {
  const [canvasKey, setCanvasKey] = useState(0)

  const handleVersionRestore = useCallback(() => {
    setCanvasKey((k) => k + 1)
  }, [])

  return (
    <ReactFlowProvider>
      <CanvasFlow
        key={canvasKey}
        projectId={projectId}
        onVersionRestore={handleVersionRestore}
      />
    </ReactFlowProvider>
  )
}
