import { NodeToolbar, Position } from '@xyflow/react'

import DefaultToolbarControls from './DefaultToolbarControls'
import NoteToolbarControls from './NoteToolbarControls'
import TicketToolbarControls from './TicketToolbarControls'
import WebsiteToolbarControls from './WebsiteToolbarControls'
import type {
  ContentTypeConfigEntry,
  ImageToolActionState,
  NoteTheme,
  ViewportPreset,
} from './constants'
import type { UploadContentCategory } from '@/types/uploads'
import type { BlockNodeData } from '@/types/nodes'
import type { ChangeEvent, Dispatch, RefObject, SetStateAction } from 'react'

type HintHandlers = {
  onBlur: () => void
  onFocus: () => void
  onMouseEnter: () => void
  onMouseLeave: () => void
}

type ModelOption = {
  _id: string
  falId: string
  name: string
  outputType: string
}

type ImageToolModel = {
  falId: string
  name: string
}

type BlockNodeToolbarProps = {
  activeImageTool: ImageToolActionState
  bgRemoveModels?: Array<ImageToolModel>
  config: ContentTypeConfigEntry
  data: BlockNodeData
  deployLogs: string | null
  downloading: boolean
  duplicateNode: () => void
  getHintHandlers: (label: string) => HintHandlers
  hasResult: boolean
  hovered: boolean
  hoveredHint: string | null
  id: string
  isAIBlock: boolean
  isMediaNode: boolean
  isNote: boolean
  isTicket: boolean
  isWebsite: boolean
  models?: Array<ModelOption>
  noteTheme: NoteTheme
  onReplaceFileChange: (
    event: ChangeEvent<HTMLInputElement>,
  ) => void | Promise<void>
  onOpenTextEditor: () => void
  replaceAccept?: string
  replaceCategory?: UploadContentCategory
  replaceInputRef: RefObject<HTMLInputElement | null>
  replacing: boolean
  resetNodeSize: () => void
  runImageTool: (
    action: Exclude<ImageToolActionState, null>,
    modelId: string,
  ) => Promise<void>
  selected: boolean
  selectedUpscaleModel: string
  sendNoteToAgent: () => void
  sendTicketToAgent: () => void
  setDeployLogs: Dispatch<SetStateAction<string | null>>
  setDownloading: Dispatch<SetStateAction<boolean>>
  setHoveredHint: Dispatch<SetStateAction<string | null>>
  setSelectedUpscaleModel: Dispatch<SetStateAction<string>>
  setViewportPreset: (preset: ViewportPreset) => void
  updateData: (updates: Partial<BlockNodeData>) => void
  upscaleModels?: Array<ImageToolModel>
}

export default function BlockNodeToolbar({
  activeImageTool,
  bgRemoveModels,
  config,
  data,
  deployLogs,
  downloading,
  duplicateNode,
  getHintHandlers,
  hasResult,
  hovered,
  hoveredHint,
  id,
  isAIBlock,
  isMediaNode,
  isNote,
  isTicket,
  isWebsite,
  models,
  noteTheme,
  onReplaceFileChange,
  onOpenTextEditor,
  replaceAccept,
  replaceCategory,
  replaceInputRef,
  replacing,
  resetNodeSize,
  runImageTool,
  selected,
  selectedUpscaleModel,
  sendNoteToAgent,
  sendTicketToAgent,
  setDeployLogs,
  setDownloading,
  setHoveredHint,
  setSelectedUpscaleModel,
  setViewportPreset,
  updateData,
  upscaleModels,
}: BlockNodeToolbarProps) {
  return (
    <NodeToolbar
      position={Position.Top}
      align="center"
      offset={8}
      isVisible={selected || hovered}
    >
      <div
        className={`nodrag flex max-w-[92vw] items-center gap-1.5 overflow-visible rounded-lg border px-2 py-1 backdrop-blur-sm shadow-lg ${
          isNote
            ? ''
            : isWebsite
              ? 'border-emerald-800/40 bg-zinc-800/90'
              : isTicket
                ? 'border-violet-800/40 bg-zinc-800/90'
                : 'border-zinc-700/50 bg-zinc-800/90'
        }`}
        style={
          isNote
            ? {
                backgroundColor: noteTheme.toolbar,
                borderColor: noteTheme.toolbarBorder,
              }
            : undefined
        }
      >
        {isWebsite ? (
          <WebsiteToolbarControls
            data={data}
            deployLogs={deployLogs}
            downloading={downloading}
            setDeployLogs={setDeployLogs}
            setDownloading={setDownloading}
            setViewportPreset={setViewportPreset}
            updateData={updateData}
          />
        ) : isNote ? (
          <NoteToolbarControls
            data={data}
            duplicateNode={duplicateNode}
            hoveredHint={hoveredHint}
            noteTheme={noteTheme}
            sendNoteToAgent={sendNoteToAgent}
            setHoveredHint={setHoveredHint}
            updateData={updateData}
          />
        ) : isTicket ? (
          <TicketToolbarControls
            hoveredHint={hoveredHint}
            id={id}
            sendTicketToAgent={sendTicketToAgent}
            setHoveredHint={setHoveredHint}
          />
        ) : (
          <DefaultToolbarControls
            activeImageTool={activeImageTool}
            bgRemoveModels={bgRemoveModels}
            config={config}
            data={data}
            getHintHandlers={getHintHandlers}
            hasResult={hasResult}
            hoveredHint={hoveredHint}
            isAIBlock={isAIBlock}
            isMediaNode={isMediaNode}
            models={models}
            onReplaceFileChange={onReplaceFileChange}
            onOpenTextEditor={onOpenTextEditor}
            replaceAccept={replaceAccept}
            replaceCategory={replaceCategory}
            replaceInputRef={replaceInputRef}
            replacing={replacing}
            resetNodeSize={resetNodeSize}
            runImageTool={runImageTool}
            selectedUpscaleModel={selectedUpscaleModel}
            setSelectedUpscaleModel={setSelectedUpscaleModel}
            updateData={updateData}
            upscaleModels={upscaleModels}
          />
        )}
      </div>
    </NodeToolbar>
  )
}
