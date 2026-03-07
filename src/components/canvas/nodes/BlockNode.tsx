import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Handle,
  NodeResizer,
  NodeToolbar,
  Position,
  useEdges,
  useReactFlow,
  useStore,
  useUpdateNodeInternals,
} from '@xyflow/react'
import {
  AlertCircle,
  ArrowUp,
  Copy,
  Download,
  Eraser,
  ExternalLink,
  FileText,
  FlipHorizontal,
  FlipVertical,
  Globe,
  GripHorizontal,
  Image,
  Loader2,
  Lock,
  Mic,
  Monitor,
  Music,
  RefreshCw,
  Rocket,
  RotateCw,
  Send,
  Smartphone,
  Sparkles,
  StickyNote,
  Tablet,
  Ticket,
  Type,
  Unlock,
  Upload,
  Video,
} from 'lucide-react'
import { useMutation, useQuery } from 'convex/react'
import TiptapEditor from './TiptapEditor'

import { api } from '../../../../convex/_generated/api'

import PdfViewer from '../PdfViewer'
import { useCanvasActions } from '../Canvas'
import type { Edge, Node, NodeProps } from '@xyflow/react'
import type { BlockNodeData, NodeContentType, PortType } from '@/types/nodes'
import type { UploadContentCategory } from '@/types/uploads'
import { useGenerationStatus } from '@/hooks/useGenerationStatus'
import { useFileUpload } from '@/hooks/useFileUpload'
import { submitImageTool } from '@/data/fal'
import { AI_CONTENT_TYPES, NODE_DEFAULTS, PORT_TYPE_COLORS } from '@/types/nodes'
import { downloadNodeResult } from '@/utils/downloadUtils'

type BlockNodeType = Node<BlockNodeData, 'blockNode'>

function ToolbarHint({ label, show, children }: { label: string; show: boolean; children: React.ReactNode }) {
  return (
    <span className="relative">
      {show && (
        <span className="absolute -top-6 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-[9px] text-zinc-300 whitespace-nowrap pointer-events-none z-10">
          {label}
        </span>
      )}
      {children}
    </span>
  )
}

const VIEWPORT_PRESETS = {
  desktop: { width: 640, icon: Monitor },
  tablet: { width: 480, icon: Tablet },
  mobile: { width: 375, icon: Smartphone },
} as const

type ViewportPreset = keyof typeof VIEWPORT_PRESETS

const contentTypeConfig: Record<
  NodeContentType,
  { icon: typeof Image; label: string; placeholder: string }
> = {
  image: { icon: Image, label: 'Image', placeholder: 'Generate an image' },
  text: { icon: Type, label: 'Text', placeholder: 'Generate text' },
  video: { icon: Video, label: 'Video', placeholder: 'Generate a video' },
  audio: { icon: Mic, label: 'Audio', placeholder: 'Generate audio' },
  music: { icon: Music, label: 'Music', placeholder: 'Generate music' },
  note: {
    icon: StickyNote,
    label: 'Note',
    placeholder: 'Write your note...',
  },
  ticket: {
    icon: Ticket,
    label: 'Ticket',
    placeholder: 'Describe the task...',
  },
  pdf: {
    icon: FileText,
    label: 'PDF',
    placeholder: 'Upload a PDF document',
  },
  website: {
    icon: Globe,
    label: 'Website',
    placeholder: 'Live preview',
  },
}

const REPLACE_ACCEPT_BY_TYPE: Partial<Record<NodeContentType, string>> = {
  image: 'image/jpeg,image/png,image/webp,image/gif',
  video: 'video/mp4,video/webm,video/quicktime',
  audio: 'audio/mpeg,audio/wav,audio/ogg,audio/mp4',
  music: 'audio/mpeg,audio/wav,audio/ogg,audio/mp4',
  pdf: 'application/pdf',
}

const UPLOAD_CATEGORY_BY_TYPE: Partial<
  Record<NodeContentType, UploadContentCategory>
> = {
  image: 'image',
  video: 'video',
  audio: 'audio',
  music: 'audio',
  pdf: 'pdf',
}

const TICKET_STATUSES = ['todo', 'doing', 'done'] as const
const TICKET_STATUS_CONFIG = {
  todo: { label: 'To Do', bg: 'bg-violet-500/15', text: 'text-violet-400' },
  doing: { label: 'Doing', bg: 'bg-amber-500/15', text: 'text-amber-400' },
  done: { label: 'Done', bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
} as const

const TICKET_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const
const TICKET_PRIORITY_CONFIG = {
  low: { label: 'Low', bg: 'bg-zinc-700', text: 'text-zinc-400' },
  normal: { label: 'Normal', bg: 'bg-zinc-700', text: 'text-zinc-400' },
  high: { label: 'High', bg: 'bg-orange-500/15', text: 'text-orange-400' },
  urgent: { label: 'Urgent', bg: 'bg-red-500/15', text: 'text-red-400' },
} as const

const TICKET_TAGS = [
  { value: '', label: 'No tag', color: 'bg-zinc-600' },
  { value: 'feature', label: 'Feature', color: 'bg-blue-500' },
  { value: 'bug', label: 'Bug', color: 'bg-red-500' },
  { value: 'design', label: 'Design', color: 'bg-pink-500' },
  { value: 'refactor', label: 'Refactor', color: 'bg-amber-500' },
  { value: 'docs', label: 'Docs', color: 'bg-emerald-500' },
] as const

const NOTE_COLORS = ['yellow', 'green', 'blue', 'pink', 'purple'] as const
const NOTE_COLOR_CONFIG = {
  yellow: { bg: '#fef3c7', text: '#78350f', lines: 'rgba(180,140,50,0.08)', fold: 'rgba(180,140,50,0.12)', dot: '#fbbf24', accent: '#d97706', ring: '#fbbf24', toolbar: '#fef3c7', toolbarBorder: '#fde68a' },
  green:  { bg: '#d1fae5', text: '#064e3b', lines: 'rgba(50,140,80,0.08)', fold: 'rgba(50,140,80,0.12)', dot: '#34d399', accent: '#059669', ring: '#34d399', toolbar: '#d1fae5', toolbarBorder: '#6ee7b7' },
  blue:   { bg: '#e0f2fe', text: '#0c4a6e', lines: 'rgba(50,100,180,0.08)', fold: 'rgba(50,100,180,0.12)', dot: '#38bdf8', accent: '#0284c7', ring: '#38bdf8', toolbar: '#e0f2fe', toolbarBorder: '#7dd3fc' },
  pink:   { bg: '#fce7f3', text: '#831843', lines: 'rgba(180,50,100,0.08)', fold: 'rgba(180,50,100,0.12)', dot: '#f472b6', accent: '#db2777', ring: '#f472b6', toolbar: '#fce7f3', toolbarBorder: '#f9a8d4' },
  purple: { bg: '#ede9fe', text: '#3b0764', lines: 'rgba(120,50,180,0.08)', fold: 'rgba(120,50,180,0.12)', dot: '#a78bfa', accent: '#7c3aed', ring: '#a78bfa', toolbar: '#ede9fe', toolbarBorder: '#c4b5fd' },
} as const

type ImageToolActionState = 'remove_background' | 'upscale' | null

function BlockNode({ id, data, selected }: NodeProps<BlockNodeType>) {
  const { setNodes } = useReactFlow()
  const updateNodeInternals = useUpdateNodeInternals()
  const { onGenerate, onAgentSend } = useCanvasActions()
  const { uploadFile } = useFileUpload()
  const edges = useEdges()
  const createGeneration = useMutation(api.generations.create)
  const setFalRequestId = useMutation(api.generations.setFalRequestId)
  const replaceInputRef = useRef<HTMLInputElement>(null)
  const config = contentTypeConfig[data.contentType]
  const Icon = config.icon
  const isAIBlock = AI_CONTENT_TYPES.includes(data.contentType)
  const isNote = data.contentType === 'note'
  const noteTheme = NOTE_COLOR_CONFIG[data.noteColor || 'yellow']
  const isTicket = data.contentType === 'ticket'
  const isWebsite = data.contentType === 'website'

  // Determine which media input types are connected to this node
  const connectedInputTypes = useMemo(() => {
    return edges
      .filter((e) => e.target === id && e.targetHandle)
      .map((e) => e.targetHandle!.replace('input-', '') as PortType)
  }, [edges, id])

  const hasConnectedPrompt = connectedInputTypes.includes('text')

  // Reactively read the connected source node's prompt text
  const connectedPromptText = useStore(
    useCallback(
      (state: { edges: Array<Edge>; nodeLookup: Map<string, Node> }) => {
        if (!hasConnectedPrompt) return null
        const textEdge = state.edges.find(
          (e: Edge) => e.target === id && e.targetHandle === 'input-text',
        )
        if (!textEdge) return null
        const srcNode = state.nodeLookup.get(textEdge.source)
        if (!srcNode) return null
        return (srcNode.data as BlockNodeData).prompt || ''
      },
      [id, hasConnectedPrompt],
    ),
  )

  // Reactively read the connected source node's image result URL
  const hasConnectedImage = connectedInputTypes.includes('image')
  const connectedImageUrl = useStore(
    useCallback(
      (state: { edges: Array<Edge>; nodeLookup: Map<string, Node> }) => {
        if (!hasConnectedImage) return null
        const imageEdge = state.edges.find(
          (e: Edge) => e.target === id && e.targetHandle === 'input-image',
        )
        if (!imageEdge) return null
        const srcNode = state.nodeLookup.get(imageEdge.source)
        if (!srcNode) return null
        return (srcNode.data as BlockNodeData).resultUrl || null
      },
      [id, hasConnectedImage],
    ),
  )
  // Sync connected text into this node's prompt so it shows in the input
  useEffect(() => {
    if (connectedPromptText !== null && connectedPromptText !== data.prompt) {
      updateData({ prompt: connectedPromptText })
    }
  }, [connectedPromptText])

  // Query models compatible with this block's content type + connected inputs
  const models = useQuery(
    api.models.listCompatible,
    isAIBlock
      ? {
          contentType: data.contentType,
          connectedInputTypes:
            connectedInputTypes.length > 0
              ? connectedInputTypes
              : undefined,
        }
      : 'skip',
  )

  const generation = useGenerationStatus(data.generationId)
  const isGenerating = data.generationStatus === 'generating'

  // Compute the union of non-text input types across all models for this content type
  const allModelsForType = useQuery(
    api.models.listByContentType,
    isAIBlock ? { contentType: data.contentType } : 'skip',
  )
  const mediaInputTypes = useMemo(() => {
    if (!allModelsForType || !data.model) return []
    const selectedModel = allModelsForType.find(
      (m) => m.falId === data.model,
    )
    if (!selectedModel) return []
    return selectedModel.inputs
      .filter((input) => input.type !== 'text')
      .map((input) => input.type as PortType)
      .sort()
  }, [allModelsForType, data.model])

  // Query image tool models (upscale + bg removal) for image blocks
  const upscaleModels = useQuery(
    api.models.listByContentType,
    data.contentType === 'image' ? { contentType: 'upscale' } : 'skip',
  )
  const bgRemoveModels = useQuery(
    api.models.listByContentType,
    data.contentType === 'image' ? { contentType: 'remove_background' } : 'skip',
  )
  const [selectedUpscaleModel, setSelectedUpscaleModel] = useState<string>('')

  // Set default upscale model
  useEffect(() => {
    if (upscaleModels && upscaleModels.length > 0 && !selectedUpscaleModel) {
      setSelectedUpscaleModel(upscaleModels[0].falId)
    }
  }, [upscaleModels, selectedUpscaleModel])

  // Map content type to port type — note/ticket output text
  const CONTENT_TO_PORT: Record<string, PortType> = {
    image: 'image',
    text: 'text',
    video: 'video',
    audio: 'audio',
    music: 'audio',
    note: 'text',
    ticket: 'text',
    pdf: 'pdf',
    website: 'text',
  }
  const outputType: PortType =
    data.outputType ?? CONTENT_TO_PORT[data.contentType]

  const hasResult = data.generationStatus === 'completed' && data.resultUrl

  // Update React Flow internals when handles change (dynamic handles)
  useEffect(() => {
    updateNodeInternals(id)
  }, [id, mediaInputTypes, outputType, hasResult, updateNodeInternals])

  // Set default model when models load
  useEffect(() => {
    if (models && models.length > 0 && !data.model) {
      updateData({
        model: models[0].falId,
        outputType: models[0].outputType as PortType,
      })
    }
  }, [models])

  // Re-select model if current model is not in filtered list
  useEffect(() => {
    if (models && models.length > 0 && data.model) {
      const stillValid = models.some((m) => m.falId === data.model)
      if (!stillValid) {
        updateData({
          model: models[0].falId,
          outputType: models[0].outputType as PortType,
        })
      }
    }
  }, [models, data.model])

  // Sync generation status from Convex to node data
  useEffect(() => {
    if (!generation) return

    if (generation.status === 'completed' && generation.resultUrl) {
      const meta = generation.resultMeta as
        | { width?: number; height?: number }
        | undefined
      updateData({
        generationStatus: 'completed',
        resultUrl: generation.resultUrl,
        imageWidth: meta?.width,
        imageHeight: meta?.height,
      })
    } else if (generation.status === 'error') {
      updateData({
        generationStatus: 'error',
        errorMessage: generation.errorMessage || 'Generation failed',
      })
    }
  }, [generation?.status, generation?.resultUrl])

  const updateData = useCallback(
    (updates: Partial<BlockNodeData>) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, ...updates } } : n,
        ),
      )
    },
    [id, setNodes],
  )

  const setViewportPreset = useCallback(
    (preset: ViewportPreset) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id
            ? {
                ...n,
                style: { ...n.style, width: VIEWPORT_PRESETS[preset].width },
                data: { ...n.data, viewportPreset: preset },
              }
            : n,
        ),
      )
    },
    [id, setNodes],
  )

  const defaults = NODE_DEFAULTS[data.contentType]
  const isMediaNode = data.contentType === 'image' || data.contentType === 'video'
  const imageResizeMinWidth = data.contentType === 'image' ? 80 : defaults.minWidth
  const imageResizeMinHeight = data.contentType === 'image' ? 80 : defaults.minHeight
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
      [id, defaults.height, defaults.width],
    ),
  )
  const rotationDeg = data.rotationDeg || 0
  const flipX = data.flipX ? -1 : 1
  const flipY = data.flipY ? -1 : 1
  const mediaTransformStyle = {
    transform: `rotate(${rotationDeg}deg) scale(${flipX}, ${flipY})`,
    transformOrigin: 'center',
  } as const
  const imageStyle = {
    ...mediaTransformStyle,
    objectFit: 'contain',
  } as const
  const videoStyle = {
    ...mediaTransformStyle,
    objectFit: 'cover',
  } as const

  // Track Shift key for proportional resize
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

      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== id) return n

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
            ...n,
            style: {
              ...n.style,
              width: Math.round(nextWidth),
              height: Math.round(nextHeight),
            },
            data: {
              ...n.data,
              imageWidth,
              imageHeight,
            },
          }
        }),
      )
    },
    [
      defaults.height,
      defaults.width,
      id,
      imageResizeMinHeight,
      imageResizeMinWidth,
      setNodes,
    ],
  )

  const resetNodeSize = useCallback(() => {
    if (data.contentType === 'image' && data.imageWidth && data.imageHeight) {
      fitNodeToImageAspect(data.imageWidth, data.imageHeight)
      return
    }
    setNodes((nds) =>
      nds.map((n) =>
        n.id === id
          ? { ...n, style: { ...n.style, width: defaults.width, height: defaults.height } }
          : n,
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
          data: { action, modelId, imageUrl: data.resultUrl, upscaleFactor: 2 },
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
    [data.resultUrl, updateData, createGeneration, setFalRequestId],
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
          generationStatus: 'completed',
          errorMessage: undefined,
        })
      } catch (error) {
        setToolbarError(error instanceof Error ? error.message : 'Replace failed')
      } finally {
        setReplacing(false)
        event.target.value = ''
      }
    },
    [replaceCategory, uploadFile, updateData],
  )

  const onImageLoaded = useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      if (!data.resultUrl) return

      const target = event.currentTarget
      fitNodeToImageAspect(target.naturalWidth, target.naturalHeight)
    },
    [data.resultUrl, fitNodeToImageAspect],
  )

  useEffect(() => {
    if (data.contentType !== 'image' || !data.resultUrl) return
    const resultUrl = data.resultUrl
    const img = new window.Image()
    img.onload = () => {
      fitNodeToImageAspect(img.naturalWidth, img.naturalHeight)
    }
    img.src = resultUrl
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
    const onDown = (e: KeyboardEvent) => { if (e.key === 'Shift') setIsShiftHeld(true) }
    const onUp = (e: KeyboardEvent) => { if (e.key === 'Shift') setIsShiftHeld(false) }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp) }
  }, [])

  const resizerClasses = isNote
    ? { line: '!border-amber-400/30', handle: '!w-2 !h-2 !bg-amber-400 !border-amber-500' }
    : isTicket
    ? { line: '!border-violet-500/30', handle: '!w-2 !h-2 !bg-violet-500 !border-violet-600' }
    : isWebsite
    ? { line: '!border-emerald-500/30', handle: '!w-2 !h-2 !bg-emerald-500 !border-emerald-600' }
    : { line: '!border-zinc-500/30', handle: '!w-2 !h-2 !bg-zinc-400 !border-zinc-500' }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`group relative w-full h-full flex flex-col transition-all duration-200
        ${isNote
          ? `rounded-[2px] shadow-[2px_3px_15px_rgba(0,0,0,0.1),0_1px_4px_rgba(0,0,0,0.06)] hover:shadow-[2px_4px_20px_rgba(0,0,0,0.14)] ${selected ? 'ring-2' : ''}`
          : isTicket
          ? `rounded-xl bg-zinc-900 border border-zinc-800/60 border-l-[3px] border-l-violet-500 shadow-[0_1px_3px_rgba(0,0,0,0.4)] hover:border-zinc-700/60 hover:border-l-violet-400 ${selected ? 'ring-1 ring-violet-500/30 border-zinc-700/60' : ''}`
          : isWebsite
          ? `rounded-xl bg-zinc-900 border border-emerald-800/40 shadow-[0_2px_8px_rgba(0,0,0,0.5)] hover:border-emerald-700/50 ${selected ? 'ring-1 ring-emerald-500/30 border-emerald-700/50' : ''}`
          : hasResult && isMediaNode
          ? `rounded-xl bg-zinc-900 border border-zinc-800/60 shadow-[0_1px_3px_rgba(0,0,0,0.4)] hover:border-zinc-700/60 ${selected ? 'ring-1 ring-white/20 border-zinc-700/60' : ''}`
          : `rounded-xl bg-zinc-900 border border-zinc-800/60 shadow-[0_1px_3px_rgba(0,0,0,0.4)] hover:border-zinc-700/60 ${selected ? 'ring-1 ring-white/20 border-zinc-700/60' : ''}`
        }`}
      style={isNote ? { backgroundColor: noteTheme.bg, '--tw-ring-color': noteTheme.ring } as React.CSSProperties : undefined}
    >
      {/* Resize handles — always available, Shift = proportional */}
      <NodeResizer
        minWidth={imageResizeMinWidth}
        minHeight={imageResizeMinHeight}
        keepAspectRatio={keepAspectOnResize}
        isVisible={selected}
        lineClassName={resizerClasses.line}
        handleClassName={resizerClasses.handle}
      />

      {/* Floating toolbar above the node */}
      <NodeToolbar position={Position.Top} align="center" offset={8} isVisible={selected || hovered}>
        <div
          className={`nodrag flex items-center gap-1.5 px-2 py-1 rounded-lg backdrop-blur-sm shadow-lg max-w-[92vw] overflow-visible border ${
            isNote
              ? ''
              : isWebsite
              ? 'bg-zinc-800/90 border-emerald-800/40'
              : isTicket
              ? 'bg-zinc-800/90 border-violet-800/40'
              : 'bg-zinc-800/90 border-zinc-700/50'
          }`}
          style={isNote ? { backgroundColor: noteTheme.toolbar, borderColor: noteTheme.toolbarBorder } : undefined}
        >
          {isWebsite ? (
            <>
              {data.previewUrl && (Object.keys(VIEWPORT_PRESETS) as Array<ViewportPreset>).map((preset) => {
                const { icon: PresetIcon } = VIEWPORT_PRESETS[preset]
                const isActive = (data.viewportPreset || 'desktop') === preset
                return (
                  <button
                    key={preset}
                    type="button"
                    className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                      isActive
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                    }`}
                    onClick={() => setViewportPreset(preset)}
                    title={preset.charAt(0).toUpperCase() + preset.slice(1)}
                  >
                    <PresetIcon size={13} />
                  </button>
                )
              })}
              {data.previewUrl && (
                <>
                  <div className="w-px h-3.5 bg-zinc-700/50" />
                  {/* Refresh preview */}
                  <button
                    type="button"
                    className="w-6 h-6 rounded-md flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
                    onClick={() => {
                      const base = data.previewUrl!.split('?_r=')[0]
                      updateData({ previewUrl: `${base}?_r=${Date.now()}` })
                    }}
                    title="Refresh preview"
                  >
                    <RefreshCw size={11} />
                  </button>
                  {/* Open preview in new tab */}
                  <a
                    href={data.previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-6 h-6 rounded-md flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
                    title="Open preview in new tab"
                  >
                    <ExternalLink size={11} />
                  </a>
                  <div className="w-px h-3.5 bg-zinc-700/50" />
                  {/* Deploy to Vercel */}
                  <button
                    type="button"
                    className="h-6 rounded-md flex items-center gap-1 px-1.5 text-emerald-400/80 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors disabled:opacity-40"
                    disabled={data.deploymentStatus === 'deploying' || downloading}
                    title={data.deploymentUrl ? `Deployed: ${data.deploymentUrl}` : 'Deploy to Vercel'}
                    onClick={async () => {
                      if (!data.sandboxId) return
                      updateData({ deploymentStatus: 'deploying' })
                      setDeployLogs('')
                      let gotResult = false
                      try {
                        const { deployToVercel } = await import('@/data/sandbox-sync')
                        const response = await deployToVercel({
                          data: { sandboxId: data.sandboxId, projectName: data.label || 'project' },
                        }) as unknown as Response

                        const reader = response.body?.getReader()
                        if (!reader) throw new Error('No response stream')

                        const decoder = new TextDecoder()
                        let buffer = ''

                        for (;;) {
                          const { done, value } = await reader.read()
                          if (done) break
                          buffer += decoder.decode(value, { stream: true })
                          const lines = buffer.split('\n')
                          buffer = lines.pop() || ''
                          for (const line of lines) {
                            if (!line.trim()) continue
                            try {
                              const event = JSON.parse(line)
                              if (event.type === 'log') {
                                setDeployLogs((prev) => (prev || '') + event.text)
                              } else if (event.type === 'done') {
                                gotResult = true
                                setDeployLogs((prev) => (prev || '') + `\n\nDeployed: ${event.url}`)
                                updateData({ deploymentUrl: event.url, deploymentStatus: 'ready' })
                              } else if (event.type === 'error') {
                                gotResult = true
                                setDeployLogs((prev) => (prev || '') + `\nERROR: ${event.text}`)
                                updateData({ deploymentStatus: 'error' })
                              }
                            } catch { /* skip malformed lines */ }
                          }
                        }

                        if (!gotResult) {
                          updateData({ deploymentStatus: 'error' })
                        }
                      } catch (e) {
                        const msg = e instanceof Error ? e.message : String(e)
                        setDeployLogs((prev) => (prev || '') + `\nERROR: ${msg}`)
                        updateData({ deploymentStatus: 'error' })
                      }
                    }}
                  >
                    {data.deploymentStatus === 'deploying' ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : (
                      <Rocket size={11} />
                    )}
                    <span className="text-[10px] font-medium">
                      {data.deploymentStatus === 'deploying' ? 'Deploying...' : data.deploymentStatus === 'ready' ? 'Deployed' : 'Deploy'}
                    </span>
                  </button>
                  {/* Deploy logs toggle */}
                  {deployLogs !== null && (
                    <button
                      type="button"
                      className="w-6 h-6 rounded-md flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
                      onClick={() => setDeployLogs(deployLogs ? null : '')}
                      title="Toggle deploy logs"
                    >
                      <FileText size={11} />
                    </button>
                  )}
                  {/* Open deployed site */}
                  {data.deploymentUrl && (
                    <a
                      href={data.deploymentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-6 rounded-md flex items-center gap-1 px-1.5 text-emerald-400/60 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors"
                      title={data.deploymentUrl}
                    >
                      <Globe size={11} />
                      <span className="text-[10px] font-medium">Live</span>
                    </a>
                  )}
                  <div className="w-px h-3.5 bg-zinc-700/50" />
                  {/* Download */}
                  <button
                    type="button"
                    className="h-6 rounded-md flex items-center gap-1 px-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors disabled:opacity-40"
                    disabled={downloading || data.deploymentStatus === 'deploying'}
                    title="Download project"
                    onClick={async () => {
                      if (!data.sandboxId) return
                      setDownloading(true)
                      try {
                        const { downloadProject } = await import('@/data/sandbox-sync')
                        const result = await downloadProject({
                          data: { sandboxId: data.sandboxId, projectName: data.label || 'project' },
                        })
                        const bytes = Uint8Array.from(atob(result.base64), (c) => c.charCodeAt(0))
                        const blob = new Blob([bytes], { type: 'application/gzip' })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = result.fileName
                        a.click()
                        URL.revokeObjectURL(url)
                      } catch (e) {
                        console.error('[download]', e)
                      } finally {
                        setDownloading(false)
                      }
                    }}
                  >
                    {downloading ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
                    <span className="text-[10px] font-medium">{downloading ? 'Downloading...' : 'Download'}</span>
                  </button>
                </>
              )}
            </>
          ) : isNote ? (
            <>
              <StickyNote size={11} style={{ color: noteTheme.accent }} />
              {/* Color presets */}
              <div className="flex items-center gap-1.5">
                {NOTE_COLORS.map((c) => {
                  const isActive = (data.noteColor || 'yellow') === c
                  return (
                    <button
                      key={c}
                      type="button"
                      className={`w-3.5 h-3.5 rounded-full transition-opacity ${isActive ? '' : 'opacity-50 hover:opacity-80'}`}
                      style={{ backgroundColor: NOTE_COLOR_CONFIG[c].dot, boxShadow: isActive ? `0 0 0 2px ${NOTE_COLOR_CONFIG[c].toolbar}, 0 0 0 3.5px ${NOTE_COLOR_CONFIG[c].dot}` : undefined }}
                      onClick={() => updateData({ noteColor: c })}
                      title={c}
                    />
                  )
                })}
              </div>
              <div className="w-px h-3.5 bg-black/10" />
              {/* Duplicate */}
              <ToolbarHint label="Duplicate" show={hoveredHint === 'note-duplicate'}>
                <button
                  type="button"
                  title="Duplicate"
                  className="w-6 h-6 rounded-md flex items-center justify-center hover:opacity-70 transition-opacity"
                  style={{ color: noteTheme.accent }}
                  onMouseEnter={() => setHoveredHint('note-duplicate')}
                  onMouseLeave={() => setHoveredHint(null)}
                  onClick={() => {
                    setNodes((nds) => {
                      const thisNode = nds.find((n) => n.id === id)
                      if (!thisNode) return nds
                      return [...nds, {
                        ...thisNode,
                        id: `node-${Date.now()}`,
                        position: { x: thisNode.position.x + 30, y: thisNode.position.y + 30 },
                        selected: false,
                        data: { ...thisNode.data },
                      }]
                    })
                  }}
                >
                  <Copy size={13} />
                </button>
              </ToolbarHint>
              {/* Send to agent */}
              <ToolbarHint label="Send to agent" show={hoveredHint === 'note-extract'}>
                <button
                  type="button"
                  title="Send to agent"
                  className="w-6 h-6 rounded-md flex items-center justify-center hover:opacity-70 transition-opacity"
                  style={{ color: noteTheme.accent }}
                  onMouseEnter={() => setHoveredHint('note-extract')}
                  onMouseLeave={() => setHoveredHint(null)}
                  onClick={() => {
                    const text = data.prompt.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
                    if (!text) return
                    onAgentSend(text)
                  }}
                >
                  <Send size={13} />
                </button>
              </ToolbarHint>
              <div className="w-px h-3.5 bg-black/10" />
              {/* Lock/Unlock */}
              <ToolbarHint label={data.noteLocked ? 'Unlock' : 'Lock'} show={hoveredHint === 'note-lock'}>
                <button
                  type="button"
                  title={data.noteLocked ? 'Unlock' : 'Lock'}
                  className="w-6 h-6 rounded-md flex items-center justify-center hover:opacity-70 transition-opacity"
                  style={{ color: noteTheme.accent }}
                  onMouseEnter={() => setHoveredHint('note-lock')}
                  onMouseLeave={() => setHoveredHint(null)}
                  onClick={() => updateData({ noteLocked: !data.noteLocked })}
                >
                  {data.noteLocked ? <Lock size={13} /> : <Unlock size={13} />}
                </button>
              </ToolbarHint>
            </>
          ) : isTicket ? (
            <>
              <div className="w-1.5 h-1.5 rounded-full bg-violet-500" />
              <span className="text-[10px] font-mono font-medium text-violet-400/90 tracking-wider uppercase">Ticket</span>
              <span className="text-[9px] font-mono text-zinc-500">#{id.slice(-4).toUpperCase()}</span>
              <div className="w-px h-3.5 bg-zinc-700/50" />
              <ToolbarHint label="Send to agent" show={hoveredHint === 'ticket-send'}>
                <button
                  type="button"
                  className="w-6 h-6 rounded-md flex items-center justify-center text-violet-400/70 hover:text-violet-300 hover:bg-violet-500/10 transition-colors"
                  title="Send to agent"
                  onMouseEnter={() => setHoveredHint('ticket-send')}
                  onMouseLeave={() => setHoveredHint(null)}
                  onClick={() => {
                    const text = data.prompt.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
                    if (!text) return
                    const tag = data.ticketTag ? `[${data.ticketTag}] ` : ''
                    onAgentSend(`${tag}Ticket #${id.slice(-4).toUpperCase()}: ${text}`)
                  }}
                >
                  <Send size={13} />
                </button>
              </ToolbarHint>
            </>
          ) : (
            <>
              <Icon size={11} className="text-zinc-400" strokeWidth={2} />
              {!(hasResult && isMediaNode) && (
                <span className="text-[10px] font-medium text-zinc-400 tracking-wide uppercase">
                  {config.label}
                </span>
              )}
              {isAIBlock && models && models.length > 0 && !hasResult && (
                <>
                  <div className="w-px h-3.5 bg-zinc-700/50" />
                  <select
                    className="text-[10px] text-zinc-400 bg-transparent outline-none cursor-pointer hover:text-zinc-300 transition-colors max-w-[120px] truncate [&>option]:bg-zinc-900 [&>option]:text-zinc-300"
                    value={data.model}
                    title="Model"
                    onChange={(e) => {
                      const match = models.find((m) => m.falId === e.target.value)
                      updateData({
                        model: e.target.value,
                        outputType: match ? (match.outputType as PortType) : undefined,
                      })
                    }}
                  >
                    {models.map((m) => (
                      <option key={m._id} value={m.falId}>{m.name}</option>
                    ))}
                  </select>
                </>
              )}
              {hasResult && isMediaNode && (
                <>
                  <div className="w-px h-3.5 bg-zinc-700/50" />
                  <ToolbarHint label="Rotate" show={hoveredHint === 'Rotate'}>
                    <button
                      type="button"
                      className="w-6 h-6 rounded-md flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                      onClick={() => updateData({ rotationDeg: (rotationDeg + 90) % 360 })}
                      {...getHintHandlers('Rotate')}
                    >
                      <RotateCw size={11} />
                    </button>
                  </ToolbarHint>
                  <ToolbarHint label="Flip H" show={hoveredHint === 'Flip H'}>
                    <button
                      type="button"
                      className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                        data.flipX
                          ? 'bg-zinc-700/80 text-zinc-100'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
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
                      className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                        data.flipY
                          ? 'bg-zinc-700/80 text-zinc-100'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
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
                      className="w-6 h-6 rounded-md flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
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
                          className="w-6 h-6 rounded-md flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors disabled:opacity-40"
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
                        <ToolbarHint label="BG Remove" show={hoveredHint === 'BG Remove'}>
                          <button
                            type="button"
                            className="w-6 h-6 rounded-md flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors disabled:opacity-40"
                            disabled={activeImageTool !== null}
                            onClick={() => runImageTool('remove_background', bgRemoveModels[0].falId)}
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
                              className="h-5 bg-zinc-800 text-zinc-300 text-[10px] rounded border border-zinc-700 px-1 outline-none nodrag"
                              value={selectedUpscaleModel}
                              onChange={(e) => setSelectedUpscaleModel(e.target.value)}
                              disabled={activeImageTool !== null}
                            >
                              {upscaleModels.map((m) => (
                                <option key={m.falId} value={m.falId}>
                                  {m.name}
                                </option>
                              ))}
                            </select>
                          )}
                          <ToolbarHint label="Upscale" show={hoveredHint === 'Upscale'}>
                            <button
                              type="button"
                              className="w-6 h-6 rounded-md flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors disabled:opacity-40"
                              disabled={activeImageTool !== null || !selectedUpscaleModel}
                              onClick={() => runImageTool('upscale', selectedUpscaleModel)}
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
          )}
        </div>
      </NodeToolbar>

      {toolbarError && (
        <div className="absolute top-9 left-2 right-2 z-20 rounded-md bg-red-500/10 border border-red-500/30 px-2 py-1 text-[10px] text-red-300 nodrag">
          {toolbarError}
        </div>
      )}

      {/* Input handles — AI blocks only, hidden after result */}
      {isAIBlock && !hasResult &&
        (() => {
          const allInputHandles: Array<{ type: PortType; label: string }> = [
            { type: 'text', label: 'Prompt' },
            ...mediaInputTypes.map((t) => ({
              type: t,
              label: t.charAt(0).toUpperCase() + t.slice(1),
            })),
          ]
          const total = allInputHandles.length
          return allInputHandles.map((handle, index) => {
            const isConnected = connectedInputTypes.includes(handle.type)
            const yPercent =
              total === 1 ? 50 : ((index + 1) / (total + 1)) * 100
            return (
              <Fragment key={`input-${handle.type}`}>
                <Handle
                  id={`input-${handle.type}`}
                  type="target"
                  position={Position.Left}
                  style={{
                    top: `${yPercent}%`,
                    background: isConnected
                      ? PORT_TYPE_COLORS[handle.type]
                      : '#71717a',
                    width: 10,
                    height: 10,
                    border: '2px solid #27272a',
                  }}
                />
                <span
                  className="absolute pointer-events-none text-[9px] whitespace-nowrap"
                  style={{
                    right: '100%',
                    marginRight: 8,
                    top: `${yPercent}%`,
                    transform: 'translateY(-50%)',
                    color: isConnected
                      ? PORT_TYPE_COLORS[handle.type]
                      : '#71717a',
                  }}
                >
                  {handle.label}
                </span>
              </Fragment>
            )
          })
        })()}

      {/* Note tape strip decoration */}
      {isNote && (
        <div className="flex justify-center pt-1 flex-shrink-0">
          <div className="w-16 h-[7px] rounded-[1px] bg-amber-300/50 shadow-[0_1px_2px_rgba(0,0,0,0.06)]" />
        </div>
      )}

      {/* Content area */}
      {isAIBlock ? (
        <div className="flex flex-col min-h-0 flex-1">
          {/* Idle — compact placeholder */}
          {data.generationStatus === 'idle' && (
            <div className="flex-1 flex flex-col items-center justify-center">
              <Icon size={32} className="text-zinc-700" strokeWidth={1} />
              <span className="text-[11px] text-zinc-700 mt-3">
                {config.placeholder}
              </span>
            </div>
          )}

          {/* Generating — compact spinner */}
          {data.generationStatus === 'generating' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <Loader2 size={20} className="text-zinc-400 animate-spin" />
              <span className="text-[11px] text-zinc-500">Generating</span>
            </div>
          )}

          {/* Completed — media fills available space */}
          {hasResult && (
            <div className="relative group/result flex-1 min-h-0 cursor-move">
              {/* Keep image/video previews non-interactive so drag/resize stays consistent. */}
              {data.contentType === 'image' && (
                <div className="w-full h-full overflow-hidden rounded-[inherit]">
                  <img
                    src={data.resultUrl}
                    alt={data.label}
                    className="w-full h-full block pointer-events-none select-none"
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
                  className="w-full h-full block rounded-b-xl pointer-events-none select-none"
                  style={videoStyle}
                  draggable={false}
                />
              )}
              {(data.contentType === 'audio' ||
                data.contentType === 'music') && (
                <div className="px-3 py-4">
                  <audio
                    src={data.resultUrl}
                    controls
                    className="nodrag w-full"
                  />
                </div>
              )}
              {data.contentType === 'pdf' && data.resultUrl && (
                <div className="px-2 pb-2 h-full">
                  <PdfViewer url={data.resultUrl} />
                </div>
              )}
              <button
                className="nodrag absolute top-2 right-2 w-7 h-7 rounded-lg bg-black/60 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover/result:opacity-100 transition-opacity hover:bg-black/80"
                onClick={() => downloadNodeResult(data)}
                title="Download"
              >
                <Download size={14} className="text-white" />
              </button>
            </div>
          )}

          {/* Error — compact */}
          {data.generationStatus === 'error' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 px-6">
              <AlertCircle size={18} className="text-red-400/80" />
              <span className="text-[11px] text-red-400/80 text-center leading-relaxed">
                {data.errorMessage || 'Generation failed'}
              </span>
            </div>
          )}
        </div>
      ) : isNote ? (
        /* Sticky note — live rich text editor */
        <div
          className="relative flex-1 min-h-0"
          style={{ backgroundImage: `repeating-linear-gradient(transparent, transparent 31px, ${noteTheme.lines} 31px, ${noteTheme.lines} 32px)` }}
        >
          <div
            className={`font-note px-5 py-3 h-full text-[18px] leading-[32px] [&_.tiptap_p]:leading-[32px] [&_.tiptap_h1]:text-xl [&_.tiptap_h1]:font-bold [&_.tiptap_h2]:text-lg [&_.tiptap_h2]:font-semibold [&_.tiptap_h3]:text-base [&_.tiptap_h3]:font-semibold [&_.tiptap_code]:text-sm [&_.tiptap_code]:bg-black/5 [&_.tiptap_code]:px-1 [&_.tiptap_code]:rounded [&_.tiptap_pre]:bg-black/5 [&_.tiptap_pre]:p-2 [&_.tiptap_pre]:rounded [&_.tiptap_blockquote]:border-l-2 [&_.tiptap_blockquote]:border-current/30 [&_.tiptap_blockquote]:pl-3 [&_.tiptap_blockquote]:italic [&_.tiptap_p.is-editor-empty:first-child::before]:opacity-40 [&_.tiptap_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.tiptap_p.is-editor-empty:first-child::before]:float-left [&_.tiptap_p.is-editor-empty:first-child::before]:pointer-events-none [&_.tiptap_p.is-editor-empty:first-child::before]:h-0 ${data.noteLocked ? 'pointer-events-none opacity-90' : ''}`}
            style={{ color: noteTheme.text }}
          >
            <TiptapEditor
              content={data.prompt}
              onChange={(html) => updateData({ prompt: html })}
              placeholder={config.placeholder}
            />
          </div>
          {data.noteLocked && (
            <div className="absolute top-2 right-2 pointer-events-none">
              <Lock size={12} style={{ color: noteTheme.accent, opacity: 0.4 }} />
            </div>
          )}
          {/* Paper fold corner */}
          <div
            className="absolute bottom-0 right-0 w-5 h-5 pointer-events-none"
            style={{
              background: `linear-gradient(225deg, rgba(245,235,200,0) 50%, ${noteTheme.fold} 50%)`,
            }}
          />
        </div>
      ) : isTicket ? (
        /* Ticket — live rich text editor */
        <div className="px-3 py-2.5 flex-1 flex flex-col min-h-0">
          <div className="flex-1 min-h-0 text-sm text-zinc-300 leading-relaxed [&_.tiptap_h1]:text-base [&_.tiptap_h1]:font-bold [&_.tiptap_h2]:text-sm [&_.tiptap_h2]:font-semibold [&_.tiptap_h3]:text-sm [&_.tiptap_h3]:font-semibold [&_.tiptap_p]:text-sm [&_.tiptap_p]:leading-relaxed [&_.tiptap_ul]:text-sm [&_.tiptap_ol]:text-sm [&_.tiptap_li]:text-sm [&_.tiptap_code]:text-xs [&_.tiptap_code]:bg-zinc-800 [&_.tiptap_code]:px-1 [&_.tiptap_code]:rounded [&_.tiptap_pre]:bg-zinc-800 [&_.tiptap_pre]:p-2 [&_.tiptap_pre]:rounded [&_.tiptap_blockquote]:border-l-2 [&_.tiptap_blockquote]:border-violet-500 [&_.tiptap_blockquote]:pl-3 [&_.tiptap_blockquote]:italic [&_.tiptap_blockquote]:text-zinc-400 [&_.tiptap_p.is-editor-empty:first-child::before]:text-zinc-600 [&_.tiptap_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.tiptap_p.is-editor-empty:first-child::before]:float-left [&_.tiptap_p.is-editor-empty:first-child::before]:pointer-events-none [&_.tiptap_p.is-editor-empty:first-child::before]:h-0">
            <TiptapEditor
              content={data.prompt}
              onChange={(html) => updateData({ prompt: html })}
              placeholder={config.placeholder}
            />
          </div>
          <div className="flex items-center gap-1.5 pt-2 mt-1 border-t border-zinc-800/50 flex-shrink-0 nodrag">
            {/* Status toggle */}
            <button
              type="button"
              className={`text-[9px] px-1.5 py-0.5 rounded font-medium cursor-pointer hover:opacity-80 transition-opacity ${TICKET_STATUS_CONFIG[data.ticketStatus || 'todo'].bg} ${TICKET_STATUS_CONFIG[data.ticketStatus || 'todo'].text}`}
              onClick={() => {
                const current = data.ticketStatus || 'todo'
                const idx = TICKET_STATUSES.indexOf(current)
                const next = TICKET_STATUSES[(idx + 1) % TICKET_STATUSES.length]
                updateData({ ticketStatus: next })
              }}
            >
              {TICKET_STATUS_CONFIG[data.ticketStatus || 'todo'].label}
            </button>
            {/* Priority toggle */}
            <button
              type="button"
              className={`text-[9px] px-1.5 py-0.5 rounded font-medium cursor-pointer hover:opacity-80 transition-opacity ${TICKET_PRIORITY_CONFIG[data.ticketPriority || 'normal'].bg} ${TICKET_PRIORITY_CONFIG[data.ticketPriority || 'normal'].text}`}
              onClick={() => {
                const current = data.ticketPriority || 'normal'
                const idx = TICKET_PRIORITIES.indexOf(current)
                const next = TICKET_PRIORITIES[(idx + 1) % TICKET_PRIORITIES.length]
                updateData({ ticketPriority: next })
              }}
            >
              {TICKET_PRIORITY_CONFIG[data.ticketPriority || 'normal'].label}
            </button>
            {/* Tag */}
            <select
              title="Tag"
              className="text-[9px] bg-transparent outline-none cursor-pointer text-zinc-400 hover:text-zinc-300 [&>option]:bg-zinc-900 [&>option]:text-zinc-300"
              value={data.ticketTag || ''}
              onChange={(e) => updateData({ ticketTag: e.target.value })}
            >
              {TICKET_TAGS.map((tag) => (
                <option key={tag.value} value={tag.value}>{tag.label}</option>
              ))}
            </select>
            {data.ticketTag && (
              <span className={`w-1.5 h-1.5 rounded-full ${TICKET_TAGS.find((t) => t.value === data.ticketTag)?.color || 'bg-zinc-600'}`} />
            )}
          </div>
        </div>
      ) : isWebsite ? (
        /* Website preview — iframe with restore/deploy overlays */
        <div className="flex flex-col flex-1 min-h-0">
          {data.restoreStep ? (
            /* Sandbox restoration in progress */
            <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-zinc-950 rounded-b-xl">
              <div className="w-12 h-12 rounded-full border-2 border-emerald-500/20 flex items-center justify-center">
                <Loader2 size={24} className="text-emerald-400 animate-spin" />
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <span className="text-[12px] font-medium text-zinc-300">Restoring Project</span>
                <span className="text-[11px] text-emerald-400/80">{data.restoreStep}</span>
              </div>
              <div className="flex gap-1 mt-1">
                {['Creating', 'Restoring', 'Installing', 'Starting'].map((step, i) => {
                  const current = (data.restoreStep || '').toLowerCase()
                  const stepIdx = ['creating', 'restoring', 'installing', 'starting'].findIndex(
                    (s) => current.includes(s),
                  )
                  return (
                    <div
                      key={step}
                      className={`w-8 h-1 rounded-full transition-colors ${
                        i === stepIdx ? 'bg-emerald-400' : i < stepIdx ? 'bg-emerald-400/40' : 'bg-zinc-800'
                      }`}
                    />
                  )
                })}
              </div>
            </div>
          ) : data.previewUrl ? (
            <div className="flex-1 min-h-0 relative">
              <div
                className="absolute top-2 left-2 z-10 h-6 px-2 rounded-md bg-zinc-900/80 border border-zinc-700/70 text-zinc-300 text-[10px] font-medium flex items-center gap-1.5 cursor-grab active:cursor-grabbing select-none"
                title="Drag node"
              >
                <GripHorizontal size={10} className="text-zinc-400" />
                <span>Drag</span>
              </div>
              <iframe
                src={data.previewUrl}
                className="nodrag nowheel w-full h-full bg-white rounded-b-xl"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                title={data.label || 'Live preview'}
              />
              {/* Deploy logs overlay */}
              {deployLogs && (
                <div className="absolute inset-0 z-20 bg-zinc-950/95 rounded-b-xl flex flex-col">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
                    <span className="text-[11px] font-medium text-zinc-400">
                      {data.deploymentStatus === 'deploying' ? 'Deploying...' : 'Deploy Logs'}
                    </span>
                    <button
                      type="button"
                      className="text-zinc-500 hover:text-zinc-300 text-[10px]"
                      onClick={() => setDeployLogs(null)}
                    >
                      Close
                    </button>
                  </div>
                  <pre className="nodrag nowheel flex-1 overflow-auto p-3 text-[10px] leading-relaxed text-zinc-400 font-mono whitespace-pre-wrap">
                    {deployLogs}
                    {data.deploymentStatus === 'deploying' && (
                      <span className="inline-block w-1.5 h-3 bg-emerald-400 animate-pulse ml-0.5" />
                    )}
                  </pre>
                  {data.deploymentUrl && (
                    <div className="px-3 py-2 border-t border-zinc-800">
                      <a
                        href={data.deploymentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-emerald-400 hover:text-emerald-300 underline"
                      >
                        {data.deploymentUrl}
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <Loader2 size={20} className="text-emerald-400/60 animate-spin" />
              <span className="text-[11px] text-zinc-500">Loading preview...</span>
            </div>
          )}
        </div>
      ) : (
        <textarea
          className="nodrag nowheel w-full flex-1 px-3 py-2.5 text-sm text-zinc-300 bg-transparent resize-none outline-none placeholder:text-zinc-600"
          placeholder={config.placeholder}
          value={data.prompt}
          onChange={(e) => updateData({ prompt: e.target.value })}
        />
      )}

      {/* Prompt bar (AI blocks only, hidden after result) */}
      {isAIBlock && !hasResult && (
        <div className="px-2.5 pb-2.5 pt-1 flex-shrink-0 mt-auto">
          {connectedImageUrl && (
            <div className="flex items-center gap-1.5 mb-1.5 px-1">
              <img
                src={connectedImageUrl}
                alt="Connected input"
                className="w-8 h-8 rounded-md object-cover ring-1 ring-zinc-700/50 flex-shrink-0"
              />
              <span className="text-[10px] text-zinc-600 truncate">Input image</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 bg-zinc-800/40 rounded-lg px-2.5 py-1.5">
            <input
              className={`nodrag flex-1 text-[11px] bg-transparent outline-none text-zinc-300 placeholder:text-zinc-600 ${isGenerating ? 'opacity-40' : ''}`}
              placeholder="Describe what to create..."
              value={data.prompt}
              disabled={isGenerating}
              onChange={(e) => updateData({ prompt: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  onGenerate(id)
                }
              }}
            />
            <button
              className={`nodrag w-5 h-5 rounded-md bg-white flex items-center justify-center flex-shrink-0 transition-opacity ${isGenerating ? 'opacity-40' : 'hover:opacity-80'}`}
              disabled={isGenerating}
              onClick={() => onGenerate(id)}
              title="Generate"
            >
              <ArrowUp size={12} className="text-zinc-900" />
            </button>
          </div>
        </div>
      )}

      {/* Output handle */}
      <Handle
        id={`output-${outputType}`}
        type="source"
        position={Position.Right}
        style={{
          background: PORT_TYPE_COLORS[outputType],
          width: 10,
          height: 10,
          border: isNote ? `2px solid ${noteTheme.toolbarBorder}` : '2px solid #27272a',
        }}
      />
    </div>
  )
}

export default memo(BlockNode)
