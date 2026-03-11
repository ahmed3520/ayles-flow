import { memo } from 'react'
import AIBlockContent from './AIBlockContent'
import NoteBlockContent from './NoteBlockContent'
import TicketBlockContent from './TicketBlockContent'
import WebsiteBlockContent from './WebsiteBlockContent'
import type { ContentTypeConfigEntry, NoteTheme } from './constants'
import type { BlockNodeData } from '@/types/nodes'
import type {
  CSSProperties,
  Dispatch,
  SetStateAction,
  SyntheticEvent,
} from 'react'

type BlockNodeContentProps = {
  config: ContentTypeConfigEntry
  data: BlockNodeData
  deployLogs: string | null
  hasResult: boolean
  imageStyle: CSSProperties
  isAIBlock: boolean
  noteTheme: NoteTheme
  onImageLoaded: (event: SyntheticEvent<HTMLImageElement>) => void
  setDeployLogs: Dispatch<SetStateAction<string | null>>
  updateData: (updates: Partial<BlockNodeData>) => void
  videoStyle: CSSProperties
}

function BlockNodeContent({
  config,
  data,
  deployLogs,
  hasResult,
  imageStyle,
  isAIBlock,
  noteTheme,
  onImageLoaded,
  setDeployLogs,
  updateData,
  videoStyle,
}: BlockNodeContentProps) {
  if (isAIBlock) {
    return (
      <AIBlockContent
        config={config}
        data={data}
        hasResult={hasResult}
        imageStyle={imageStyle}
        onImageLoaded={onImageLoaded}
        videoStyle={videoStyle}
      />
    )
  }

  switch (data.contentType) {
    case 'note':
      return (
        <NoteBlockContent
          data={data}
          noteTheme={noteTheme}
          placeholder={config.placeholder}
          updateData={updateData}
        />
      )
    case 'ticket':
      return (
        <TicketBlockContent
          data={data}
          placeholder={config.placeholder}
          updateData={updateData}
        />
      )
    case 'website':
      return (
        <WebsiteBlockContent
          data={data}
          deployLogs={deployLogs}
          setDeployLogs={setDeployLogs}
        />
      )
    default:
      return (
        <textarea
          className="nodrag nowheel w-full flex-1 resize-none bg-transparent px-3 py-2.5 text-sm text-zinc-300 outline-none placeholder:text-zinc-600"
          placeholder={config.placeholder}
          value={data.prompt}
          onChange={(event) => updateData({ prompt: event.target.value })}
        />
      )
  }
}

export default memo(BlockNodeContent)
