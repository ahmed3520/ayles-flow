import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Handle,
  NodeResizer,
  Position,
  useEdges,
  useReactFlow,
  useStore,
  useUpdateNodeInternals,
} from '@xyflow/react'
import { useMutation, useQuery } from 'convex/react'

import { api } from '../../../../convex/_generated/api'

import { useCanvasActions } from '../CanvasActionsContext'

import AIPromptBar from './block-node/AIPromptBar'
import BlockNodeContent from './block-node/BlockNodeContent'
import BlockNodeInputHandles from './block-node/BlockNodeInputHandles'
import BlockNodeToolbar from './block-node/BlockNodeToolbar'
import {
  CONTENT_TO_PORT,
  CONTENT_TYPE_CONFIG,
  NOTE_COLOR_CONFIG,
  REPLACE_ACCEPT_BY_TYPE,
  UPLOAD_CATEGORY_BY_TYPE,
  VIEWPORT_PRESETS,
} from './block-node/constants'
import type { BlockNodeData, PortType } from '@/types/nodes'
import type { Edge, Node, NodeProps } from '@xyflow/react'
import type { CSSProperties, SyntheticEvent } from 'react'
import type {
  ImageToolActionState,
  ViewportPreset,
} from './block-node/constants'
import { useGenerationStatus } from '@/hooks/useGenerationStatus'
import { useFileUpload } from '@/hooks/useFileUpload'
import { submitImageTool } from '@/data/fal'
import {
  AI_CONTENT_TYPES,
  NODE_DEFAULTS,
  PORT_TYPE_COLORS,
} from '@/types/nodes'
import { getNodeReadableText } from '@/utils/nodeTextUtils'
import { getGenerationSyncUpdate } from '@/utils/nodeGenerationSync'

type BlockNodeType = Node<BlockNodeData, 'blockNode'>

function BlockNode({ id, data, selected }: NodeProps<BlockNodeType>) {
  const { setNodes } = useReactFlow()
  const updateNodeInternals = useUpdateNodeInternals()
  const { onAgentSend, onGenerate, onOpenTextWorkspace } = useCanvasActions()
  const { uploadFile } = useFileUpload()
  const edges = useEdges()
  const createGeneration = useMutation(api.generations.create)
  const setFalRequestId = useMutation(api.generations.setFalRequestId)
  const replaceInputRef = useRef<HTMLInputElement>(null)

  const updateData = useCallback(
    (updates: Partial<BlockNodeData>) => {
      setNodes((nodes) =>
        nodes.map((node) =>
          node.id === id
            ? { ...node, data: { ...node.data, ...updates } }
            : node,
        ),
      )
    },
    [id, setNodes],
  )

  const config = CONTENT_TYPE_CONFIG[data.contentType]
  const isAIBlock = AI_CONTENT_TYPES.includes(data.contentType)
  const isNote = data.contentType === 'note'
  const isTicket = data.contentType === 'ticket'
  const isWebsite = data.contentType === 'website'
  const noteTheme = NOTE_COLOR_CONFIG[data.noteColor || 'yellow']

  const connectedInputTypes = useMemo(() => {
    return edges
      .filter((edge) => edge.target === id && edge.targetHandle)
      .map((edge) => edge.targetHandle!.replace('input-', '') as PortType)
  }, [edges, id])

  const hasConnectedPrompt = connectedInputTypes.includes('text')
  const connectedPromptText = useStore(
    useCallback(
      (state: { edges: Array<Edge>; nodeLookup: Map<string, Node> }) => {
        if (!hasConnectedPrompt) return null

        const textEdge = state.edges.find(
          (edge: Edge) =>
            edge.target === id && edge.targetHandle === 'input-text',
        )
        if (!textEdge) return null

        const sourceNode = state.nodeLookup.get(textEdge.source)
        if (!sourceNode) return null

        const sourceData = sourceNode.data as BlockNodeData
        return getNodeReadableText(sourceData)
      },
      [hasConnectedPrompt, id],
    ),
  )

  const hasConnectedImage = connectedInputTypes.includes('image')
  const connectedImageUrl = useStore(
    useCallback(
      (state: { edges: Array<Edge>; nodeLookup: Map<string, Node> }) => {
        if (!hasConnectedImage) return null

        const imageEdge = state.edges.find(
          (edge: Edge) =>
            edge.target === id && edge.targetHandle === 'input-image',
        )
        if (!imageEdge) return null

        const sourceNode = state.nodeLookup.get(imageEdge.source)
        if (!sourceNode) return null

        return (sourceNode.data as BlockNodeData).resultUrl || null
      },
      [hasConnectedImage, id],
    ),
  )

  useEffect(() => {
    if (connectedPromptText !== null && connectedPromptText !== data.prompt) {
      updateData({ prompt: connectedPromptText })
    }
  }, [connectedPromptText, data.prompt, updateData])

  const models = useQuery(
    api.models.listCompatible,
    isAIBlock
      ? {
          contentType: data.contentType,
          connectedInputTypes:
            connectedInputTypes.length > 0 ? connectedInputTypes : undefined,
        }
      : 'skip',
  )

  const generation = useGenerationStatus(data.generationId)
  const isGenerating = data.generationStatus === 'generating'

  const allModelsForType = useQuery(
    api.models.listByContentType,
    isAIBlock ? { contentType: data.contentType } : 'skip',
  )

  const mediaInputTypes = useMemo(() => {
    if (!allModelsForType || !data.model) return []

    const selectedModel = allModelsForType.find(
      (model) => model.falId === data.model,
    )
    if (!selectedModel) return []

    return selectedModel.inputs
      .filter((input) => input.type !== 'text')
      .map((input) => input.type as PortType)
      .sort()
  }, [allModelsForType, data.model])

  const upscaleModels = useQuery(
    api.models.listByContentType,
    data.contentType === 'image' ? { contentType: 'upscale' } : 'skip',
  )
  const bgRemoveModels = useQuery(
    api.models.listByContentType,
    data.contentType === 'image'
      ? { contentType: 'remove_background' }
      : 'skip',
  )
  const [selectedUpscaleModel, setSelectedUpscaleModel] = useState('')

  useEffect(() => {
    if (upscaleModels && upscaleModels.length > 0 && !selectedUpscaleModel) {
      setSelectedUpscaleModel(upscaleModels[0].falId)
    }
  }, [selectedUpscaleModel, upscaleModels])

  const outputType: PortType =
    data.outputType ?? CONTENT_TO_PORT[data.contentType]
  const hasResult =
    data.generationStatus === 'completed' &&
    Boolean(data.resultUrl || data.resultText)

  useEffect(() => {
    updateNodeInternals(id)
  }, [hasResult, id, mediaInputTypes, outputType, updateNodeInternals])

  useEffect(() => {
    if (models && models.length > 0 && !data.model) {
      updateData({
        model: models[0].falId,
        outputType: models[0].outputType as PortType,
      })
    }
  }, [data.model, models, updateData])

  useEffect(() => {
    if (models && models.length > 0 && data.model) {
      const stillValid = models.some((model) => model.falId === data.model)
      if (!stillValid) {
        updateData({
          model: models[0].falId,
          outputType: models[0].outputType as PortType,
        })
      }
    }
  }, [data.model, models, updateData])

  useEffect(() => {
    const syncUpdate = getGenerationSyncUpdate(data, generation)
    if (syncUpdate) {
      updateData(syncUpdate)
    }
  }, [data, generation, updateData])

  const setViewportPreset = useCallback(
    (preset: ViewportPreset) => {
      setNodes((nodes) =>
        nodes.map((node) =>
          node.id === id
            ? {
                ...node,
                style: { ...node.style, width: VIEWPORT_PRESETS[preset].width },
                data: { ...node.data, viewportPreset: preset },
              }
            : node,
        ),
      )
    },
    [id, setNodes],
  )

  const defaults = NODE_DEFAULTS[data.contentType]
  const isMediaNode =
    data.contentType === 'image' || data.contentType === 'video'
  const imageResizeMinWidth =
    data.contentType === 'image' ? 80 : defaults.minWidth
  const imageResizeMinHeight =
    data.contentType === 'image' ? 80 : defaults.minHeight

  const nodeFrameSize = useStore(
    useCallback(
      (state: { nodeLookup: Map<string, Node> }) => {
        const node = state.nodeLookup.get(id)

        return {
          width:
            typeof node?.style?.width === 'number'
              ? node.style.width
              : defaults.width,
          height:
            typeof node?.style?.height === 'number'
              ? node.style.height
              : defaults.height,
        }
      },
      [defaults.height, defaults.width, id],
    ),
  )

  const rotationDeg = data.rotationDeg || 0
  const flipX = data.flipX ? -1 : 1
  const flipY = data.flipY ? -1 : 1
  const mediaTransformStyle: CSSProperties = {
    transform: `rotate(${rotationDeg}deg) scale(${flipX}, ${flipY})`,
    transformOrigin: 'center',
  }
  const imageStyle: CSSProperties = {
    ...mediaTransformStyle,
    objectFit: 'contain',
  }
  const videoStyle: CSSProperties = {
    ...mediaTransformStyle,
    objectFit: 'cover',
  }

  const [isShiftHeld, setIsShiftHeld] = useState(false)
  const keepAspectOnResize = data.contentType === 'image' || isShiftHeld
  const [downloading, setDownloading] = useState(false)
  const [deployLogs, setDeployLogs] = useState<string | null>(null)
  const [activeImageTool, setActiveImageTool] =
    useState<ImageToolActionState>(null)
  const [replacing, setReplacing] = useState(false)
  const [toolbarError, setToolbarError] = useState<string | null>(null)
  const [hovered, setHovered] = useState(false)
  const [hoveredHint, setHoveredHint] = useState<string | null>(null)

  const getHintHandlers = useCallback(
    (label: string) => ({
      onMouseEnter: () => setHoveredHint(label),
      onFocus: () => setHoveredHint(label),
      onMouseLeave: () => setHoveredHint(null),
      onBlur: () => setHoveredHint(null),
    }),
    [],
  )

  const replaceAccept = REPLACE_ACCEPT_BY_TYPE[data.contentType]
  const replaceCategory = UPLOAD_CATEGORY_BY_TYPE[data.contentType]

  const fitNodeToImageAspect = useCallback(
    (imageWidth: number, imageHeight: number) => {
      if (!(imageWidth > 0 && imageHeight > 0)) return

      const aspect = imageWidth / imageHeight
      if (!Number.isFinite(aspect) || aspect <= 0) return

      setNodes((nodes) =>
        nodes.map((node) => {
          if (node.id !== id) return node

          const maxDimension = 920
          let nextWidth = imageWidth
          let nextHeight = imageHeight

          const downscale = Math.min(
            1,
            maxDimension / nextWidth,
            maxDimension / nextHeight,
          )
          nextWidth *= downscale
          nextHeight *= downscale

          const upscale = Math.max(
            nextWidth < imageResizeMinWidth
              ? imageResizeMinWidth / nextWidth
              : 1,
            nextHeight < imageResizeMinHeight
              ? imageResizeMinHeight / nextHeight
              : 1,
          )
          nextWidth *= upscale
          nextHeight *= upscale

          if (nextWidth > maxDimension || nextHeight > maxDimension) {
            const finalScale = Math.min(
              maxDimension / nextWidth,
              maxDimension / nextHeight,
            )
            nextWidth *= finalScale
            nextHeight *= finalScale
          }

          return {
            ...node,
            style: {
              ...node.style,
              width: Math.round(nextWidth),
              height: Math.round(nextHeight),
            },
            data: {
              ...node.data,
              imageWidth,
              imageHeight,
            },
          }
        }),
      )
    },
    [id, imageResizeMinHeight, imageResizeMinWidth, setNodes],
  )

  const resetNodeSize = useCallback(() => {
    if (data.contentType === 'image' && data.imageWidth && data.imageHeight) {
      fitNodeToImageAspect(data.imageWidth, data.imageHeight)
      return
    }

    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id
          ? {
              ...node,
              style: {
                ...node.style,
                width: defaults.width,
                height: defaults.height,
              },
            }
          : node,
      ),
    )
  }, [
    data.contentType,
    data.imageHeight,
    data.imageWidth,
    defaults.height,
    defaults.width,
    fitNodeToImageAspect,
    id,
    setNodes,
  ])

  const runImageTool = useCallback(
    async (action: Exclude<ImageToolActionState, null>, modelId: string) => {
      if (!data.resultUrl || !modelId) return

      setToolbarError(null)
      setActiveImageTool(action)
      updateData({
        generationStatus: 'generating',
        errorMessage: undefined,
      })

      try {
        const generationId = await createGeneration({
          contentType: action,
          modelId,
          prompt: action,
        })

        updateData({ generationId: generationId as unknown as string })

        const { requestId } = await submitImageTool({
          data: {
            action,
            modelId,
            imageUrl: data.resultUrl,
            upscaleFactor: 2,
          },
        })

        await setFalRequestId({
          id: generationId,
          falRequestId: requestId,
        })
      } catch (error) {
        updateData({
          generationStatus: 'error',
          errorMessage:
            error instanceof Error ? error.message : 'Image action failed',
        })
      } finally {
        setActiveImageTool(null)
      }
    },
    [createGeneration, data.resultUrl, setFalRequestId, updateData],
  )

  const onReplaceFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file || !replaceCategory) return

      setToolbarError(null)
      setReplacing(true)

      try {
        const result = await uploadFile(file, replaceCategory)
        updateData({
          resultUrl: result.url,
          uploadId: result.uploadId,
          isUpload: true,
          generationId: undefined,
          generationStatus: 'completed',
          errorMessage: undefined,
        })
      } catch (error) {
        setToolbarError(
          error instanceof Error ? error.message : 'Replace failed',
        )
      } finally {
        setReplacing(false)
        event.target.value = ''
      }
    },
    [replaceCategory, updateData, uploadFile],
  )

  const onImageLoaded = useCallback(
    (event: SyntheticEvent<HTMLImageElement>) => {
      if (!data.resultUrl) return

      const target = event.currentTarget
      fitNodeToImageAspect(target.naturalWidth, target.naturalHeight)
    },
    [data.resultUrl, fitNodeToImageAspect],
  )

  useEffect(() => {
    if (data.contentType !== 'image' || !data.resultUrl) return

    const img = new window.Image()
    img.onload = () => {
      fitNodeToImageAspect(img.naturalWidth, img.naturalHeight)
    }
    img.src = data.resultUrl
  }, [data.contentType, data.resultUrl, fitNodeToImageAspect])

  useEffect(() => {
    if (data.contentType !== 'image') return
    if (!(data.imageWidth && data.imageHeight)) return

    const imageAspect = data.imageWidth / data.imageHeight
    const frameAspect = nodeFrameSize.width / nodeFrameSize.height

    if (!Number.isFinite(imageAspect) || !Number.isFinite(frameAspect)) return
    if (Math.abs(imageAspect - frameAspect) < 0.03) return

    fitNodeToImageAspect(data.imageWidth, data.imageHeight)
  }, [
    data.contentType,
    data.imageHeight,
    data.imageWidth,
    fitNodeToImageAspect,
    nodeFrameSize.height,
    nodeFrameSize.width,
  ])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Shift') setIsShiftHeld(true)
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Shift') setIsShiftHeld(false)
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  const duplicateNode = useCallback(() => {
    setNodes((nodes) => {
      const currentNode = nodes.find((node) => node.id === id)
      if (!currentNode) return nodes

      return [
        ...nodes,
        {
          ...currentNode,
          id: `node-${Date.now()}`,
          position: {
            x: currentNode.position.x + 30,
            y: currentNode.position.y + 30,
          },
          selected: false,
          data: { ...currentNode.data },
        },
      ]
    })
  }, [id, setNodes])

  const sendNoteToAgent = useCallback(() => {
    const text = getNodeReadableText(data)
    if (!text) return

    onAgentSend(text)
  }, [data, onAgentSend])

  const sendTicketToAgent = useCallback(() => {
    const text = getNodeReadableText(data)
    if (!text) return

    const tag = data.ticketTag ? `[${data.ticketTag}] ` : ''
    onAgentSend(`${tag}Ticket #${id.slice(-4).toUpperCase()}: ${text}`)
  }, [data, id, onAgentSend])

  const resizerClasses = isNote
    ? {
        line: '!border-amber-400/30',
        handle: '!w-2 !h-2 !bg-amber-400 !border-amber-500',
      }
    : isTicket
      ? {
          line: '!border-violet-500/30',
          handle: '!w-2 !h-2 !bg-violet-500 !border-violet-600',
        }
      : isWebsite
        ? {
            line: '!border-emerald-500/30',
            handle: '!w-2 !h-2 !bg-emerald-500 !border-emerald-600',
          }
        : {
            line: '!border-zinc-500/30',
            handle: '!w-2 !h-2 !bg-zinc-400 !border-zinc-500',
          }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`group relative flex h-full w-full flex-col transition-all duration-200 ${
        isNote
          ? `rounded-[2px] shadow-[2px_3px_15px_rgba(0,0,0,0.1),0_1px_4px_rgba(0,0,0,0.06)] hover:shadow-[2px_4px_20px_rgba(0,0,0,0.14)] ${
              selected ? 'ring-2' : ''
            }`
          : isTicket
            ? `rounded-xl border border-zinc-800/60 border-l-[3px] border-l-violet-500 bg-zinc-900 shadow-[0_1px_3px_rgba(0,0,0,0.4)] hover:border-zinc-700/60 hover:border-l-violet-400 ${
                selected ? 'ring-1 ring-violet-500/30 border-zinc-700/60' : ''
              }`
            : isWebsite
              ? `rounded-xl border border-emerald-800/40 bg-zinc-900 shadow-[0_2px_8px_rgba(0,0,0,0.5)] hover:border-emerald-700/50 ${
                  selected
                    ? 'ring-1 ring-emerald-500/30 border-emerald-700/50'
                    : ''
                }`
              : `rounded-xl border border-zinc-800/60 bg-zinc-900 shadow-[0_1px_3px_rgba(0,0,0,0.4)] hover:border-zinc-700/60 ${
                  selected ? 'ring-1 ring-white/20 border-zinc-700/60' : ''
                }`
      }`}
      style={
        isNote
          ? ({
              backgroundColor: noteTheme.bg,
              '--tw-ring-color': noteTheme.ring,
            } as CSSProperties)
          : undefined
      }
    >
      <NodeResizer
        minWidth={imageResizeMinWidth}
        minHeight={imageResizeMinHeight}
        keepAspectRatio={keepAspectOnResize}
        isVisible={selected}
        lineClassName={resizerClasses.line}
        handleClassName={resizerClasses.handle}
      />

      <BlockNodeToolbar
        activeImageTool={activeImageTool}
        bgRemoveModels={bgRemoveModels}
        config={config}
        data={data}
        deployLogs={deployLogs}
        downloading={downloading}
        duplicateNode={duplicateNode}
        getHintHandlers={getHintHandlers}
        hasResult={hasResult}
        hovered={hovered}
        hoveredHint={hoveredHint}
        id={id}
        isAIBlock={isAIBlock}
        isMediaNode={isMediaNode}
        isNote={isNote}
        isTicket={isTicket}
        isWebsite={isWebsite}
        models={models}
        noteTheme={noteTheme}
        onReplaceFileChange={onReplaceFileChange}
        onOpenTextEditor={() => onOpenTextWorkspace(id)}
        replaceAccept={replaceAccept}
        replaceCategory={replaceCategory}
        replaceInputRef={replaceInputRef}
        replacing={replacing}
        resetNodeSize={resetNodeSize}
        runImageTool={runImageTool}
        selected={selected}
        selectedUpscaleModel={selectedUpscaleModel}
        sendNoteToAgent={sendNoteToAgent}
        sendTicketToAgent={sendTicketToAgent}
        setDeployLogs={setDeployLogs}
        setDownloading={setDownloading}
        setHoveredHint={setHoveredHint}
        setSelectedUpscaleModel={setSelectedUpscaleModel}
        setViewportPreset={setViewportPreset}
        updateData={updateData}
        upscaleModels={upscaleModels}
      />

      {toolbarError && (
        <div className="nodrag absolute top-9 right-2 left-2 z-20 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 text-[10px] text-red-300">
          {toolbarError}
        </div>
      )}

      <BlockNodeInputHandles
        connectedInputTypes={connectedInputTypes}
        isVisible={isAIBlock && !hasResult}
        mediaInputTypes={mediaInputTypes}
      />

      {isNote && (
        <div className="flex shrink-0 justify-center pt-1">
          <div className="h-[7px] w-16 rounded-[1px] bg-amber-300/50 shadow-[0_1px_2px_rgba(0,0,0,0.06)]" />
        </div>
      )}

      <BlockNodeContent
        config={config}
        data={data}
        deployLogs={deployLogs}
        hasResult={hasResult}
        imageStyle={imageStyle}
        isAIBlock={isAIBlock}
        noteTheme={noteTheme}
        onImageLoaded={onImageLoaded}
        setDeployLogs={setDeployLogs}
        updateData={updateData}
        videoStyle={videoStyle}
      />

      {isAIBlock && !hasResult && (
        <AIPromptBar
          connectedImageUrl={connectedImageUrl}
          data={data}
          id={id}
          isGenerating={isGenerating}
          onGenerate={onGenerate}
          updateData={updateData}
        />
      )}

      <Handle
        id={`output-${outputType}`}
        type="source"
        position={Position.Right}
        style={{
          background: PORT_TYPE_COLORS[outputType],
          width: 10,
          height: 10,
          border: isNote
            ? `2px solid ${noteTheme.toolbarBorder}`
            : '2px solid #27272a',
        }}
      />
    </div>
  )
}

export default memo(BlockNode)
