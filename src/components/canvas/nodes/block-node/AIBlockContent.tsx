import { AlertCircle, Download, Loader2 } from 'lucide-react'
import { code } from '@streamdown/code'
import { Streamdown } from 'streamdown'
import { memo } from 'react'
import PdfViewer from '../../PdfViewer'

import type { CSSProperties, SyntheticEvent } from 'react'
import type { BlockNodeData } from '@/types/nodes'
import type { ContentTypeConfigEntry } from './constants'
import { isHtmlDocument } from '@/utils/nodeTextUtils'
import { downloadNodeResult } from '@/utils/downloadUtils'

const streamdownPlugins = { code }

type AIBlockContentProps = {
  config: ContentTypeConfigEntry
  data: BlockNodeData
  hasResult: boolean
  imageStyle: CSSProperties
  onImageLoaded: (event: SyntheticEvent<HTMLImageElement>) => void
  videoStyle: CSSProperties
}

function AIBlockContent({
  config,
  data,
  hasResult,
  imageStyle,
  onImageLoaded,
  videoStyle,
}: AIBlockContentProps) {
  const Icon = config.icon

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {data.generationStatus === 'idle' && (
        <div className="flex flex-1 flex-col items-center justify-center">
          <Icon size={32} className="text-zinc-700" strokeWidth={1} />
          <span className="mt-3 text-[11px] text-zinc-700">
            {config.placeholder}
          </span>
        </div>
      )}

      {data.generationStatus === 'generating' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <Loader2 size={20} className="animate-spin text-zinc-400" />
          <span className="text-[11px] text-zinc-500">Generating</span>
        </div>
      )}

      {hasResult && (
        <div className="group/result relative flex-1 min-h-0 cursor-move">
          {data.contentType === 'image' && (
            <div className="h-full w-full overflow-hidden rounded-[inherit]">
              <img
                src={data.resultUrl}
                alt={data.label}
                className="block h-full w-full pointer-events-none select-none"
                style={imageStyle}
                onLoad={onImageLoaded}
                draggable={false}
              />
            </div>
          )}
          {data.contentType === 'video' && (
            <video
              src={data.resultUrl}
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
              className="block h-full w-full rounded-b-xl pointer-events-none select-none"
              style={videoStyle}
              draggable={false}
            />
          )}
          {(data.contentType === 'audio' || data.contentType === 'music') && (
            <div className="px-3 py-4">
              <audio src={data.resultUrl} controls className="nodrag w-full" />
            </div>
          )}
          {data.contentType === 'text' && data.resultText && (
            <div className="nowheel h-full overflow-auto px-3 py-2.5">
              {isHtmlDocument(data.resultText) ? (
                <div
                  className="canvas-richtext break-words text-sm leading-relaxed text-zinc-300 [&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-zinc-700 [&_blockquote]:pl-3 [&_blockquote]:italic [&_code]:rounded [&_code]:bg-zinc-800 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs [&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1.5 [&_h3]:text-sm [&_h3]:font-semibold [&_hr]:my-4 [&_hr]:border-zinc-800 [&_li]:my-1 [&_ol]:my-3 [&_ol]:pl-5 [&_p]:my-2 [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-zinc-950 [&_pre]:p-3 [&_strong]:font-semibold [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5"
                  dangerouslySetInnerHTML={{ __html: data.resultText }}
                />
              ) : (
                <Streamdown
                  className="agent-markdown canvas-markdown break-words text-zinc-300"
                  mode="static"
                  plugins={streamdownPlugins}
                >
                  {data.resultText}
                </Streamdown>
              )}
            </div>
          )}
          {data.contentType === 'pdf' && data.resultUrl && (
            <div className="h-full px-2 pb-2">
              <PdfViewer url={data.resultUrl} />
            </div>
          )}
          {data.resultUrl && (
            <button
              className="nodrag absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-lg bg-black/60 opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/80 group-hover/result:opacity-100"
              onClick={() => downloadNodeResult(data)}
              title="Download"
            >
              <Download size={14} className="text-white" />
            </button>
          )}
        </div>
      )}

      {data.generationStatus === 'error' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6">
          <AlertCircle size={18} className="text-red-400/80" />
          <span className="text-center text-[11px] leading-relaxed text-red-400/80">
            {data.errorMessage || 'Generation failed'}
          </span>
        </div>
      )}
    </div>
  )
}

export default memo(AIBlockContent)
