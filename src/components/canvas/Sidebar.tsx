import {
  Image,
  Mic,
  Music,
  StickyNote,
  Ticket,
  Type,
  Upload,
  Video,
} from 'lucide-react'

import type { NodeContentType } from '@/types/nodes'
import type { UploadContentCategory } from '@/types/uploads'
import { useFileUpload } from '@/hooks/useFileUpload'

const nodeOptions: Array<{
  type: NodeContentType
  icon: typeof Image
  label: string
}> = [
  { type: 'image', icon: Image, label: 'Image' },
  { type: 'text', icon: Type, label: 'Text' },
  { type: 'video', icon: Video, label: 'Video' },
  { type: 'audio', icon: Mic, label: 'Audio' },
  { type: 'music', icon: Music, label: 'Music' },
  { type: 'note', icon: StickyNote, label: 'Note' },
  { type: 'ticket', icon: Ticket, label: 'Ticket' },
]

interface SidebarProps {
  onAddNode: (type: NodeContentType) => void
  onAddUploadNode?: (
    contentType: NodeContentType,
    uploadId: string,
    url: string,
  ) => void
}

export default function Sidebar({ onAddNode, onAddUploadNode }: SidebarProps) {
  const { uploadFile, uploadState } = useFileUpload()

  const onDragStart = (event: React.DragEvent, nodeType: NodeContentType) => {
    event.dataTransfer.setData('application/reactflow', nodeType)
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div className="flex flex-col gap-3 bg-zinc-900 rounded-[18px] border border-zinc-800 shadow-[0_4px_16px_rgba(0,0,0,0.4)] p-2">
      {/* AI Generation Nodes */}
      <div className="flex flex-col gap-1.5">
        {nodeOptions.map(({ type, icon: Icon, label }) => (
          <button
            key={type}
            className="flex flex-col items-center justify-center gap-1 w-[52px] h-[52px] rounded-[14px] hover:bg-zinc-800 transition-colors cursor-grab active:cursor-grabbing"
            onClick={() => onAddNode(type)}
            onDragStart={(e) => onDragStart(e, type)}
            draggable
            title={label}
          >
            <Icon size={20} className="text-zinc-400" />
            <span className="text-[9px] text-zinc-500 font-medium">{label}</span>
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="h-px bg-zinc-800" />

      {/* Upload Section */}
      <div className="flex flex-col gap-1.5">
        <button
          className="flex flex-col items-center justify-center gap-1 w-[52px] h-[52px] rounded-[14px] hover:bg-zinc-800 transition-colors disabled:opacity-50"
          onClick={() => {
            const input = document.createElement('input')
            input.type = 'file'
            input.accept = 'image/*,audio/*,video/*,application/pdf'

            input.onchange = async (e) => {
              const file = (e.target as HTMLInputElement).files?.[0]
              if (!file || !onAddUploadNode) return

              try {
                // Detect category from MIME type
                let category: UploadContentCategory
                if (file.type.startsWith('image/')) category = 'image'
                else if (file.type.startsWith('audio/')) category = 'audio'
                else if (file.type.startsWith('video/')) category = 'video'
                else if (file.type === 'application/pdf') category = 'pdf'
                else {
                  console.error('Unsupported file type:', file.type)
                  return
                }

                const result = await uploadFile(file, category)

                const contentType: NodeContentType = category === 'pdf' ? 'pdf' : category
                onAddUploadNode(contentType, result.uploadId, result.url)
              } catch (error) {
                console.error('Upload failed:', error)
              }
            }

            input.click()
          }}
          disabled={uploadState.status === 'uploading' || uploadState.status === 'processing'}
          title="Upload media"
        >
          {uploadState.status === 'uploading' || uploadState.status === 'processing' ? (
            <Upload size={20} className="text-blue-400 animate-pulse" />
          ) : (
            <Upload size={20} className="text-zinc-400" />
          )}
          <span className="text-[9px] text-zinc-500 font-medium">Upload</span>
        </button>
      </div>
    </div>
  )
}
