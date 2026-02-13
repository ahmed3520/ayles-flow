import { useEffect, useRef } from 'react'
import {
  Copy,
  Download,
  FileText,
  Image,
  Mic,
  Music,
  StickyNote,
  Ticket,
  Trash2,
  Type,
  Video,
} from 'lucide-react'
import type { Node } from '@xyflow/react'
import type { BlockNodeData, NodeContentType } from '@/types/nodes'
import { downloadNodeResult } from '@/utils/downloadUtils'

type ContextMenuProps = {
  x: number
  y: number
  targetNode: Node<BlockNodeData> | null
  onClose: () => void
  onDelete: () => void
  onDuplicate: () => void
  onAddNode: (contentType: NodeContentType, position: { x: number; y: number }) => void
  flowPosition: { x: number; y: number }
}

const nodeTypeItems: Array<{
  type: NodeContentType
  label: string
  icon: typeof Image
}> = [
  { type: 'image', label: 'Image', icon: Image },
  { type: 'text', label: 'Text', icon: Type },
  { type: 'video', label: 'Video', icon: Video },
  { type: 'audio', label: 'Audio', icon: Mic },
  { type: 'music', label: 'Music', icon: Music },
  { type: 'note', label: 'Note', icon: StickyNote },
  { type: 'ticket', label: 'Ticket', icon: Ticket },
  { type: 'pdf', label: 'PDF', icon: FileText },
]

function MenuItem({
  icon: Icon,
  label,
  onClick,
  destructive,
}: {
  icon: typeof Image
  label: string
  onClick: () => void
  destructive?: boolean
}) {
  return (
    <button
      className={`w-full flex items-center gap-2 px-3 py-1.5 text-[11px] rounded-md transition-colors ${
        destructive
          ? 'text-red-400 hover:bg-red-500/10'
          : 'text-zinc-300 hover:bg-zinc-800'
      }`}
      onClick={onClick}
    >
      <Icon size={13} />
      {label}
    </button>
  )
}

export default function ContextMenu({
  x,
  y,
  targetNode,
  onClose,
  onDelete,
  onDuplicate,
  onAddNode,
  flowPosition,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) {
        onClose()
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  // Adjust position to stay within viewport
  const style: React.CSSProperties = {
    top: y,
    left: x,
  }

  if (targetNode) {
    const data = targetNode.data as BlockNodeData
    const hasResult = data.generationStatus === 'completed' && data.resultUrl

    return (
      <div
        ref={menuRef}
        className="fixed z-50 min-w-[160px] bg-zinc-900 border border-zinc-800 rounded-lg shadow-[0_8px_30px_rgba(0,0,0,0.5)] p-1"
        style={style}
      >
        <MenuItem icon={Copy} label="Duplicate" onClick={() => { onDuplicate(); onClose() }} />
        {hasResult && (
          <MenuItem
            icon={Download}
            label="Download"
            onClick={() => {
              downloadNodeResult(data)
              onClose()
            }}
          />
        )}
        <div className="h-px bg-zinc-800 my-1" />
        <MenuItem icon={Trash2} label="Delete" destructive onClick={() => { onDelete(); onClose() }} />
      </div>
    )
  }

  // Pane context menu — add node types
  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[160px] bg-zinc-900 border border-zinc-800 rounded-lg shadow-[0_8px_30px_rgba(0,0,0,0.5)] p-1"
      style={style}
    >
      <div className="px-3 py-1 text-[10px] text-zinc-600 uppercase tracking-wide">
        Add node
      </div>
      {nodeTypeItems.map((item) => (
        <MenuItem
          key={item.type}
          icon={item.icon}
          label={item.label}
          onClick={() => {
            onAddNode(item.type, flowPosition)
            onClose()
          }}
        />
      ))}
    </div>
  )
}
