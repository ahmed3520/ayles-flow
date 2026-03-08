import { Copy, Lock, Send, StickyNote, Unlock } from 'lucide-react'
import { NOTE_COLORS, NOTE_COLOR_CONFIG } from './constants'
import ToolbarHint from './ToolbarHint'
import type { Dispatch, SetStateAction } from 'react'

import type { BlockNodeData } from '@/types/nodes'

import type { NoteTheme } from './constants'

type NoteToolbarControlsProps = {
  data: BlockNodeData
  duplicateNode: () => void
  hoveredHint: string | null
  noteTheme: NoteTheme
  sendNoteToAgent: () => void
  setHoveredHint: Dispatch<SetStateAction<string | null>>
  updateData: (updates: Partial<BlockNodeData>) => void
}

export default function NoteToolbarControls({
  data,
  duplicateNode,
  hoveredHint,
  noteTheme,
  sendNoteToAgent,
  setHoveredHint,
  updateData,
}: NoteToolbarControlsProps) {
  return (
    <>
      <StickyNote size={11} style={{ color: noteTheme.accent }} />
      <div className="flex items-center gap-1.5">
        {NOTE_COLORS.map((color) => {
          const isActive = (data.noteColor || 'yellow') === color

          return (
            <button
              key={color}
              type="button"
              className={`h-3.5 w-3.5 rounded-full transition-opacity ${
                isActive ? '' : 'opacity-50 hover:opacity-80'
              }`}
              style={{
                backgroundColor: NOTE_COLOR_CONFIG[color].dot,
                boxShadow: isActive
                  ? `0 0 0 2px ${NOTE_COLOR_CONFIG[color].toolbar}, 0 0 0 3.5px ${NOTE_COLOR_CONFIG[color].dot}`
                  : undefined,
              }}
              onClick={() => updateData({ noteColor: color })}
              title={color}
            />
          )
        })}
      </div>
      <div className="h-3.5 w-px bg-black/10" />
      <ToolbarHint label="Duplicate" show={hoveredHint === 'note-duplicate'}>
        <button
          type="button"
          title="Duplicate"
          className="flex h-6 w-6 items-center justify-center rounded-md transition-opacity hover:opacity-70"
          style={{ color: noteTheme.accent }}
          onMouseEnter={() => setHoveredHint('note-duplicate')}
          onMouseLeave={() => setHoveredHint(null)}
          onClick={duplicateNode}
        >
          <Copy size={13} />
        </button>
      </ToolbarHint>
      <ToolbarHint label="Send to agent" show={hoveredHint === 'note-extract'}>
        <button
          type="button"
          title="Send to agent"
          className="flex h-6 w-6 items-center justify-center rounded-md transition-opacity hover:opacity-70"
          style={{ color: noteTheme.accent }}
          onMouseEnter={() => setHoveredHint('note-extract')}
          onMouseLeave={() => setHoveredHint(null)}
          onClick={sendNoteToAgent}
        >
          <Send size={13} />
        </button>
      </ToolbarHint>
      <div className="h-3.5 w-px bg-black/10" />
      <ToolbarHint
        label={data.noteLocked ? 'Unlock' : 'Lock'}
        show={hoveredHint === 'note-lock'}
      >
        <button
          type="button"
          title={data.noteLocked ? 'Unlock' : 'Lock'}
          className="flex h-6 w-6 items-center justify-center rounded-md transition-opacity hover:opacity-70"
          style={{ color: noteTheme.accent }}
          onMouseEnter={() => setHoveredHint('note-lock')}
          onMouseLeave={() => setHoveredHint(null)}
          onClick={() => updateData({ noteLocked: !data.noteLocked })}
        >
          {data.noteLocked ? <Lock size={13} /> : <Unlock size={13} />}
        </button>
      </ToolbarHint>
    </>
  )
}
