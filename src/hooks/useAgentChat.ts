import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { addEdge } from '@xyflow/react'

import { api } from '../../convex/_generated/api'

import type { Edge, Node } from '@xyflow/react'
import type { Id } from '../../convex/_generated/dataModel'
import type {
  AgentAction,
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
import { generateResearchPdf } from '@/utils/pdfGeneration'

type UseAgentChatOptions = {
  projectId: Id<'projects'>
  nodes: Array<Node>
  edges: Array<Edge>
  setNodes: React.Dispatch<React.SetStateAction<Array<Node>>>
  setEdges: React.Dispatch<React.SetStateAction<Array<Edge>>>
  nodeIdRef: React.RefObject<number>
  models: Array<AvailableModel>
  pushSnapshot?: (nodes: Node[], edges: Edge[]) => void
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
}: UseAgentChatOptions) {
  const [activeChatId, setActiveChatId] = useState<Id<'chats'> | null>(null)
  const [messages, setMessages] = useState<Array<ChatMessage>>([])
  const [streamingChatId, setStreamingChatId] = useState<Id<'chats'> | null>(
    null,
  )
  const [toolStatus, setToolStatus] = useState<string | null>(null)
  const [agentModel, setAgentModel] = useState(DEFAULT_AGENT_MODEL)
  const abortRef = useRef<AbortController | null>(null)
  const readerRef = useRef<ReadableStreamDefaultReader | null>(null)
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
  }, [activeChatId, savedMessages])

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
              if (action.prompt !== undefined) data.prompt = action.prompt
              if (action.model !== undefined) data.model = action.model
              if (action.label !== undefined) data.label = action.label
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
    [setNodes, setEdges, nodeIdRef, pushSnapshot],
  )

  // Build canvas state snapshot for the server
  const getCanvasState = useCallback(() => {
    const canvasNodes: Array<CanvasNode> = nodesRef.current.map((n) => {
      const d = n.data as BlockNodeData
      return {
        id: n.id,
        contentType: d.contentType,
        label: d.label,
        prompt: d.prompt,
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
    return { nodes: canvasNodes, edges: canvasEdges }
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

  // Send a message to the agent
  const send = useCallback(
    async (content: string) => {
      if (!content.trim() || (streamingChatId != null && streamingChatId === activeChatId)) return

      // Auto-create a chat if none exists
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

      // Save user message to Convex
      await sendMessage({
        chatId,
        role: 'user',
        content,
      })

      // Auto-title: use first message as chat title (truncated)
      if (messagesRef.current.length === 0) {
        const title =
          content.length > 50 ? content.slice(0, 47) + '...' : content
        await updateChatTitle({ chatId, title })
      }

      setStreamingChatId(chatId)
      const controller = new AbortController()
      abortRef.current = controller

      // Prepare assistant message placeholder
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: '',
        actions: [],
        createdAt: Date.now(),
      }
      setMessages((prev) => [...prev, assistantMsg])

      try {
        // Build the messages history for context (last 20 messages)
        // messagesRef.current may already include userMsg after the React re-render
        // triggered by setMessages + the awaits above. Only append if it's missing.
        const currentMsgs = messagesRef.current
        const alreadyHasUserMsg = currentMsgs.length > 0 &&
          currentMsgs[currentMsgs.length - 1].role === 'user' &&
          currentMsgs[currentMsgs.length - 1].content === content
        const historyMessages = (alreadyHasUserMsg ? currentMsgs : [...currentMsgs, userMsg])
          .slice(-20)
          .map((m) => ({ role: m.role, content: m.content }))

        const canvasState = getCanvasState()

        // Call server function — returns a streaming Response
        // Wrap with abort support since createServerFn doesn't accept signals
        const { agentChat } = await import('@/data/agent')
        const response = await Promise.race([
          agentChat({
            data: {
              messages: historyMessages,
              canvasState,
              models,
              agentModel,
              projectId: projectId as string,
            },
          }),
          new Promise<never>((_, reject) => {
            controller.signal.addEventListener('abort', () =>
              reject(new DOMException('Aborted', 'AbortError')),
            )
          }),
        ])

        // Handle case where createServerFn wraps the response
        const res =
          response instanceof Response
            ? response
            : new Response(JSON.stringify(response))

        if (!res.body) throw new Error('No response body')

        const reader = res.body.getReader()
        readerRef.current = reader
        const decoder = new TextDecoder()
        let buffer = ''
        let fullContent = ''
        const allActions: Array<AgentAction> = []
        const allParts: Array<MessagePart> = []

        // Only update UI if this stream's chat is still the active one
        const isActive = () => activeChatIdRef.current === chatId

        // Helper to update the last assistant message
        const updateAssistant = (
          updates: Partial<ChatMessage>,
        ) => {
          if (!isActive()) return
          setMessages((prev) => {
            const updated = [...prev]
            const last = updated.at(-1)
            if (last?.role === 'assistant') {
              updated[updated.length - 1] = { ...last, ...updates }
            }
            return updated
          })
        }

        for (;;) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.trim()) continue
            let event: StreamEvent
            try {
              event = JSON.parse(line) as StreamEvent
            } catch {
              continue
            }

            switch (event.type) {
              case 'text_delta': {
                if (isActive()) setToolStatus(null)
                fullContent += event.content
                const lastPart = allParts.at(-1)
                if (lastPart?.type === 'text') {
                  lastPart.content += event.content
                } else {
                  allParts.push({ type: 'text', content: event.content })
                }
                updateAssistant({
                  content: fullContent,
                  parts: [...allParts],
                })
                break
              }

              case 'reasoning': {
                // Append to current reasoning part, or start a new one.
                // Within each agentic round, reasoning streams before content/tools,
                // so checking the last part correctly groups chunks per round.
                const last = allParts.at(-1)
                if (last?.type === 'reasoning') {
                  last.content += event.content
                } else {
                  allParts.push({ type: 'reasoning', content: event.content })
                }
                updateAssistant({ parts: [...allParts] })
                break
              }

              case 'tool_status':
                if (isActive()) setToolStatus(event.status)
                break

              case 'tool_start':
                allParts.push({
                  type: 'tool_call',
                  tool: event.tool,
                  args: event.args,
                  status: 'pending',
                })
                updateAssistant({ parts: [...allParts] })
                break

              case 'tool_call': {
                if (isActive()) setToolStatus(null)
                let matched = false
                // Match by tool name first, then fall back to any pending
                for (let idx = allParts.length - 1; idx >= 0; idx--) {
                  const p = allParts[idx]
                  if (p.type === 'tool_call' && p.status === 'pending' && p.tool === event.tool) {
                    allParts[idx] = { ...p, args: event.args, status: 'done', error: event.error }
                    matched = true
                    break
                  }
                }
                if (!matched) {
                  for (let idx = allParts.length - 1; idx >= 0; idx--) {
                    const p = allParts[idx]
                    if (p.type === 'tool_call' && p.status === 'pending') {
                      allParts[idx] = { ...p, args: event.args, status: 'done', error: event.error }
                      matched = true
                      break
                    }
                  }
                }
                if (!matched) {
                  allParts.push({ type: 'tool_call', tool: event.tool, args: event.args, status: 'done', error: event.error })
                }
                updateAssistant({ parts: [...allParts] })
                break
              }

              case 'action': {
                if (isActive()) setToolStatus(null)

                if (event.action.type === 'create_pdf') {
                  createPdfFromAction(event.action)
                  const slim = {
                    ...event.action,
                    markdown: '[content]',
                  } as AgentAction
                  allActions.push(slim)
                  allParts.push({ type: 'action', action: slim })
                } else {
                  applyAction(event.action)
                  allActions.push(event.action)
                  allParts.push({ type: 'action', action: event.action })
                }

                updateAssistant({
                  actions: [...allActions],
                  parts: [...allParts],
                })
                break
              }

              case 'resources':
                if (isActive()) setToolStatus(null)
                allParts.push({ type: 'resources', sources: event.sources })
                updateAssistant({ parts: [...allParts] })
                break

              case 'error': {
                fullContent += `\n\nError: ${event.message}`
                const errLastPart = allParts.at(-1)
                if (errLastPart?.type === 'text') {
                  errLastPart.content += `\n\nError: ${event.message}`
                } else {
                  allParts.push({
                    type: 'text',
                    content: `\n\nError: ${event.message}`,
                  })
                }
                updateAssistant({
                  content: fullContent,
                  parts: [...allParts],
                })
                break
              }

              case 'done':
                if (isActive()) setToolStatus(null)
                break
            }
          }
        }

        // Save assistant message to Convex (skip if aborted)
        if (abortRef.current === controller) {
          await sendMessage({
            chatId,
            role: 'assistant',
            content: fullContent,
            actions: allActions.length > 0 ? allActions : undefined,
            parts: allParts.length > 0 ? allParts : undefined,
          })
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError' && abortRef.current === controller) {
          const errMsg =
            err instanceof Error ? err.message : 'Failed to reach agent'
          setMessages((prev) => {
            const updated = [...prev]
            const last = updated.at(-1)
            if (last?.role === 'assistant') {
              updated[updated.length - 1] = {
                ...last,
                content: `Error: ${errMsg}`,
              }
            }
            return updated
          })
        }
      } finally {
        readerRef.current = null
        // Only clear streaming state if this is still the active stream
        if (abortRef.current === controller) {
          setStreamingChatId(null)
          setToolStatus(null)
          abortRef.current = null
        }
      }
    },
    [
      streamingChatId,
      activeChatId,
      projectId,
      models,
      agentModel,
      createChat,
      sendMessage,
      updateChatTitle,
      getCanvasState,
      applyAction,
      createPdfFromAction,
    ],
  )

  const stopStreaming = useCallback(() => {
    readerRef.current?.cancel()
    readerRef.current = null
    abortRef.current?.abort()
    abortRef.current = null
    setStreamingChatId(null)
    setToolStatus(null)
  }, [])

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
