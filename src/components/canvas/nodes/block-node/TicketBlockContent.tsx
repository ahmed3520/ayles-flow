import TiptapEditor from '../TiptapEditor'

import {
  TICKET_PRIORITIES,
  TICKET_PRIORITY_CONFIG,
  TICKET_STATUSES,
  TICKET_STATUS_CONFIG,
  TICKET_TAGS,
} from './constants'
import type { BlockNodeData } from '@/types/nodes'


type TicketBlockContentProps = {
  data: BlockNodeData
  placeholder: string
  updateData: (updates: Partial<BlockNodeData>) => void
}

export default function TicketBlockContent({
  data,
  placeholder,
  updateData,
}: TicketBlockContentProps) {
  return (
    <div className="flex flex-1 min-h-0 flex-col px-3 py-2.5">
      <div className="flex-1 min-h-0 text-sm leading-relaxed text-zinc-300 [&_.tiptap_blockquote]:border-l-2 [&_.tiptap_blockquote]:border-violet-500 [&_.tiptap_blockquote]:pl-3 [&_.tiptap_blockquote]:italic [&_.tiptap_blockquote]:text-zinc-400 [&_.tiptap_code]:rounded [&_.tiptap_code]:bg-zinc-800 [&_.tiptap_code]:px-1 [&_.tiptap_code]:text-xs [&_.tiptap_h1]:text-base [&_.tiptap_h1]:font-bold [&_.tiptap_h2]:text-sm [&_.tiptap_h2]:font-semibold [&_.tiptap_h3]:text-sm [&_.tiptap_h3]:font-semibold [&_.tiptap_li]:text-sm [&_.tiptap_ol]:text-sm [&_.tiptap_p]:text-sm [&_.tiptap_p]:leading-relaxed [&_.tiptap_p.is-editor-empty:first-child::before]:pointer-events-none [&_.tiptap_p.is-editor-empty:first-child::before]:float-left [&_.tiptap_p.is-editor-empty:first-child::before]:h-0 [&_.tiptap_p.is-editor-empty:first-child::before]:text-zinc-600 [&_.tiptap_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.tiptap_pre]:rounded [&_.tiptap_pre]:bg-zinc-800 [&_.tiptap_pre]:p-2 [&_.tiptap_ul]:text-sm">
        <TiptapEditor
          content={data.prompt}
          onChange={(html) => updateData({ prompt: html })}
          placeholder={placeholder}
        />
      </div>
      <div className="nodrag mt-1 flex shrink-0 items-center gap-1.5 border-t border-zinc-800/50 pt-2">
        <button
          type="button"
          className={`cursor-pointer rounded px-1.5 py-0.5 text-[9px] font-medium transition-opacity hover:opacity-80 ${
            TICKET_STATUS_CONFIG[data.ticketStatus || 'todo'].bg
          } ${TICKET_STATUS_CONFIG[data.ticketStatus || 'todo'].text}`}
          onClick={() => {
            const current = data.ticketStatus || 'todo'
            const idx = TICKET_STATUSES.indexOf(current)
            const next = TICKET_STATUSES[(idx + 1) % TICKET_STATUSES.length]
            updateData({ ticketStatus: next })
          }}
        >
          {TICKET_STATUS_CONFIG[data.ticketStatus || 'todo'].label}
        </button>
        <button
          type="button"
          className={`cursor-pointer rounded px-1.5 py-0.5 text-[9px] font-medium transition-opacity hover:opacity-80 ${
            TICKET_PRIORITY_CONFIG[data.ticketPriority || 'normal'].bg
          } ${TICKET_PRIORITY_CONFIG[data.ticketPriority || 'normal'].text}`}
          onClick={() => {
            const current = data.ticketPriority || 'normal'
            const idx = TICKET_PRIORITIES.indexOf(current)
            const next = TICKET_PRIORITIES[(idx + 1) % TICKET_PRIORITIES.length]
            updateData({ ticketPriority: next })
          }}
        >
          {TICKET_PRIORITY_CONFIG[data.ticketPriority || 'normal'].label}
        </button>
        <select
          title="Tag"
          className="cursor-pointer bg-transparent text-[9px] text-zinc-400 outline-none hover:text-zinc-300 [&>option]:bg-zinc-900 [&>option]:text-zinc-300"
          value={data.ticketTag || ''}
          onChange={(event) => updateData({ ticketTag: event.target.value })}
        >
          {TICKET_TAGS.map((tag) => (
            <option key={tag.value} value={tag.value}>
              {tag.label}
            </option>
          ))}
        </select>
        {data.ticketTag && (
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              TICKET_TAGS.find((tag) => tag.value === data.ticketTag)?.color ||
              'bg-zinc-600'
            }`}
          />
        )}
      </div>
    </div>
  )
}
