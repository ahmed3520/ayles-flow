import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { addEdge } from '@xyflow/react'

import { api } from '../../convex/_generated/api'

import type { Edge, Node } from '@xyflow/react'
import type { Id } from '../../convex/_generated/dataModel'
import type {
  ActiveTextEditorState,
  AgentAction,
  AgentChatInput,
  AgentTextEditorBridge,
  AvailableModel,
  CanvasEdge,
  CanvasNode,
  ChatMessage,
  CreatePdfAction,
  MessagePart,
  StreamEvent,
} from '@/types/agent'
import type { BlockNodeData } from '@/types/nodes'
import { DEFAULT_AGENT_MODEL } from '@/config/agentModels'
import { NODE_DEFAULTS, PORT_TYPE_COLORS } from '@/types/nodes'
import { createAgentStreamAccumulator } from '@/utils/agentStreamAccumulator'
import {
  getNodeReadableText,
  getTextNodeDocument,
  getTextNodeDocumentUpdate,
  replaceNodeDocumentText,
} from '@/utils/nodeTextUtils'
import { getFormattedTextNodeUpdate } from '@/utils/textDocumentFormatting'
import { generateResearchPdf } from '@/utils/pdfGeneration'
import {
  cancelStream,
  fetchStreamStatus,
  runResumableStream,
} from '@/utils/resumableStream'

type UseAgentChatOptions = {
  projectId: Id<'projects'>
  nodes: Array<Node>
  edges: Array<Edge>
  setNodes: React.Dispatch<React.SetStateAction<Array<Node>>>
  setEdges: React.Dispatch<React.SetStateAction<Array<Edge>>>
  nodeIdRef: React.RefObject<number>
  models: Array<AvailableModel>
  pushSnapshot?: (nodes: Array<Node>, edges: Array<Edge>) => void
  activeTextEditorRef?: React.RefObject<ActiveTextEditorState | null>
  textEditorBridgeRef?: React.RefObject<AgentTextEditorBridge | null>
}

export function useAgentChat({
  projectId,
  nodes,
  edges,
  setNodes,
  setEdges,
  nodeIdRef,
  models,
  pushSnapshot,
  activeTextEditorRef,
  textEditorBridgeRef,
}: UseAgentChatOptions) {
  const [activeChatId, setActiveChatId] = useState<Id<'chats'> | null>(null)
  const [messages, setMessages] = useState<Array<ChatMessage>>([])
  const [streamingChatId, setStreamingChatId] = useState<Id<'chats'> | null>(
    null,
  )
  const [toolStatus, setToolStatus] = useState<string | null>(null)
  const [agentModel, setAgentModel] = useState(DEFAULT_AGENT_MODEL)
  const abortRef = useRef<AbortController | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const streamIdRef = useRef<string | null>(null)
  const eventIndexRef = useRef(0)
  const isResumingRef = useRef(false)

  const streamStorageKey = `agent-stream:${projectId as string}`

  const persistStream = useCallback(
    (streamId: string | null, eventIndex = 0, chatId?: string) => {
      streamIdRef.current = streamId
      eventIndexRef.current = eventIndex
      if (streamId) {
        localStorage.setItem(
          streamStorageKey,
          JSON.stringify({ streamId, eventIndex, chatId }),
        )
      } else {
        localStorage.removeItem(streamStorageKey)
      }
    },
    [streamStorageKey],
  )

  const getPersistedStream = useCallback((): {
    streamId: string
    eventIndex: number
    chatId?: string
  } | null => {
    try {
      const raw = localStorage.getItem(streamStorageKey)
      if (!raw) return null
      return JSON.parse(raw) as {
        streamId: string
        eventIndex: number
        chatId?: string
      }
    } catch {
      return null
    }
  }, [streamStorageKey])

  const getHttpBase = useCallback(() => {
    const raw =
      ((import.meta as any).env.VITE_LLM_SERVER_URL as string | undefined) ||
      (window.location.hostname === 'localhost'
        ? 'http://localhost:9400'
        : 'https://lm.aylesflow.com')
    return raw.replace(/\/$/, '')
  }, [])

  const getWsBase = useCallback(() => {
    const raw =
      ((import.meta as any).env.VITE_LLM_WS_URL as string | undefined) ||
      ((import.meta as any).env.VITE_LLM_SERVER_URL as string | undefined) ||
      (window.location.hostname === 'localhost'
        ? 'ws://localhost:9400'
        : 'wss://lm.aylesflow.com')
    const wsBase = raw.startsWith('ws') ? raw : raw.replace(/^http/i, 'ws')
    return wsBase.replace(/\/$/, '')
  }, [])
  const loadedChatRef = useRef<string | null>(null)
  const activeChatIdRef = useRef<Id<'chats'> | null>(null)
  activeChatIdRef.current = activeChatId
  const messagesRef = useRef<Array<ChatMessage>>([])
  messagesRef.current = messages

  // Convex queries
  const chatList = useQuery(api.chats.list, { projectId })
  const savedMessages = useQuery(
    api.chatMessages.list,
    activeChatId ? { chatId: activeChatId } : 'skip',
  )

  // Convex mutations
  const createChat = useMutation(api.chats.create)
  const updateChatTitle = useMutation(api.chats.updateTitle)
  const removeChat = useMutation(api.chats.remove)
  const sendMessage = useMutation(api.chatMessages.send)
  const clearMessages = useMutation(api.chatMessages.clear)
  const generateUploadUrl = useMutation(api.uploads.generateUploadUrl)
  const saveUpload = useMutation(api.uploads.saveUpload)

  // Keep refs to latest nodes/edges for canvas state snapshot
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  nodesRef.current = nodes
  edgesRef.current = edges

  // Auto-select the most recent chat on first load
  useEffect(() => {
    if (chatList && chatList.length > 0 && !activeChatId) {
      setActiveChatId(chatList[0]._id)
    }
  }, [chatList, activeChatId])

  // Load messages when active chat changes
  useEffect(() => {
    if (!activeChatId) {
      setMessages([])
      loadedChatRef.current = null
      return
    }

    // Avoid clobbering in-progress streamed UI with stale DB snapshot.
    if (streamingChatId != null && streamingChatId === activeChatId) {
      return
    }

    if (savedMessages && loadedChatRef.current !== activeChatId) {
      loadedChatRef.current = activeChatId
      setMessages(
        savedMessages.map((m) => ({
          id: m._id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          actions: m.actions as Array<AgentAction> | undefined,
          parts: m.parts as Array<MessagePart> | undefined,
          createdAt: m.createdAt,
        })),
      )
    }
  }, [activeChatId, savedMessages, streamingChatId])

  // PDF creation: async, client-side via jspdf + Convex upload
  const createPdfFromAction = useCallback(
    async (action: CreatePdfAction) => {
      try {
        const blob = await generateResearchPdf(
          action.title,
          action.markdown,
          action.sources,
        )

        const uploadUrl = await generateUploadUrl()
        const res = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/pdf' },
          body: blob,
        })
        if (!res.ok) throw new Error('Upload failed')

        const { storageId } = (await res.json()) as { storageId: string }
        const { url } = await saveUpload({
          storageId,
          fileName: `${action.title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')}.pdf`,
          fileType: 'application/pdf',
          fileSize: blob.size,
          contentCategory: 'pdf',
        })

        const nodeId = `node-${++nodeIdRef.current}`
        setNodes((nds) => [
          ...nds,
          {
            id: nodeId,
            type: 'blockNode',
            position: { x: action.x, y: action.y },
            data: {
              contentType: 'pdf',
              label: action.title,
              prompt: '',
              model: '',
              generationStatus: 'completed',
              isUpload: true,
              resultUrl: url,
            } satisfies BlockNodeData,
          },
        ])
      } catch (err) {
        console.error('PDF creation failed:', err)
      }
    },
    [generateUploadUrl, saveUpload, setNodes, nodeIdRef],
  )

  // Apply a single action to the canvas
  const applyAction = useCallback(
    (action: AgentAction) => {
      pushSnapshot?.(nodesRef.current, edgesRef.current)
      switch (action.type) {
        case 'add_node': {
          const nodeId = action.nodeId
          // Keep nodeIdRef in sync so manual adds don't collide
          const match = nodeId.match(/^node-(\d+)$/)
          if (match) {
            nodeIdRef.current = Math.max(
              nodeIdRef.current,
              parseInt(match[1], 10),
            )
          }

          const defaults = NODE_DEFAULTS[action.contentType]
          const newNode: Node<BlockNodeData> = {
            id: nodeId,
            type: 'blockNode',
            position: { x: action.x, y: action.y },
            style: { width: defaults.width, height: defaults.height },
            data: {
              contentType: action.contentType,
              label: action.label || `New ${action.contentType} block`,
              prompt: action.prompt || '',
              model: action.model || '',
              generationStatus: 'idle',
              ...(action.previewUrl && { previewUrl: action.previewUrl }),
              ...(action.sandboxId && { sandboxId: action.sandboxId }),
            },
          }
          setNodes((nds) => [...nds, newNode])
          break
        }

        case 'connect_nodes': {
          const portType = action.portType
          const color =
            portType in PORT_TYPE_COLORS
              ? PORT_TYPE_COLORS[portType]
              : '#71717a'

          setEdges((eds) =>
            addEdge(
              {
                id: action.edgeId,
                source: action.sourceNodeId,
                target: action.targetNodeId,
                sourceHandle: `output-${action.portType}`,
                targetHandle: `input-${action.portType}`,
                style: { stroke: color, strokeWidth: 2 },
              },
              eds,
            ),
          )
          break
        }

        case 'update_node': {
          setNodes((nds) =>
            nds.map((n) => {
              if (n.id !== action.nodeId) return n
              const data = { ...n.data } as BlockNodeData
              const isEditableTextDocument =
                data.contentType === 'text' &&
                (data.generationStatus === 'completed' ||
                  data.resultText !== undefined)
              if (action.document !== undefined && isEditableTextDocument) {
                Object.assign(data, getTextNodeDocumentUpdate(action.document))
              }
              if (
                action.findText !== undefined &&
                action.replaceText !== undefined &&
                isEditableTextDocument
              ) {
                const nextDocument = replaceNodeDocumentText(
                  getTextNodeDocument(data),
                  action.findText,
                  action.replaceText,
                  action.replaceAll,
                )
                if (nextDocument !== null) {
                  Object.assign(data, getTextNodeDocumentUpdate(nextDocument))
                }
              }
              if (action.prompt !== undefined) {
                if (isEditableTextDocument) {
                  Object.assign(data, getTextNodeDocumentUpdate(action.prompt))
                } else {
                  data.prompt = action.prompt
                }
              }
              if (action.model !== undefined) data.model = action.model
              if (action.label !== undefined) data.label = action.label
              return { ...n, data }
            }),
          )
          break
        }

        case 'edit_text_node': {
          if (
            textEditorBridgeRef?.current?.nodeId === action.nodeId &&
            textEditorBridgeRef.current.applyTextEditAction(action)
          ) {
            break
          }
          break
        }

        case 'format_text_node': {
          if (
            action.target !== 'text' &&
            textEditorBridgeRef?.current?.nodeId === action.nodeId &&
            textEditorBridgeRef.current.applyTextFormatAction(action)
          ) {
            break
          }

          setNodes((nds) =>
            nds.map((n) => {
              if (n.id !== action.nodeId) return n
              const data = { ...n.data } as BlockNodeData
              if (data.contentType !== 'text') return n

              if (action.target !== 'text' || !action.targetText?.trim()) {
                return n
              }

              const nextUpdate = getFormattedTextNodeUpdate(
                getTextNodeDocument(data),
                {
                  format: action.format,
                  targetText: action.targetText,
                  level: action.level,
                  replaceAll: action.replaceAll,
                },
              )

              if (!nextUpdate) return n
              Object.assign(data, nextUpdate)
              return { ...n, data }
            }),
          )
          break
        }

        case 'delete_nodes': {
          const idSet = new Set(action.nodeIds)
          setNodes((nds) => nds.filter((n) => !idSet.has(n.id)))
          setEdges((eds) =>
            eds.filter((e) => !idSet.has(e.source) && !idSet.has(e.target)),
          )
          break
        }

        case 'clear_canvas': {
          setNodes([])
          setEdges([])
          nodeIdRef.current = 0
          break
        }
      }
    },
    [setNodes, setEdges, nodeIdRef, pushSnapshot, textEditorBridgeRef],
  )

  // Build canvas state snapshot for the server
  const getCanvasState = useCallback(() => {
    const canvasNodes: Array<CanvasNode> = nodesRef.current.map((n) => {
      const d = n.data as BlockNodeData
      const prompt = getNodeReadableText(d)
      const document =
        d.contentType === 'text' ? getTextNodeDocument(d) : undefined
      return {
        id: n.id,
        contentType: d.contentType,
        label: d.label,
        prompt,
        document,
        documentText:
          d.contentType === 'text' ? prompt || undefined : undefined,
        model: d.model,
        generationStatus: d.generationStatus,
        resultUrl: d.resultUrl,
        x: n.position.x,
        y: n.position.y,
      }
    })
    const canvasEdges: Array<CanvasEdge> = edgesRef.current.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? undefined,
      targetHandle: e.targetHandle ?? undefined,
    }))
    return {
      nodes: canvasNodes,
      edges: canvasEdges,
      activeTextEditor: activeTextEditorRef?.current ?? null,
    }
  }, [])

  // Create a new chat and switch to it
  const newChat = useCallback(async () => {
    const chatId = await createChat({ projectId })
    setActiveChatId(chatId)
    setMessages([])
    messagesRef.current = []
    loadedChatRef.current = chatId
    return chatId
  }, [projectId, createChat])

  // Switch to an existing chat
  const switchChat = useCallback((chatId: Id<'chats'>) => {
    setActiveChatId(chatId)
    setMessages([])
    messagesRef.current = []
    loadedChatRef.current = null // force reload
  }, [])

  // Delete a chat
  const deleteChat = useCallback(
    async (chatId: Id<'chats'>) => {
      await removeChat({ chatId })

      // If we deleted the active chat, switch to the next one
      if (chatId === activeChatId) {
        const remaining = chatList?.filter((c) => c._id !== chatId)
        if (remaining && remaining.length > 0) {
          setActiveChatId(remaining[0]._id)
          loadedChatRef.current = null
        } else {
          setActiveChatId(null)
          setMessages([])
          loadedChatRef.current = null
        }
      }
    },
    [activeChatId, chatList, removeChat],
  )

  const isFatalStreamEvent = useCallback((event: StreamEvent) => {
    return (
      event.type === 'error' &&
      (event.message.includes('expired') || event.message.includes('not found'))
    )
  }, [])

  const runStreamSession = useCallback(
    async ({
      chatId,
      initialPayload,
      resume,
      assistantPlaceholder,
      errorMessage,
    }: {
      chatId: Id<'chats'>
      initialPayload?: AgentChatInput
      resume?: {
        streamId: string
        afterSeq: number
      }
      assistantPlaceholder: 'always' | 'if-missing'
      errorMessage: string
    }) => {
      setStreamingChatId(chatId)
      const controller = new AbortController()
      abortRef.current = controller

      if (assistantPlaceholder === 'always') {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: '',
            actions: [],
            createdAt: Date.now(),
          },
        ])
      } else {
        setMessages((prev) => {
          const last = prev.at(-1)
          if (last?.role === 'assistant') return prev
          return [
            ...prev,
            {
              role: 'assistant' as const,
              content: '',
              actions: [],
              createdAt: Date.now(),
            },
          ]
        })
      }

      const isActive = () => activeChatIdRef.current === chatId
      const updateAssistant = (updates: Partial<ChatMessage>) => {
        if (!isActive()) return
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated.at(-1)
          if (last?.role === 'assistant') {
            updated[updated.length - 1] = { ...last, ...updates }
          } else {
            updated.push({
              role: 'assistant',
              content: '',
              actions: [],
              createdAt: Date.now(),
              ...updates,
            })
          }
          return updated
        })
      }
      const updateToolStatus = (status: string | null) => {
        if (isActive()) setToolStatus(status)
      }

      const streamAccumulator = createAgentStreamAccumulator({
        updateAssistant,
        setToolStatus: updateToolStatus,
        applyAction,
        createPdfFromAction,
      })

      let wasAborted = false
      try {
        await runResumableStream<StreamEvent>({
          wsUrl: `${getWsBase()}/v1/agent/ws`,
          initialPayload,
          resume,
          controller,
          socketRef,
          onEvent: streamAccumulator.handleEvent,
          onStreamReady: ({ streamId, afterSeq }) => {
            persistStream(streamId, afterSeq, chatId)
          },
          onSequence: ({ streamId, seq }) => {
            persistStream(streamId ?? streamIdRef.current, seq, chatId)
          },
          onReconnect: (attempt, maxRetries) => {
            updateToolStatus(`Reconnecting (${attempt}/${maxRetries})...`)
          },
          isFatalEvent: isFatalStreamEvent,
        })

        const snapshot = streamAccumulator.snapshot()
        const hasAssistantPayload =
          snapshot.content ||
          snapshot.actions.length > 0 ||
          snapshot.parts.length > 0

        if (abortRef.current === controller && hasAssistantPayload) {
          await sendMessage({
            chatId,
            role: 'assistant',
            content: snapshot.content,
            actions: snapshot.actions.length > 0 ? snapshot.actions : undefined,
            parts: snapshot.parts.length > 0 ? snapshot.parts : undefined,
          })
        }
      } catch (err) {
        wasAborted = (err as Error).name === 'AbortError'
        if (!wasAborted && abortRef.current === controller) {
          const message = err instanceof Error ? err.message : errorMessage
          setMessages((prev) => {
            const updated = [...prev]
            const last = updated.at(-1)
            if (last?.role === 'assistant') {
              updated[updated.length - 1] = {
                ...last,
                content: `Error: ${message}`,
              }
            }
            return updated
          })
        }
      } finally {
        socketRef.current?.close(1000, 'cleanup')
        socketRef.current = null
        if (!wasAborted) {
          persistStream(null)
        }
        isResumingRef.current = false
        if (abortRef.current === controller) {
          setStreamingChatId(null)
          setToolStatus(null)
          abortRef.current = null
        }
      }
    },
    [
      applyAction,
      createPdfFromAction,
      getWsBase,
      isFatalStreamEvent,
      persistStream,
      sendMessage,
    ],
  )

  const send = useCallback(
    async (content: string) => {
      if (
        !content.trim() ||
        (streamingChatId != null && streamingChatId === activeChatId)
      )
        return

      let chatId = activeChatId
      if (!chatId) {
        chatId = await createChat({ projectId })
        setActiveChatId(chatId)
        loadedChatRef.current = chatId
      }

      const userMsg: ChatMessage = {
        role: 'user',
        content,
        createdAt: Date.now(),
      }
      setMessages((prev) => [...prev, userMsg])

      await sendMessage({
        chatId,
        role: 'user',
        content,
      })

      if (messagesRef.current.length === 0) {
        const title =
          content.length > 50 ? content.slice(0, 47) + '...' : content
        await updateChatTitle({ chatId, title })
      }

      const currentMsgs = messagesRef.current
      const alreadyHasUserMsg =
        currentMsgs.length > 0 &&
        currentMsgs[currentMsgs.length - 1].role === 'user' &&
        currentMsgs[currentMsgs.length - 1].content === content

      const historyMessages = (
        alreadyHasUserMsg ? currentMsgs : [...currentMsgs, userMsg]
      )
        .slice(-20)
        .map((message) => ({ role: message.role, content: message.content }))

      persistStream(null)

      await runStreamSession({
        chatId,
        assistantPlaceholder: 'always',
        errorMessage: 'Failed to reach agent',
        initialPayload: {
          messages: historyMessages,
          canvasState: getCanvasState(),
          models,
          agentModel,
          projectId: projectId as string,
        },
      })
    },
    [
      streamingChatId,
      activeChatId,
      createChat,
      projectId,
      sendMessage,
      updateChatTitle,
      persistStream,
      runStreamSession,
      getCanvasState,
      models,
      agentModel,
    ],
  )

  const resumeStream = useCallback(
    async (
      savedStreamId: string,
      _savedEventIndex: number,
      savedChatId?: string,
    ) => {
      if (isResumingRef.current || streamingChatId != null) return
      isResumingRef.current = true

      try {
        const status = await fetchStreamStatus(
          `${getHttpBase()}/v1/agent/stream/${savedStreamId}`,
        )
        if (!status.exists || status.done) {
          persistStream(null)
          isResumingRef.current = false
          return
        }
      } catch {
        isResumingRef.current = false
        return
      }

      const chatId =
        (savedChatId as Id<'chats'> | undefined) || activeChatIdRef.current
      if (!chatId) {
        isResumingRef.current = false
        return
      }

      if (activeChatIdRef.current !== chatId) {
        setActiveChatId(chatId)
        activeChatIdRef.current = chatId
      }

      await runStreamSession({
        chatId,
        assistantPlaceholder: 'if-missing',
        errorMessage: 'Failed to resume stream',
        resume: {
          streamId: savedStreamId,
          // After a full page reload we need a full replay to rebuild UI state.
          afterSeq: 0,
        },
      })
    },
    [streamingChatId, getHttpBase, persistStream, runStreamSession],
  )

  // StrictMode remount safety: terminate stale client sockets on unmount.
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      abortRef.current = null
      socketRef.current?.close(1000, 'unmount')
      socketRef.current = null
    }
  }, [])

  // On mount: check if there's a running stream to resume (e.g. after page reload)
  useEffect(() => {
    const persisted = getPersistedStream()
    if (!persisted) return
    console.log('[ws] Found persisted stream on mount:', persisted.streamId)
    resumeStream(persisted.streamId, persisted.eventIndex, persisted.chatId)
  }, [])

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null

    if (streamIdRef.current) {
      cancelStream(
        `${getHttpBase()}/v1/agent/cancel`,
        streamIdRef.current,
      ).catch(() => {})
      persistStream(null)
    }

    socketRef.current?.close(1000, 'stopped')
    socketRef.current = null
    setStreamingChatId(null)
    setToolStatus(null)
  }, [getHttpBase, persistStream])

  const clearChat = useCallback(async () => {
    if (!activeChatId) return
    setMessages([])
    await clearMessages({ chatId: activeChatId })
  }, [activeChatId, clearMessages])

  return {
    messages,
    isStreaming: streamingChatId != null && streamingChatId === activeChatId,
    toolStatus,
    agentModel,
    setAgentModel,
    send,
    stopStreaming,
    clearChat,
    // Chat history
    chats: chatList ?? [],
    activeChatId,
    newChat,
    switchChat,
    deleteChat,
  }
}
