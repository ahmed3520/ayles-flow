import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  BookOpen,
  Bot,
  Check,
  ChevronDown,
  ClipboardCopy,
  FileText,
  Globe,
  Layers,
  Loader2,
  MessageSquarePlus,
  Search,
  Send,
  Square,
  Terminal,
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

// --- Tool icon / verb helpers ---

type LucideIcon = typeof FileText

const TOOL_ICON_MAP: Partial<Record<string, LucideIcon>> = {
  // File ops
  read: FileText,
  write: FileText,
  edit: FileText,
  multi_edit: FileText,
  delete: FileText,
  mkdir: FileText,
  move: FileText,
  create_project_spec: FileText,
  create_pdf: FileText,
  // Shell
  shell: Terminal,
  create_sandbox: Terminal,
  run_coding_agent: Terminal,
  // Search
  grep: Search,
  glob: Search,
  ls: Search,
  web_search: Search,
  // Canvas
  add_node: Layers,
  connect_nodes: Layers,
  update_node: Layers,
  delete_nodes: Layers,
  clear_canvas: Layers,
  get_canvas_state: Layers,
  get_available_models: Layers,
  // Research
  deep_research: BookOpen,
  // Skill
  load_skill: FileText,
  workspace_info: Search,
  lint: FileText,
  get_preview_url: Globe,
}

function getToolIcon(tool: string): LucideIcon {
  return TOOL_ICON_MAP[tool] ?? Terminal
}

function stripSandboxPath(s: unknown): string {
  return String(s || '').replace(/\/home\/user\/app\/?/g, '')
}

function truncCmd(s: unknown): string {
  return String(s || '').slice(0, 50)
}

type ToolLabel = {
  pending: (a: Record<string, unknown>) => string
  done: (a: Record<string, unknown>) => string
}

const TOOL_DISPLAY: Partial<Record<string, ToolLabel>> = {
  // File ops
  read: {
    pending: (a) => `Reading ${stripSandboxPath(a.path)}`,
    done: (a) => `Read ${stripSandboxPath(a.path)}`,
  },
  write: {
    pending: (a) => `Writing ${stripSandboxPath(a.path)}`,
    done: (a) => `Wrote ${stripSandboxPath(a.path)}`,
  },
  edit: {
    pending: (a) => `Editing ${stripSandboxPath(a.path)}`,
    done: (a) => `Edited ${stripSandboxPath(a.path)}`,
  },
  multi_edit: {
    pending: (a) => `Editing ${stripSandboxPath(a.path)}`,
    done: (a) => `Edited ${stripSandboxPath(a.path)}`,
  },
  delete: {
    pending: (a) => `Deleting ${stripSandboxPath(a.path)}`,
    done: (a) => `Deleted ${stripSandboxPath(a.path)}`,
  },
  mkdir: {
    pending: (a) => `Creating ${stripSandboxPath(a.path)}`,
    done: (a) => `Created ${stripSandboxPath(a.path)}`,
  },
  move: {
    pending: (a) =>
      `Moving ${stripSandboxPath(a.from_path)} → ${stripSandboxPath(a.to_path)}`,
    done: (a) =>
      `Moved ${stripSandboxPath(a.from_path)} → ${stripSandboxPath(a.to_path)}`,
  },
  // Shell (unified — action param for output/stop/list)
  shell: {
    pending: (a) =>
      a.action === 'output'
        ? `Reading output ${a.process_id}`
        : a.action === 'stop'
          ? `Stopping ${a.process_id}`
          : a.action === 'list'
            ? 'Listing processes'
            : `Running ${truncCmd(a.command)}`,
    done: (a) =>
      a.action === 'output'
        ? `Output ${a.process_id}`
        : a.action === 'stop'
          ? `Stopped ${a.process_id}`
          : a.action === 'list'
            ? 'Listed processes'
            : `Ran ${truncCmd(a.command)}`,
  },
  // Search
  grep: {
    pending: (a) => `Searching ${a.pattern}`,
    done: (a) => `Searched ${a.pattern}`,
  },
  glob: {
    pending: (a) => `Finding ${a.pattern}`,
    done: (a) => `Found ${a.pattern}`,
  },
  ls: {
    pending: (a) => `Listing ${stripSandboxPath(a.path || '.')}`,
    done: (a) => `Listed ${stripSandboxPath(a.path || '.')}`,
  },
  web_search: {
    pending: (a) => `Searching ${a.query}`,
    done: (a) => `Searched ${a.query}`,
  },
  // Canvas
  add_node: {
    pending: () => 'Adding node',
    done: (a) => `Added ${a.contentType || 'node'}`,
  },
  update_node: {
    pending: () => 'Updating node',
    done: (a) => `Updated ${a.nodeId}`,
  },
  delete_nodes: {
    pending: () => 'Deleting nodes',
    done: (a) =>
      `Deleted ${Array.isArray(a.nodeIds) ? a.nodeIds.length : 0} node(s)`,
  },
  clear_canvas: {
    pending: () => 'Clearing canvas',
    done: () => 'Cleared canvas',
  },
  connect_nodes: {
    pending: () => 'Connecting nodes',
    done: (a) => `Connected ${a.sourceNodeId} → ${a.targetNodeId}`,
  },
  get_canvas_state: {
    pending: () => 'Inspecting canvas',
    done: () => 'Inspected canvas',
  },
  get_available_models: {
    pending: () => 'Loading models',
    done: () => 'Loaded models',
  },
  // Research / long ops
  deep_research: {
    pending: (a) => `Researching ${a.topic}`,
    done: (a) => `Researched ${a.topic}`,
  },
  create_pdf: {
    pending: (a) => `Creating PDF ${a.title}`,
    done: (a) => `Created PDF ${a.title}`,
  },
  create_sandbox: {
    pending: () => 'Creating sandbox...',
    done: (a) => `Created sandbox ${a.templateName}`,
  },
  create_project_spec: {
    pending: () => 'Creating project spec...',
    done: () => 'Created project.md',
  },
  run_coding_agent: {
    pending: () => 'Running coding agent...',
    done: () => 'Built project',
  },
  // Sub-agent tools
  lint: {
    pending: (a) => `Linting ${stripSandboxPath(a.path)}`,
    done: (a) => `Linted ${stripSandboxPath(a.path)}`,
  },
  workspace_info: {
    pending: () => 'Inspecting workspace',
    done: () => 'Inspected workspace',
  },
  load_skill: {
    pending: (a) => `Loading skill ${a.name}`,
    done: (a) => `Loaded skill ${a.name}`,
  },
  get_preview_url: {
    pending: (a) => `Getting preview port ${a.port}`,
    done: (a) => `Preview port ${a.port}`,
  },
}

function formatToolLabel(
  tool: string,
  args: Record<string, unknown>,
  status: 'pending' | 'done',
): { verb: string; detail: string } {
  const display = TOOL_DISPLAY[tool]
  if (!display) return { verb: tool, detail: '' }
  let label: string
  try {
    label = status === 'pending' ? display.pending(args) : display.done(args)
  } catch {
    return { verb: tool, detail: '' }
  }
  const match = label.match(/^(\S+)\s+(.*)$/)
  if (match) return { verb: match[1], detail: match[2] }
  return { verb: label, detail: '' }
}

// --- Copy button ---

function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Fallback
    }
  }

  return (
    <button
      onClick={handleCopy}
      className={`p-1 rounded text-zinc-600 hover:text-zinc-400 transition-colors ${className || ''}`}
      title={copied ? 'Copied!' : 'Copy'}
    >
      {copied ? (
        <Check size={12} className="text-emerald-500" />
      ) : (
        <ClipboardCopy size={12} />
      )}
    </button>
  )
}

// --- Tool call line (replaces ToolCallBadge) ---

function ToolCallLine({
  tool,
  args,
  status,
  error,
  label: legacyLabel,
}: {
  tool: string
  args?: Record<string, unknown>
  status?: 'pending' | 'done'
  error?: boolean
  label?: string
}) {
  const Icon = getToolIcon(tool)
  const s = status || 'done'
  // Old messages stored in Convex have `label` string, new ones have `args` object
  const { verb, detail } =
    args && Object.keys(args).length > 0
      ? formatToolLabel(tool, args, s)
      : legacyLabel
        ? (() => {
            const m = legacyLabel.match(/^(\S+):?\s+(.*)$/)
            return m
              ? { verb: m[1].replace(/:$/, ''), detail: stripSandboxPath(m[2]) }
              : { verb: legacyLabel, detail: '' }
          })()
        : { verb: tool, detail: '' }

  return (
    <div className="flex items-center gap-1.5 py-0.5 text-xs group/tc">
      {s === 'pending' ? (
        <Loader2 size={13} className="text-blue-400/60 animate-spin shrink-0" />
      ) : error ? (
        <X size={13} className="text-red-400 shrink-0" />
      ) : (
        <Check size={13} className="text-zinc-500 shrink-0" />
      )}
      <span
        className={`font-medium shrink-0 ${error ? 'text-red-400' : 'text-zinc-300'}`}
      >
        {verb}
      </span>
      <Icon size={12} className="text-zinc-500 shrink-0" />
      {detail && (
        <span className="text-zinc-400 font-mono truncate">{detail}</span>
      )}
      {s !== 'pending' && detail && (
        <CopyButton
          text={detail}
          className="opacity-0 group-hover/tc:opacity-100 ml-auto"
        />
      )}
    </div>
  )
}

// --- Action line (replaces ActionBadge) ---

function ActionLine({ action }: { action: AgentAction }) {
  const labels: Record<AgentAction['type'], (a: AgentAction) => string> = {
    add_node: (a) => `Added ${(a as { contentType: string }).contentType} node`,
    connect_nodes: (a) => {
      const c = a as { sourceNodeId: string; targetNodeId: string }
      return `Connected ${c.sourceNodeId} → ${c.targetNodeId}`
    },
    update_node: (a) => `Updated ${(a as { nodeId: string }).nodeId}`,
    delete_nodes: (a) =>
      `Deleted ${(a as { nodeIds: Array<string> }).nodeIds.length} node(s)`,
    clear_canvas: () => 'Cleared canvas',
    create_pdf: (a) => `Created PDF ${(a as CreatePdfAction).title}`,
  }

  const label = labels[action.type](action)
  const match = label.match(/^(\S+)\s+(.*)$/)
  const verb = match ? match[1] : label
  const detail = match ? match[2] : ''

  return (
    <div className="flex items-center gap-1.5 py-0.5 text-xs group/ac">
      <Check size={13} className="text-emerald-500/70 shrink-0" />
      <span className="text-zinc-300 font-medium shrink-0">{verb}</span>
      <Layers size={12} className="text-zinc-500 shrink-0" />
      {detail && (
        <span className="text-zinc-400 font-mono truncate">{detail}</span>
      )}
    </div>
  )
}

// --- Reasoning block (collapsible) ---

function ReasoningBlock({ content }: { content: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-lg border border-zinc-700/40 bg-zinc-800/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-xs text-zinc-500 hover:text-zinc-400 transition-colors"
      >
        <ChevronDown
          size={12}
          className={`shrink-0 transition-transform ${open ? '' : '-rotate-90'}`}
        />
        <span className="font-medium">Thinking</span>
        <span className="text-zinc-600 ml-auto">
          {content.length.toLocaleString()} chars
        </span>
      </button>
      {open && (
        <div className="px-2.5 pb-2 text-xs text-zinc-500 leading-relaxed whitespace-pre-wrap break-words max-h-48 overflow-y-auto border-t border-zinc-700/30">
          {content}
        </div>
      )}
    </div>
  )
}

// --- Resource cards ---

function ResourceCards({
  sources,
}: {
  sources: Array<{ title: string; url: string }>
}) {
  return (
    <div className="flex flex-col gap-1">
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
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-800/80 border border-zinc-700/40 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors max-w-full"
            title={source.url}
          >
            <Globe size={10} className="shrink-0 text-zinc-600" />
            <span className="truncate">{source.title}</span>
          </a>
        ))}
      </div>
    </div>
  )
}

// --- Message parts renderer ---

function MessageParts({
  parts,
  isAnimating,
}: {
  parts: Array<MessagePart>
  isAnimating: boolean
}) {
  // Group consecutive tool_call + action parts into compact blocks
  const groups: Array<
    { type: 'tools'; items: Array<MessagePart> } | MessagePart
  > = []
  for (const part of parts) {
    if (part.type === 'tool_call' || part.type === 'action') {
      const last = groups.at(-1)
      if (last && 'type' in last && last.type === 'tools') {
        last.items.push(part)
      } else {
        groups.push({ type: 'tools', items: [part] })
      }
    } else {
      groups.push(part)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      {groups.map((group, i) => {
        if ('type' in group && group.type === 'tools') {
          return (
            <div key={i} className="flex flex-col">
              {group.items.map((item, j) => {
                if (item.type === 'tool_call') {
                  return (
                    <ToolCallLine
                      key={j}
                      tool={item.tool}
                      args={item.args}
                      status={item.status || 'done'}
                      error={item.error}
                      label={(item as any).label}
                    />
                  )
                }
                if (item.type === 'action') {
                  return <ActionLine key={j} action={item.action} />
                }
                return null
              })}
            </div>
          )
        }

        const part = group
        switch (part.type) {
          case 'text':
            return part.content ? (
              <Streamdown
                key={i}
                className="agent-markdown"
                mode={
                  isAnimating && i === groups.length - 1
                    ? 'streaming'
                    : 'static'
                }
                plugins={streamdownPlugins}
              >
                {part.content}
              </Streamdown>
            ) : null
          case 'reasoning':
            return <ReasoningBlock key={i} content={part.content} />
          case 'resources':
            return <ResourceCards key={i} sources={part.sources} />
          default:
            return null
        }
      })}
    </div>
  )
}

// --- Message bubble ---

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
        className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'bg-zinc-800 text-zinc-200 border border-zinc-700/50'
            : 'text-zinc-300'
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
            className="agent-markdown"
            mode={isAnimating ? 'streaming' : 'static'}
            plugins={streamdownPlugins}
          >
            {message.content}
          </Streamdown>
        ) : (
          <span className="text-zinc-600 italic text-xs">Thinking...</span>
        )}
        {/* Fallback: show actions at bottom for old messages without parts */}
        {!hasParts && message.actions && message.actions.length > 0 && (
          <div className="flex flex-col mt-2">
            {message.actions.map((action, i) => (
              <ActionLine key={i} action={action} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// --- Chat list ---

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
          <Bot size={32} className="text-zinc-700 mb-3" />
          <p className="text-xs text-zinc-500 leading-relaxed">
            No conversations yet. Start a new chat to begin.
          </p>
          <button
            onClick={onNew}
            className="mt-3 flex items-center gap-2 px-3 py-2 text-xs text-zinc-300 bg-zinc-800 border border-zinc-700/50 rounded-xl hover:bg-zinc-700 transition-colors"
          >
            <MessageSquarePlus size={14} />
            New chat
          </button>
        </div>
      ) : (
        <div className="p-2 space-y-0.5">
          {chats.map((chat) => (
            <div
              key={chat._id}
              className={`group flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-colors ${
                chat._id === activeChatId
                  ? 'bg-zinc-800 text-zinc-200'
                  : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-300'
              }`}
              onClick={() => onSelect(chat._id)}
            >
              <div className="flex-1 min-w-0">
                <div className="text-xs truncate">{chat.title}</div>
                <div className="text-[10px] text-zinc-600 mt-0.5">
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
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// --- Main panel ---

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
    if (
      !showChatList &&
      typeof window !== 'undefined' &&
      window.matchMedia('(min-width: 768px) and (pointer: fine)').matches
    ) {
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
    <div className="absolute left-1/2 top-16 bottom-20 z-20 flex w-[calc(100vw-1.5rem)] max-w-[28rem] -translate-x-1/2 flex-col rounded-[1.75rem] border border-zinc-800 bg-zinc-900 shadow-[0_4px_24px_rgba(0,0,0,0.5)] md:left-auto md:right-4 md:top-4 md:bottom-4 md:w-96 md:max-w-none md:translate-x-0 md:rounded-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          {showChatList ? (
            <button
              onClick={() => setShowChatList(false)}
              className="p-1 -ml-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              <ArrowLeft size={16} />
            </button>
          ) : (
            <Bot size={16} className="text-zinc-400" />
          )}
          <h2 className="text-sm font-semibold text-zinc-200">
            {showChatList ? 'History' : 'Agent'}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          {!showChatList && (
            <>
              <button
                onClick={handleNewChat}
                className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800 transition-colors"
                title="New chat"
              >
                <MessageSquarePlus size={14} />
              </button>
              <button
                onClick={() => setShowChatList(true)}
                className="relative p-1.5 rounded-lg text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800 transition-colors"
                title="Chat history"
              >
                <svg
                  width="14"
                  height="14"
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
                  <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-zinc-700 text-[9px] text-zinc-300 flex items-center justify-center">
                    {chats.length}
                  </span>
                )}
              </button>
              <button
                onClick={onClear}
                className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800 transition-colors"
                title="Clear chat"
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
          {showChatList && (
            <button
              onClick={handleNewChat}
              className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] text-zinc-400 hover:text-zinc-200 bg-zinc-800 rounded-lg border border-zinc-700/50 transition-colors"
            >
              <MessageSquarePlus size={12} />
              New
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800 transition-colors"
          >
            <X size={14} />
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
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center px-5">
                <Bot size={32} className="text-zinc-700 mb-3" />
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Ask me to build workflows on your canvas. I can add nodes,
                  pick models, wire connections, and set prompts.
                </p>
                <div className="flex flex-wrap gap-1.5 mt-4 justify-center">
                  {[
                    'Build an image generation pipeline',
                    'Add a video node with a sunset prompt',
                    'Create a text-to-speech workflow',
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => onSend(suggestion)}
                      className="px-2.5 py-1.5 text-[11px] text-zinc-500 bg-zinc-800/60 border border-zinc-700/40 rounded-lg hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      setResearchMode(true)
                      inputRef.current?.focus()
                    }}
                    className="px-2.5 py-1.5 text-[11px] text-blue-400/70 bg-blue-500/5 border border-blue-500/20 rounded-lg hover:bg-blue-500/10 hover:text-blue-300 transition-colors flex items-center gap-1"
                  >
                    <Globe size={10} />
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
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-3 pb-3 pt-1.5">
            {researchMode && (
              <div className="flex items-center gap-2 mb-1.5 px-1">
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-400">
                  <Globe size={10} />
                  Deep Research
                </div>
                <button
                  onClick={() => setResearchMode(false)}
                  className="text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
            <div
              className={`bg-zinc-800/60 border rounded-xl px-3 pt-2.5 pb-1.5 ${researchMode ? 'border-blue-500/30' : 'border-zinc-700/40'}`}
            >
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    researchMode
                      ? 'Enter a topic to research in depth...'
                      : 'Tell the agent what to build...'
                  }
                  rows={1}
                  className="flex-1 bg-transparent text-[16px] text-zinc-200 placeholder:text-zinc-600 resize-none outline-none max-h-24 scrollbar-none md:text-sm"
                  style={{
                    height: 'auto',
                    minHeight: '20px',
                  }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement
                    target.style.height = 'auto'
                    target.style.height =
                      Math.min(target.scrollHeight, 96) + 'px'
                  }}
                />
                {isStreaming ? (
                  <button
                    onClick={onStop}
                    className="p-1.5 rounded-lg bg-zinc-700 text-zinc-300 hover:bg-zinc-600 transition-colors shrink-0"
                    title="Stop"
                  >
                    <Square size={14} />
                  </button>
                ) : (
                  <button
                    onClick={handleSend}
                    disabled={!input.trim()}
                    className="p-1.5 rounded-lg bg-zinc-700 text-zinc-300 hover:bg-zinc-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                    title="Send"
                  >
                    <Send size={14} />
                  </button>
                )}
              </div>
              <div className="relative mt-1 flex items-center gap-2">
                <button
                  onClick={() => setShowModelPicker(!showModelPicker)}
                  className="flex items-center gap-1 px-1 py-0.5 text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors rounded"
                >
                  <span>{currentModelName}</span>
                  <ChevronDown size={9} />
                </button>
                <button
                  onClick={() => setResearchMode(!researchMode)}
                  className={`flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded transition-colors ${
                    researchMode
                      ? 'text-blue-400 bg-blue-500/10'
                      : 'text-zinc-600 hover:text-zinc-400'
                  }`}
                  title="Toggle deep research mode"
                >
                  <Globe size={10} />
                  <span>Research</span>
                </button>
                {showModelPicker && (
                  <div className="absolute left-0 bottom-full mb-1 w-52 bg-zinc-800 border border-zinc-700 rounded-xl shadow-xl z-30 overflow-hidden">
                    {AGENT_MODELS.map((m) => (
                      <button
                        key={m.id}
                        disabled={m.comingSoon}
                        onClick={() => {
                          if (m.comingSoon) return
                          onModelChange(m.id)
                          setShowModelPicker(false)
                        }}
                        className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center justify-between ${
                          m.comingSoon
                            ? 'text-zinc-600 cursor-not-allowed'
                            : m.id === agentModel
                              ? 'bg-zinc-700/50 text-zinc-200'
                              : 'text-zinc-400 hover:bg-zinc-700/30 hover:text-zinc-200'
                        }`}
                      >
                        {m.name}
                        {m.comingSoon && (
                          <span className="text-[9px] text-zinc-600 font-medium">
                            Coming soon
                          </span>
                        )}
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
