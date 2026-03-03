import { Fragment, memo, useCallback, useEffect, useMemo, useState } from 'react'
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
  Download,
  ExternalLink,
  FileText,
  Globe,
  Image,
  Loader2,
  Mic,
  Monitor,
  Music,
  RefreshCw,
  Rocket,
  Smartphone,
  StickyNote,
  Tablet,
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
import { AI_CONTENT_TYPES, NODE_DEFAULTS, PORT_TYPE_COLORS } from '@/types/nodes'
import { downloadNodeResult } from '@/utils/downloadUtils'

type BlockNodeType = Node<BlockNodeData, 'blockNode'>

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

function BlockNode({ id, data, selected }: NodeProps<BlockNodeType>) {
  const { setNodes } = useReactFlow()
  const updateNodeInternals = useUpdateNodeInternals()
  const { onGenerate } = useCanvasActions()
  const edges = useEdges()
  const config = contentTypeConfig[data.contentType]
  const Icon = config.icon
  const isAIBlock = AI_CONTENT_TYPES.includes(data.contentType)
  const isNote = data.contentType === 'note'
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

  // Track Shift key for proportional resize
  const [isShiftHeld, setIsShiftHeld] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [deployLogs, setDeployLogs] = useState<string | null>(null)
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
      className={`group relative w-full h-full flex flex-col transition-all duration-200
        ${isNote
          ? `rounded-[2px] bg-amber-100 shadow-[2px_3px_15px_rgba(0,0,0,0.1),0_1px_4px_rgba(0,0,0,0.06)] hover:shadow-[2px_4px_20px_rgba(0,0,0,0.14)] ${selected ? 'ring-2 ring-amber-400/50' : ''}`
          : isTicket
          ? `rounded-xl bg-zinc-900 border border-zinc-800/60 border-l-[3px] border-l-violet-500 shadow-[0_1px_3px_rgba(0,0,0,0.4)] hover:border-zinc-700/60 hover:border-l-violet-400 ${selected ? 'ring-1 ring-violet-500/30 border-zinc-700/60' : ''}`
          : isWebsite
          ? `rounded-xl bg-zinc-900 border border-emerald-800/40 shadow-[0_2px_8px_rgba(0,0,0,0.5)] hover:border-emerald-700/50 ${selected ? 'ring-1 ring-emerald-500/30 border-emerald-700/50' : ''}`
          : `rounded-xl bg-zinc-900 border border-zinc-800/60 shadow-[0_1px_3px_rgba(0,0,0,0.4)] hover:border-zinc-700/60 ${selected ? 'ring-1 ring-white/20 border-zinc-700/60' : ''}`
        }`}
    >
      {/* Resize handles — always available, Shift = proportional */}
      <NodeResizer
        minWidth={defaults.minWidth}
        minHeight={defaults.minHeight}
        keepAspectRatio={isShiftHeld}
        isVisible={selected ?? false}
        lineClassName={resizerClasses.line}
        handleClassName={resizerClasses.handle}
      />

      {/* Floating toolbar above the node */}
      <NodeToolbar position={Position.Top} offset={8} isVisible>
        <div className={`nodrag flex items-center gap-1.5 px-2 py-1 rounded-lg backdrop-blur-sm shadow-lg ${
          isNote
            ? 'bg-amber-100/90 border border-amber-300/50'
            : isWebsite
            ? 'bg-zinc-800/90 border border-emerald-800/40'
            : isTicket
            ? 'bg-zinc-800/90 border border-violet-800/40'
            : 'bg-zinc-800/90 border border-zinc-700/50'
        }`}>
          {isWebsite ? (
            <>
              {data.previewUrl && (Object.keys(VIEWPORT_PRESETS) as ViewportPreset[]).map((preset) => {
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

                        while (true) {
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
              <StickyNote size={11} className="text-amber-600" />
              <span className="text-[10px] font-medium text-amber-700">Note</span>
            </>
          ) : isTicket ? (
            <>
              <div className="w-1.5 h-1.5 rounded-full bg-violet-500" />
              <span className="text-[10px] font-mono font-medium text-violet-400/90 tracking-wider uppercase">Ticket</span>
              <span className="text-[9px] font-mono text-zinc-500">#{id.slice(-4).toUpperCase()}</span>
            </>
          ) : (
            <>
              <Icon size={11} className="text-zinc-400" strokeWidth={2} />
              <span className="text-[10px] font-medium text-zinc-400 tracking-wide uppercase">{config.label}</span>
              {isAIBlock && models && models.length > 0 && (
                <>
                  <div className="w-px h-3.5 bg-zinc-700/50" />
                  {hasResult ? (
                    <span className="text-[10px] text-zinc-500 max-w-[120px] truncate">
                      {models.find((m) => m.falId === data.model)?.name}
                    </span>
                  ) : (
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
                  )}
                </>
              )}
            </>
          )}
        </div>
      </NodeToolbar>

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
            <div className="relative group/result flex-1 min-h-0">
              {data.contentType === 'image' && (
                <img
                  src={data.resultUrl}
                  alt={data.label}
                  className="w-full h-full object-contain block rounded-b-xl"
                />
              )}
              {data.contentType === 'video' && (
                <video
                  src={data.resultUrl}
                  controls
                  className="nodrag w-full h-full object-contain block"
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
        /* Sticky note — handwriting font, ruled lines, warm colors */
        <div className="relative flex-1 min-h-0">
          <div
            contentEditable
            suppressContentEditableWarning
            className="nodrag nowheel note-lines font-note w-full h-full px-5 py-3 text-[18px] leading-[32px] text-amber-900/80 bg-transparent overflow-y-auto outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-amber-400/50 empty:before:pointer-events-none"
            data-placeholder={config.placeholder}
            onInput={(e) => {
              const text = (e.target as HTMLDivElement).innerText
              updateData({ prompt: text })
            }}
            onFocus={(e) => {
              const el = e.target as HTMLDivElement
              if (data.prompt && !el.innerText) {
                el.innerText = data.prompt
              }
            }}
            ref={(el) => {
              if (el && data.prompt && !el.innerText) {
                el.innerText = data.prompt
              }
            }}
          />
          {/* Paper fold corner */}
          <div
            className="absolute bottom-0 right-0 w-5 h-5 pointer-events-none"
            style={{
              background: 'linear-gradient(225deg, rgba(245,235,200,0) 50%, rgba(180,140,50,0.12) 50%)',
            }}
          />
        </div>
      ) : isTicket ? (
        /* Ticket — structured card with description + status badges */
        <div className="px-3 py-2.5 flex-1 flex flex-col min-h-0">
          <textarea
            className="nodrag nowheel w-full flex-1 text-sm text-zinc-300 bg-transparent resize-none outline-none placeholder:text-zinc-600 leading-relaxed"
            placeholder={config.placeholder}
            value={data.prompt}
            onChange={(e) => updateData({ prompt: e.target.value })}
          />
          <div className="flex items-center gap-1.5 pt-2 mt-1 border-t border-zinc-800/50 flex-shrink-0">
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-400 font-medium">
              To Do
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 font-medium">
              Normal
            </span>
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
              <iframe
                src={data.previewUrl}
                className="nodrag nowheel w-full h-full bg-white rounded-b-xl"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                title={data.label || 'Live preview'}
              />
              {/* Deploy logs overlay */}
              {deployLogs && (
                <div className="absolute inset-0 bg-zinc-950/95 rounded-b-xl flex flex-col">
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
          border: isNote ? '2px solid #fde68a' : '2px solid #27272a',
        }}
      />
    </div>
  )
}

export default memo(BlockNode)
