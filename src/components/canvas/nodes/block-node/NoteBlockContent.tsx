import { Lock } from 'lucide-react'

import TiptapEditor from '../TiptapEditor'

import type { BlockNodeData } from '@/types/nodes'

import type { NoteTheme } from './constants'

type NoteBlockContentProps = {
  data: BlockNodeData
  noteTheme: NoteTheme
  placeholder: string
  updateData: (updates: Partial<BlockNodeData>) => void
}

export default function NoteBlockContent({
  data,
  noteTheme,
  placeholder,
  updateData,
}: NoteBlockContentProps) {
  return (
    <div
      className="relative flex-1 min-h-0"
      style={{
        backgroundImage: `repeating-linear-gradient(transparent, transparent 31px, ${noteTheme.lines} 31px, ${noteTheme.lines} 32px)`,
      }}
    >
      <div
        className={`font-note h-full px-5 py-3 text-[18px] leading-[32px] [&_.tiptap_blockquote]:border-l-2 [&_.tiptap_blockquote]:border-current/30 [&_.tiptap_blockquote]:pl-3 [&_.tiptap_blockquote]:italic [&_.tiptap_code]:rounded [&_.tiptap_code]:bg-black/5 [&_.tiptap_code]:px-1 [&_.tiptap_code]:text-sm [&_.tiptap_h1]:text-xl [&_.tiptap_h1]:font-bold [&_.tiptap_h2]:text-lg [&_.tiptap_h2]:font-semibold [&_.tiptap_h3]:text-base [&_.tiptap_h3]:font-semibold [&_.tiptap_p]:leading-[32px] [&_.tiptap_p.is-editor-empty:first-child::before]:pointer-events-none [&_.tiptap_p.is-editor-empty:first-child::before]:float-left [&_.tiptap_p.is-editor-empty:first-child::before]:h-0 [&_.tiptap_p.is-editor-empty:first-child::before]:opacity-40 [&_.tiptap_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.tiptap_pre]:rounded [&_.tiptap_pre]:bg-black/5 [&_.tiptap_pre]:p-2 ${
          data.noteLocked ? 'pointer-events-none opacity-90' : ''
        }`}
        style={{ color: noteTheme.text }}
      >
        <TiptapEditor
          content={data.prompt}
          onChange={(html) => updateData({ prompt: html })}
          placeholder={placeholder}
        />
      </div>
      {data.noteLocked && (
        <div className="pointer-events-none absolute top-2 right-2">
          <Lock size={12} style={{ color: noteTheme.accent, opacity: 0.4 }} />
        </div>
      )}
      <div
        className="pointer-events-none absolute right-0 bottom-0 h-5 w-5"
        style={{
          background: `linear-gradient(225deg, rgba(245,235,200,0) 50%, ${noteTheme.fold} 50%)`,
        }}
      />
    </div>
  )
}
