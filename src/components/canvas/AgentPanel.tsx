import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  Bot,
  ChevronDown,
  Globe,
  MessageSquarePlus,
  Send,
  Square,
  Trash2,
  X,
} from 'lucide-react'
import { Streamdown } from 'streamdown'
import { code } from '@streamdown/code'

import type {
  AgentAction,
  ChatMessage,
  CreatePdfAction,
  MessagePart,
} from '@/types/agent'
import type { Id } from '../../../convex/_generated/dataModel'
import { AGENT_MODELS } from '@/config/agentModels'

const streamdownPlugins = { code }

type Chat = {
  _id: Id<'chats'>
  title: string
  createdAt: number
  updatedAt: number
}

function ActionBadge({ action }: { action: AgentAction }) {
  const labels: Record<AgentAction['type'], (a: AgentAction) => string> = {
    add_node: (a) =>
      `Added ${(a as { contentType: string }).contentType} node`,
    connect_nodes: (a) => {
      const c = a as { sourceNodeId: string; targetNodeId: string }
      return `Connected ${c.sourceNodeId} → ${c.targetNodeId}`
    },
    update_node: (a) => `Updated ${(a as { nodeId: string }).nodeId}`,
    delete_nodes: (a) =>
      `Deleted ${(a as { nodeIds: Array<string> }).nodeIds.length} node(s)`,
    clear_canvas: () => 'Cleared canvas',
    create_pdf: (a) => `Created PDF: ${(a as CreatePdfAction).title}`,
  }

  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800 border border-zinc-700/50 text-xs text-zinc-400">
      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/70 shrink-0" />
      {labels[action.type](action)}
    </div>
  )
}

function ToolCallBadge({ label }: { label: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800/60 border border-zinc-700/30 text-xs text-zinc-500">
      <div className="w-1.5 h-1.5 rounded-full bg-blue-500/60 shrink-0" />
      {label}
    </div>
  )
}

function ResourceCards({
  sources,
}: {
  sources: Array<{ title: string; url: string }>
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] text-zinc-500 font-medium uppercase tracking-wider">
        Sources
      </span>
      <div className="flex flex-wrap gap-1.5">
        {sources.map((source, i) => (
          <a
            key={i}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-800/80 border border-zinc-700/40 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors max-w-full"
            title={source.url}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0 text-zinc-500"
            >
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            <span className="truncate">{source.title}</span>
          </a>
        ))}
      </div>
    </div>
  )
}

function MessageParts({
  parts,
  isAnimating,
}: {
  parts: Array<MessagePart>
  isAnimating: boolean
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {parts.map((part, i) => {
        switch (part.type) {
          case 'text':
            return part.content ? (
              <Streamdown
                key={i}
                mode={
                  isAnimating && i === parts.length - 1 ? 'streaming' : 'static'
                }
                plugins={streamdownPlugins}
              >
                {part.content}
              </Streamdown>
            ) : null
          case 'tool_call':
            return (
              <div key={i} className="flex flex-wrap gap-1.5">
                <ToolCallBadge label={part.label} />
              </div>
            )
          case 'action':
            return (
              <div key={i} className="flex flex-wrap gap-1.5">
                <ActionBadge action={part.action} />
              </div>
            )
          case 'resources':
            return <ResourceCards key={i} sources={part.sources} />
          default:
            return null
        }
      })}
    </div>
  )
}

function MessageBubble({
  message,
  isAnimating,
}: {
  message: ChatMessage
  isAnimating: boolean
}) {
  const isUser = message.role === 'user'
  const hasParts = message.parts && message.parts.length > 0

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-zinc-800 text-zinc-200 border border-zinc-700/50'
            : 'bg-zinc-850 text-zinc-300 border border-zinc-800'
        }`}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap break-words">
            {message.content}
          </div>
        ) : hasParts ? (
          <MessageParts parts={message.parts!} isAnimating={isAnimating} />
        ) : message.content ? (
          <Streamdown
            mode={isAnimating ? 'streaming' : 'static'}
            plugins={streamdownPlugins}
          >
            {message.content}
          </Streamdown>
        ) : (
          <span className="text-zinc-600 italic">Thinking...</span>
        )}
        {/* Fallback: show actions at bottom for old messages without parts */}
        {!hasParts && message.actions && message.actions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {message.actions.map((action, i) => (
              <ActionBadge key={i} action={action} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function formatTime(ts: number) {
  const d = new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function ChatListView({
  chats,
  activeChatId,
  onSelect,
  onNew,
  onDelete,
}: {
  chats: Array<Chat>
  activeChatId: Id<'chats'> | null
  onSelect: (id: Id<'chats'>) => void
  onNew: () => void
  onDelete: (id: Id<'chats'>) => void
}) {
  return (
    <div className="flex-1 overflow-y-auto">
      {chats.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center px-6">
          <Bot size={36} className="text-zinc-700 mb-4" />
          <p className="text-sm text-zinc-500 leading-relaxed">
            No conversations yet. Start a new chat to begin.
          </p>
          <button
            onClick={onNew}
            className="mt-4 flex items-center gap-2 px-4 py-2.5 text-sm text-zinc-300 bg-zinc-800 border border-zinc-700/50 rounded-xl hover:bg-zinc-700 transition-colors"
          >
            <MessageSquarePlus size={16} />
            New chat
          </button>
        </div>
      ) : (
        <div className="p-2 space-y-1">
          {chats.map((chat) => (
            <div
              key={chat._id}
              className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                chat._id === activeChatId
                  ? 'bg-zinc-800 text-zinc-200'
                  : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-300'
              }`}
              onClick={() => onSelect(chat._id)}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{chat.title}</div>
                <div className="text-xs text-zinc-600 mt-0.5">
                  {formatTime(chat.updatedAt)}
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(chat._id)
                }}
                className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-zinc-600 hover:text-zinc-400 hover:bg-zinc-700/50 transition-all"
                title="Delete chat"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface AgentPanelProps {
  messages: Array<ChatMessage>
  isStreaming: boolean
  toolStatus: string | null
  agentModel: string
  onModelChange: (model: string) => void
  onSend: (content: string) => void
  onStop: () => void
  onClear: () => void
  onClose: () => void
  // Chat history
  chats: Array<Chat>
  activeChatId: Id<'chats'> | null
  onNewChat: () => void
  onSwitchChat: (chatId: Id<'chats'>) => void
  onDeleteChat: (chatId: Id<'chats'>) => void
}

export default function AgentPanel({
  messages,
  isStreaming,
  toolStatus,
  agentModel,
  onModelChange,
  onSend,
  onStop,
  onClear,
  onClose,
  chats,
  activeChatId,
  onNewChat,
  onSwitchChat,
  onDeleteChat,
}: AgentPanelProps) {
  const [input, setInput] = useState('')
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [showChatList, setShowChatList] = useState(false)
  const [researchMode, setResearchMode] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input on mount and when switching back to chat view
  useEffect(() => {
    if (!showChatList) {
      inputRef.current?.focus()
    }
  }, [showChatList])

  const handleSend = () => {
    if (!input.trim() || isStreaming) return
    setShowChatList(false)
    const message = researchMode
      ? `Do a deep research on: ${input.trim()}`
      : input.trim()
    onSend(message)
    setInput('')
    setResearchMode(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleNewChat = () => {
    onNewChat()
    setShowChatList(false)
  }

  const handleSelectChat = (chatId: Id<'chats'>) => {
    onSwitchChat(chatId)
    setShowChatList(false)
  }

  const currentModelName =
    AGENT_MODELS.find((m) => m.id === agentModel)?.name ?? 'Custom'

  return (
    <div className="absolute right-4 top-4 bottom-4 z-20 w-96 flex flex-col bg-zinc-900 rounded-2xl border border-zinc-800 shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
        <div className="flex items-center gap-2.5">
          {showChatList ? (
            <button
              onClick={() => setShowChatList(false)}
              className="p-1 -ml-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
          ) : (
            <Bot size={18} className="text-zinc-400" />
          )}
          <h2 className="text-base font-semibold text-zinc-200">
            {showChatList ? 'History' : 'Agent'}
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          {!showChatList && (
            <>
              <button
                onClick={handleNewChat}
                className="p-2 rounded-lg text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800 transition-colors"
                title="New chat"
              >
                <MessageSquarePlus size={16} />
              </button>
              <button
                onClick={() => setShowChatList(true)}
                className="relative p-2 rounded-lg text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800 transition-colors"
                title="Chat history"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                {chats.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-zinc-700 text-[10px] text-zinc-300 flex items-center justify-center">
                    {chats.length}
                  </span>
                )}
              </button>
              <button
                onClick={onClear}
                className="p-2 rounded-lg text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800 transition-colors"
                title="Clear chat"
              >
                <Trash2 size={16} />
              </button>
            </>
          )}
          {showChatList && (
            <button
              onClick={handleNewChat}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-800 rounded-lg border border-zinc-700/50 transition-colors"
            >
              <MessageSquarePlus size={14} />
              New
            </button>
          )}
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {showChatList ? (
        <ChatListView
          chats={chats}
          activeChatId={activeChatId}
          onSelect={handleSelectChat}
          onNew={handleNewChat}
          onDelete={onDeleteChat}
        />
      ) : (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <Bot size={36} className="text-zinc-700 mb-4" />
                <p className="text-sm text-zinc-500 leading-relaxed">
                  Ask me to build workflows on your canvas. I can add nodes,
                  pick models, wire connections, and set prompts.
                </p>
                <div className="flex flex-wrap gap-2 mt-5 justify-center">
                  {[
                    'Build an image generation pipeline',
                    'Add a video node with a sunset prompt',
                    'Create a text-to-speech workflow',
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => onSend(suggestion)}
                      className="px-3 py-2 text-xs text-zinc-500 bg-zinc-800/60 border border-zinc-700/40 rounded-xl hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      setResearchMode(true)
                      inputRef.current?.focus()
                    }}
                    className="px-3 py-2 text-xs text-blue-400/70 bg-blue-500/5 border border-blue-500/20 rounded-xl hover:bg-blue-500/10 hover:text-blue-300 transition-colors flex items-center gap-1.5"
                  >
                    <Globe size={12} />
                    Deep Research
                  </button>
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <MessageBubble
                key={i}
                message={msg}
                isAnimating={
                  isStreaming &&
                  msg.role === 'assistant' &&
                  i === messages.length - 1
                }
              />
            ))}
            {toolStatus && isStreaming && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-800/50 border border-zinc-700/30 text-xs text-zinc-500">
                <div className="w-2 h-2 rounded-full bg-blue-500/60 animate-pulse shrink-0" />
                <span className="truncate">{toolStatus}</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-4 pb-4 pt-2">
            {researchMode && (
              <div className="flex items-center gap-2 mb-2 px-1">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400">
                  <Globe size={12} />
                  Deep Research
                </div>
                <button
                  onClick={() => setResearchMode(false)}
                  className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
            <div className={`bg-zinc-800/60 border rounded-xl px-4 pt-3 pb-2 ${researchMode ? 'border-blue-500/30' : 'border-zinc-700/40'}`}>
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={researchMode ? 'Enter a topic to research in depth...' : 'Tell the agent what to build...'}
                  rows={1}
                  className="flex-1 bg-transparent text-sm text-zinc-200 placeholder:text-zinc-600 resize-none outline-none max-h-28 scrollbar-none"
                  style={{
                    height: 'auto',
                    minHeight: '24px',
                  }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement
                    target.style.height = 'auto'
                    target.style.height =
                      Math.min(target.scrollHeight, 112) + 'px'
                  }}
                />
                {isStreaming ? (
                  <button
                    onClick={onStop}
                    className="p-2 rounded-lg bg-zinc-700 text-zinc-300 hover:bg-zinc-600 transition-colors shrink-0"
                    title="Stop"
                  >
                    <Square size={16} />
                  </button>
                ) : (
                  <button
                    onClick={handleSend}
                    disabled={!input.trim()}
                    className="p-2 rounded-lg bg-zinc-700 text-zinc-300 hover:bg-zinc-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                    title="Send"
                  >
                    <Send size={16} />
                  </button>
                )}
              </div>
              <div className="relative mt-1.5 flex items-center gap-2">
                <button
                  onClick={() => setShowModelPicker(!showModelPicker)}
                  className="flex items-center gap-1.5 px-1 py-0.5 text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors rounded"
                >
                  <span>{currentModelName}</span>
                  <ChevronDown size={10} />
                </button>
                <button
                  onClick={() => setResearchMode(!researchMode)}
                  className={`flex items-center gap-1 px-1.5 py-0.5 text-[11px] rounded transition-colors ${
                    researchMode
                      ? 'text-blue-400 bg-blue-500/10'
                      : 'text-zinc-600 hover:text-zinc-400'
                  }`}
                  title="Toggle deep research mode"
                >
                  <Globe size={11} />
                  <span>Research</span>
                </button>
                {showModelPicker && (
                  <div className="absolute left-0 bottom-full mb-1 w-56 bg-zinc-800 border border-zinc-700 rounded-xl shadow-xl z-30 overflow-hidden">
                    {AGENT_MODELS.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => {
                          onModelChange(m.id)
                          setShowModelPicker(false)
                        }}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                          m.id === agentModel
                            ? 'bg-zinc-700/50 text-zinc-200'
                            : 'text-zinc-400 hover:bg-zinc-700/30 hover:text-zinc-200'
                        }`}
                      >
                        {m.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
