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
import type { UploadContentCategory, UploadMetadata } from '@/types/uploads'
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
    metadata?: UploadMetadata,
  ) => void
}

export default function Sidebar({ onAddNode, onAddUploadNode }: SidebarProps) {
  const { uploadFile, uploadState } = useFileUpload()

  const onDragStart = (event: React.DragEvent, nodeType: NodeContentType) => {
    event.dataTransfer.setData('application/reactflow', nodeType)
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div className="pointer-events-auto w-full overflow-x-auto scrollbar-none rounded-[20px] border border-zinc-800 bg-zinc-900/95 p-2 shadow-[0_4px_16px_rgba(0,0,0,0.4)] backdrop-blur md:w-auto md:overflow-visible">
      <div className="mx-auto flex min-w-max items-center gap-2 md:mx-0 md:flex-col md:gap-3">
        {/* AI Generation Nodes */}
        <div className="flex items-center gap-1.5 md:flex-col">
          {nodeOptions.map(({ type, icon: Icon, label }) => (
            <button
              key={type}
              className="flex h-12 w-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-[14px] transition-colors hover:bg-zinc-800 cursor-grab active:cursor-grabbing md:h-[52px] md:w-[52px] md:gap-1"
              onClick={() => onAddNode(type)}
              onDragStart={(e) => onDragStart(e, type)}
              draggable
              title={label}
            >
              <Icon size={20} className="text-zinc-400" />
              <span className="text-[8px] font-medium text-zinc-500 md:text-[9px]">
                {label}
              </span>
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="h-10 w-px shrink-0 bg-zinc-800 md:h-px md:w-full" />

        {/* Upload Section */}
        <div className="flex items-center gap-1.5 md:flex-col">
          <button
            className="flex h-12 w-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-[14px] transition-colors hover:bg-zinc-800 disabled:opacity-50 md:h-[52px] md:w-[52px] md:gap-1"
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

                  const contentType: NodeContentType =
                    category === 'pdf' ? 'pdf' : category
                  onAddUploadNode(
                    contentType,
                    result.uploadId,
                    result.url,
                    result.metadata,
                  )
                } catch (error) {
                  console.error('Upload failed:', error)
                }
              }

              input.click()
            }}
            disabled={
              uploadState.status === 'uploading' ||
              uploadState.status === 'processing'
            }
            title="Upload media"
          >
            {uploadState.status === 'uploading' ||
            uploadState.status === 'processing' ? (
              <Upload size={20} className="animate-pulse text-blue-400" />
            ) : (
              <Upload size={20} className="text-zinc-400" />
            )}
            <span className="text-[8px] font-medium text-zinc-500 md:text-[9px]">
              Upload
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
