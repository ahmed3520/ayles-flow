import { ArrowUp } from 'lucide-react'

import type { BlockNodeData } from '@/types/nodes'

type AIPromptBarProps = {
  connectedImageUrl: string | null
  data: BlockNodeData
  id: string
  isGenerating: boolean
  onGenerate: (id: string) => void
  updateData: (updates: Partial<BlockNodeData>) => void
}

export default function AIPromptBar({
  connectedImageUrl,
  data,
  id,
  isGenerating,
  onGenerate,
  updateData,
}: AIPromptBarProps) {
  return (
    <div className="mt-auto shrink-0 px-2.5 pt-1 pb-2.5">
      {connectedImageUrl && (
        <div className="mb-1.5 flex items-center gap-1.5 px-1">
          <img
            src={connectedImageUrl}
            alt="Connected input"
            className="h-8 w-8 shrink-0 rounded-md object-cover ring-1 ring-zinc-700/50"
          />
          <span className="truncate text-[10px] text-zinc-600">
            Input image
          </span>
        </div>
      )}
      <div className="flex items-center gap-1.5 rounded-lg bg-zinc-800/40 px-2.5 py-1.5">
        <input
          className={`nodrag flex-1 bg-transparent text-[11px] text-zinc-300 outline-none placeholder:text-zinc-600 ${
            isGenerating ? 'opacity-40' : ''
          }`}
          placeholder="Describe what to create..."
          value={data.prompt}
          disabled={isGenerating}
          onChange={(event) => updateData({ prompt: event.target.value })}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              onGenerate(id)
            }
          }}
        />
        <button
          className={`nodrag flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-white transition-opacity ${
            isGenerating ? 'opacity-40' : 'hover:opacity-80'
          }`}
          disabled={isGenerating}
          onClick={() => onGenerate(id)}
          title="Generate"
        >
          <ArrowUp size={12} className="text-zinc-900" />
        </button>
      </div>
    </div>
  )
}
