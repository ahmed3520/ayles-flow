import {
  Eraser,
  FlipHorizontal,
  FlipVertical,
  Loader2,
  RefreshCw,
  RotateCw,
  Sparkles,
  SquarePen,
  Upload,
} from 'lucide-react'
import ToolbarHint from './ToolbarHint'
import type { ChangeEvent, Dispatch, RefObject, SetStateAction } from 'react'

import type { BlockNodeData, PortType } from '@/types/nodes'
import type { UploadContentCategory } from '@/types/uploads'

import type { ContentTypeConfigEntry, ImageToolActionState } from './constants'

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

type DefaultToolbarControlsProps = {
  activeImageTool: ImageToolActionState
  bgRemoveModels?: Array<ImageToolModel>
  config: ContentTypeConfigEntry
  data: BlockNodeData
  getHintHandlers: (label: string) => HintHandlers
  hasResult: boolean
  hoveredHint: string | null
  isAIBlock: boolean
  isMediaNode: boolean
  models?: Array<ModelOption>
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
  selectedUpscaleModel: string
  setSelectedUpscaleModel: Dispatch<SetStateAction<string>>
  updateData: (updates: Partial<BlockNodeData>) => void
  upscaleModels?: Array<ImageToolModel>
}

export default function DefaultToolbarControls({
  activeImageTool,
  bgRemoveModels,
  config,
  data,
  getHintHandlers,
  hasResult,
  hoveredHint,
  isAIBlock,
  isMediaNode,
  models,
  onReplaceFileChange,
  onOpenTextEditor,
  replaceAccept,
  replaceCategory,
  replaceInputRef,
  replacing,
  resetNodeSize,
  runImageTool,
  selectedUpscaleModel,
  setSelectedUpscaleModel,
  updateData,
  upscaleModels,
}: DefaultToolbarControlsProps) {
  const Icon = config.icon
  const rotationDeg = data.rotationDeg || 0

  return (
    <>
      <Icon size={11} className="text-zinc-400" strokeWidth={2} />
      {!(hasResult && isMediaNode) && (
        <span className="text-[10px] font-medium tracking-wide text-zinc-400 uppercase">
          {config.label}
        </span>
      )}
      {isAIBlock && models && models.length > 0 && !hasResult && (
        <>
          <div className="h-3.5 w-px bg-zinc-700/50" />
          <select
            className="max-w-[120px] cursor-pointer truncate bg-transparent text-[10px] text-zinc-400 outline-none transition-colors hover:text-zinc-300 [&>option]:bg-zinc-900 [&>option]:text-zinc-300"
            value={data.model}
            title="Model"
            onChange={(event) => {
              const match = models.find(
                (model) => model.falId === event.target.value,
              )
              updateData({
                model: event.target.value,
                outputType: match ? (match.outputType as PortType) : undefined,
              })
            }}
          >
            {models.map((model) => (
              <option key={model._id} value={model.falId}>
                {model.name}
              </option>
            ))}
          </select>
        </>
      )}
      {data.contentType === 'text' && (
        <>
          <div className="h-3.5 w-px bg-zinc-700/50" />
          <ToolbarHint label="Text Editor" show={hoveredHint === 'Text Editor'}>
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
              onClick={onOpenTextEditor}
              {...getHintHandlers('Text Editor')}
            >
              <SquarePen size={11} />
            </button>
          </ToolbarHint>
        </>
      )}
      {hasResult && isMediaNode && (
        <>
          <div className="h-3.5 w-px bg-zinc-700/50" />
          <ToolbarHint label="Rotate" show={hoveredHint === 'Rotate'}>
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
              onClick={() =>
                updateData({ rotationDeg: (rotationDeg + 90) % 360 })
              }
              {...getHintHandlers('Rotate')}
            >
              <RotateCw size={11} />
            </button>
          </ToolbarHint>
          <ToolbarHint label="Flip H" show={hoveredHint === 'Flip H'}>
            <button
              type="button"
              className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
                data.flipX
                  ? 'bg-zinc-700/80 text-zinc-100'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
              }`}
              onClick={() => updateData({ flipX: !data.flipX })}
              {...getHintHandlers('Flip H')}
            >
              <FlipHorizontal size={11} />
            </button>
          </ToolbarHint>
          <ToolbarHint label="Flip V" show={hoveredHint === 'Flip V'}>
            <button
              type="button"
              className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
                data.flipY
                  ? 'bg-zinc-700/80 text-zinc-100'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
              }`}
              onClick={() => updateData({ flipY: !data.flipY })}
              {...getHintHandlers('Flip V')}
            >
              <FlipVertical size={11} />
            </button>
          </ToolbarHint>
          <ToolbarHint label="Reset Size" show={hoveredHint === 'Reset Size'}>
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
              onClick={resetNodeSize}
              {...getHintHandlers('Reset Size')}
            >
              <RefreshCw size={11} />
            </button>
          </ToolbarHint>
          {replaceAccept && replaceCategory && (
            <>
              <ToolbarHint label="Replace" show={hoveredHint === 'Replace'}>
                <button
                  type="button"
                  className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-40"
                  disabled={replacing}
                  onClick={() => replaceInputRef.current?.click()}
                  {...getHintHandlers('Replace')}
                >
                  {replacing ? (
                    <Loader2 size={11} className="animate-spin" />
                  ) : (
                    <Upload size={11} />
                  )}
                </button>
              </ToolbarHint>
              <input
                ref={replaceInputRef}
                type="file"
                accept={replaceAccept}
                className="hidden"
                onChange={onReplaceFileChange}
              />
            </>
          )}
          {data.contentType === 'image' && (
            <>
              {bgRemoveModels && bgRemoveModels.length > 0 && (
                <ToolbarHint
                  label="BG Remove"
                  show={hoveredHint === 'BG Remove'}
                >
                  <button
                    type="button"
                    className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-40"
                    disabled={activeImageTool !== null}
                    onClick={() =>
                      runImageTool('remove_background', bgRemoveModels[0].falId)
                    }
                    {...getHintHandlers('BG Remove')}
                  >
                    {activeImageTool === 'remove_background' ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : (
                      <Eraser size={11} />
                    )}
                  </button>
                </ToolbarHint>
              )}
              {upscaleModels && upscaleModels.length > 0 && (
                <>
                  {upscaleModels.length > 1 && (
                    <select
                      title="Upscale model"
                      className="nodrag h-5 rounded border border-zinc-700 bg-zinc-800 px-1 text-[10px] text-zinc-300 outline-none"
                      value={selectedUpscaleModel}
                      onChange={(event) =>
                        setSelectedUpscaleModel(event.target.value)
                      }
                      disabled={activeImageTool !== null}
                    >
                      {upscaleModels.map((model) => (
                        <option key={model.falId} value={model.falId}>
                          {model.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <ToolbarHint label="Upscale" show={hoveredHint === 'Upscale'}>
                    <button
                      type="button"
                      className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-40"
                      disabled={
                        activeImageTool !== null || !selectedUpscaleModel
                      }
                      onClick={() =>
                        runImageTool('upscale', selectedUpscaleModel)
                      }
                      {...getHintHandlers('Upscale')}
                    >
                      {activeImageTool === 'upscale' ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        <Sparkles size={11} />
                      )}
                    </button>
                  </ToolbarHint>
                </>
              )}
            </>
          )}
        </>
      )}
    </>
  )
}
