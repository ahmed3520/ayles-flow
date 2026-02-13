import { Fragment, memo, useCallback, useEffect, useMemo } from 'react'
import {
  Handle,
  Position,
  useEdges,
  useReactFlow,
  useStore,
  useUpdateNodeInternals,
} from '@xyflow/react'
import {
  AlertCircle,
  ArrowUp,
  Download,
  FileText,
  Image,
  Loader2,
  Mic,
  Music,
  StickyNote,
  Ticket,
  Type,
  Video,
} from 'lucide-react'
import { useQuery } from 'convex/react'

import { api } from '../../../../convex/_generated/api'

import PdfViewer from '../PdfViewer'
import { useCanvasActions } from '../Canvas'
import type { Edge, Node, NodeProps } from '@xyflow/react'
import type { BlockNodeData, NodeContentType, PortType } from '@/types/nodes'
import { useGenerationStatus } from '@/hooks/useGenerationStatus'
import { AI_CONTENT_TYPES, PORT_TYPE_COLORS } from '@/types/nodes'
import { downloadNodeResult } from '@/utils/downloadUtils'

type BlockNodeType = Node<BlockNodeData, 'blockNode'>

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
}

function BlockNode({ id, data, selected }: NodeProps<BlockNodeType>) {
  const { setNodes } = useReactFlow()
  const updateNodeInternals = useUpdateNodeInternals()
  const { onGenerate } = useCanvasActions()
  const edges = useEdges()
  const config = contentTypeConfig[data.contentType]
  const Icon = config.icon
  const isAIBlock = AI_CONTENT_TYPES.includes(data.contentType)

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

  return (
    <div
      className={`group relative w-[320px] rounded-xl transition-all duration-200
        bg-zinc-900 border border-zinc-800/60
        shadow-[0_1px_3px_rgba(0,0,0,0.4)]
        hover:border-zinc-700/60
        ${selected ? 'ring-1 ring-white/20 border-zinc-700/60' : ''}`}
    >
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

      {/* Header — minimal bar with type + model selector */}
      <div className="px-3 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon size={12} className="text-zinc-500" strokeWidth={2} />
          <span className="text-[10px] font-medium text-zinc-500 tracking-wide uppercase">
            {config.label}
          </span>
        </div>
        {isAIBlock && models && models.length > 0 && (
          hasResult ? (
            <span className="text-[10px] text-zinc-600 max-w-[140px] truncate">
              {models.find((m) => m.falId === data.model)?.name}
            </span>
          ) : (
            <select
              className="nodrag text-[10px] text-zinc-600 bg-transparent outline-none cursor-pointer hover:text-zinc-400 transition-colors max-w-[140px] truncate [&>option]:bg-zinc-900 [&>option]:text-zinc-300"
              value={data.model}
              onChange={(e) => {
                const match = models.find(
                  (m) => m.falId === e.target.value,
                )
                updateData({
                  model: e.target.value,
                  outputType: match
                    ? (match.outputType as PortType)
                    : undefined,
                })
              }}
            >
              {models.map((m) => (
                <option key={m._id} value={m.falId}>
                  {m.name}
                </option>
              ))}
            </select>
          )
        )}
      </div>

      {/* Content area */}
      {isAIBlock ? (
        <div>
          {/* Idle — clean placeholder */}
          {data.generationStatus === 'idle' && (
            <div className="h-[180px] flex flex-col items-center justify-center">
              <Icon size={32} className="text-zinc-700" strokeWidth={1} />
              <span className="text-[11px] text-zinc-700 mt-3">
                {config.placeholder}
              </span>
            </div>
          )}

          {/* Generating — clean spinner */}
          {data.generationStatus === 'generating' && (
            <div className="h-[180px] flex flex-col items-center justify-center gap-3">
              <Loader2 size={20} className="text-zinc-400 animate-spin" />
              <span className="text-[11px] text-zinc-500">Generating</span>
            </div>
          )}

          {/* Completed — media is the hero */}
          {hasResult && (
            <div className="relative group/result">
              {data.contentType === 'image' && (
                <img
                  src={data.resultUrl}
                  alt={data.label}
                  className="w-full h-auto block rounded-b-xl"
                />
              )}
              {data.contentType === 'video' && (
                <video
                  src={data.resultUrl}
                  controls
                  className="nodrag w-full h-auto block"
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
                <div className="px-2 pb-2">
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

          {/* Error */}
          {data.generationStatus === 'error' && (
            <div className="h-[180px] flex flex-col items-center justify-center gap-2 px-6">
              <AlertCircle size={18} className="text-red-400/80" />
              <span className="text-[11px] text-red-400/80 text-center leading-relaxed">
                {data.errorMessage || 'Generation failed'}
              </span>
            </div>
          )}
        </div>
      ) : (
        <textarea
          className="nodrag nowheel w-full h-[180px] px-3 py-2.5 text-sm text-zinc-300 bg-transparent resize-none outline-none placeholder:text-zinc-600"
          placeholder={config.placeholder}
          value={data.prompt}
          onChange={(e) => updateData({ prompt: e.target.value })}
        />
      )}

      {/* Prompt bar (AI blocks only, hidden after result) */}
      {isAIBlock && !hasResult && (
        <div className="px-2.5 pb-2.5 pt-1">
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
          border: '2px solid #27272a',
        }}
      />
    </div>
  )
}

export default memo(BlockNode)
