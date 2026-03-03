import { useClerk } from '@clerk/tanstack-react-start'
import {
  Background,
  BackgroundVariant,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  ArrowRight,
  ArrowUp,
  Bot,
  Check,
  FileText,
  Globe,
  Image,
  Mic,
  Music,
  Send,
  StickyNote,
  Type,
  Upload,
  Video,
} from 'lucide-react'
import { Fragment, memo, useEffect, useRef, useState } from 'react'

import type { Edge, Node, NodeProps } from '@xyflow/react'
import Footer from '@/components/Footer'

/* ------------------------------------------------------------------ */
/*  Port colors (from the real app)                                    */
/* ------------------------------------------------------------------ */

const PORT_COLORS: Record<string, string> = {
  text: '#a1a1aa',
  image: '#60a5fa',
  video: '#a78bfa',
  audio: '#f472b6',
  pdf: '#34d399',
}

/* ------------------------------------------------------------------ */
/*  Hooks                                                              */
/* ------------------------------------------------------------------ */

function useFadeIn<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [visible, setVisible] = useState(false)
  const [done, setDone] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisible(true)
          io.disconnect()
        }
      },
      { threshold: 0.12 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  useEffect(() => {
    if (!visible) return
    const t = setTimeout(() => setDone(true), 950)
    return () => clearTimeout(t)
  }, [visible])
  return {
    ref,
    className: done
      ? 'opacity-100 translate-y-0'
      : `transition-[opacity,transform] duration-[900ms] ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`,
  }
}

function useOnScreen<T extends HTMLElement>(threshold = 0.3) {
  const ref = useRef<T>(null)
  const [triggered, setTriggered] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setTriggered(true)
          io.disconnect()
        }
      },
      { threshold },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [threshold])
  return { ref, triggered }
}

/* ------------------------------------------------------------------ */
/*  DemoBlockNode — visual clone of the real BlockNode                 */
/* ------------------------------------------------------------------ */

type DemoNodeData = {
  contentType: string
  label: string
  model?: string
  prompt?: string
  status: 'idle' | 'completed'
  resultUrl?: string
  resultGradient?: string
  outputType: string
  inputs: Array<{ type: string; label: string }>
  isAudioResult?: boolean
}

type DemoBlockNodeType = Node<DemoNodeData, 'demoBlock'>

const ICONS: Record<string, typeof Image> = {
  note: StickyNote,
  image: Image,
  video: Video,
  music: Music,
  audio: Mic,
  text: Type,
  pdf: FileText,
}

const DemoBlockNode = memo(({ data }: NodeProps<DemoBlockNodeType>) => {
  const Icon = ICONS[data.contentType] || Image
  const isAI = data.contentType !== 'note'
  const hasResult = data.status === 'completed'

  return (
    <div className="relative w-[320px] rounded-xl bg-zinc-900 border border-zinc-800/60 shadow-[0_1px_3px_rgba(0,0,0,0.4)] overflow-hidden cursor-grab active:cursor-grabbing">
      {/* Input handles */}
      {isAI &&
        data.inputs.map((inp, i) => {
          const total = data.inputs.length
          const yPct = total === 1 ? 50 : ((i + 1) / (total + 1)) * 100
          return (
            <Fragment key={`in-${inp.type}-${i}`}>
              <Handle
                id={`input-${inp.type}`}
                type="target"
                position={Position.Left}
                style={{
                  top: `${yPct}%`,
                  background: PORT_COLORS[inp.type] || '#71717a',
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
                  top: `${yPct}%`,
                  transform: 'translateY(-50%)',
                  color: PORT_COLORS[inp.type] || '#71717a',
                }}
              >
                {inp.label}
              </span>
            </Fragment>
          )
        })}

      {/* Header */}
      <div className="px-3 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon size={12} className="text-zinc-500" strokeWidth={2} />
          <span className="text-[10px] font-medium text-zinc-500 tracking-wide uppercase">
            {data.label}
          </span>
        </div>
        {data.model && (
          <span className="text-[10px] text-zinc-600 max-w-[140px] truncate">
            {data.model}
          </span>
        )}
      </div>

      {/* Content */}
      {isAI ? (
        <>
          {data.status === 'idle' && (
            <div className="h-[180px] flex flex-col items-center justify-center">
              <Icon size={32} className="text-zinc-700" strokeWidth={1} />
            </div>
          )}
          {hasResult && data.isAudioResult ? (
            <div
              className="px-4 py-6 flex items-center justify-center gap-[3px]"
              style={{ minHeight: 100 }}
            >
              {Array.from({ length: 32 }).map((_, i) => {
                const h = Math.sin(i * 0.5 + 1) * 28 + Math.cos(i * 0.8) * 16 + 22
                return (
                  <div
                    key={i}
                    className="rounded-full"
                    style={{
                      width: 3,
                      height: h,
                      backgroundColor: PORT_COLORS.audio,
                      opacity: 0.5 + Math.sin(i * 0.3) * 0.3,
                    }}
                  />
                )
              })}
            </div>
          ) : hasResult ? (
            <div
              className="relative"
              style={{
                background: data.resultGradient || '#0a0a15',
                minHeight: 160,
              }}
            >
              {data.resultUrl && (
                <img
                  src={data.resultUrl}
                  alt={data.label}
                  className="w-full h-auto block"
                  loading="eager"
                />
              )}
              {data.contentType === 'video' && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
                    <div className="w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[10px] border-l-white ml-0.5" />
                  </div>
                </div>
              )}
              {data.contentType === 'pdf' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/90">
                  <FileText size={28} className="text-emerald-400/60 mb-2" />
                  <span className="text-[11px] text-zinc-400">Research Report.pdf</span>
                  <span className="text-[9px] text-zinc-600 mt-0.5">12 pages</span>
                </div>
              )}
            </div>
          ) : null}
        </>
      ) : (
        <div className="px-3 py-2.5 h-[120px]">
          <p className="text-[12px] text-zinc-400 leading-relaxed">
            {data.prompt}
          </p>
        </div>
      )}

      {/* Prompt bar — AI idle blocks */}
      {isAI && data.status === 'idle' && (
        <div className="px-2.5 pb-2.5 pt-1">
          <div className="flex items-center gap-1.5 bg-zinc-800/40 rounded-lg px-2.5 py-1.5">
            <span className="flex-1 text-[11px] text-zinc-600 truncate">
              {data.prompt || 'Describe what to create...'}
            </span>
            <div className="w-5 h-5 rounded-md bg-white flex items-center justify-center shrink-0">
              <ArrowUp size={12} className="text-zinc-900" />
            </div>
          </div>
        </div>
      )}

      {/* Output handle */}
      <Handle
        id={`output-${data.outputType}`}
        type="source"
        position={Position.Right}
        style={{
          background: PORT_COLORS[data.outputType] || '#71717a',
          width: 10,
          height: 10,
          border: '2px solid #27272a',
        }}
      />
    </div>
  )
})

/* ------------------------------------------------------------------ */
/*  Canvas demo — all completed, professional showcase                 */
/* ------------------------------------------------------------------ */

const demoNodeTypes = { demoBlock: DemoBlockNode }

const SHOWCASE_NODES: Array<Node<DemoNodeData>> = [
  {
    id: 'note-1',
    type: 'demoBlock',
    position: { x: 0, y: 140 },
    data: {
      contentType: 'note',
      label: 'Note',
      prompt:
        'A cinematic desert highway at golden hour with dramatic storm clouds rolling in. Moody, atmospheric, wide angle.',
      status: 'completed',
      outputType: 'text',
      inputs: [],
    },
  },
  {
    id: 'image-1',
    type: 'demoBlock',
    position: { x: 480, y: 0 },
    data: {
      contentType: 'image',
      label: 'Image',
      model: 'FLUX 1.1 Pro Ultra',
      status: 'completed',
      resultUrl: 'https://picsum.photos/seed/quasar-desert/640/400',
      outputType: 'image',
      inputs: [{ type: 'text', label: 'Prompt' }],
    },
  },
  {
    id: 'video-1',
    type: 'demoBlock',
    position: { x: 480, y: 340 },
    data: {
      contentType: 'video',
      label: 'Video',
      model: 'Kling Video v2.1',
      status: 'completed',
      resultUrl: 'https://picsum.photos/seed/quasar-cinematic/640/400',
      outputType: 'video',
      inputs: [
        { type: 'text', label: 'Prompt' },
        { type: 'image', label: 'Image' },
      ],
    },
  },
  {
    id: 'music-1',
    type: 'demoBlock',
    position: { x: 960, y: 60 },
    data: {
      contentType: 'music',
      label: 'Music',
      model: 'MiniMax Music',
      status: 'completed',
      isAudioResult: true,
      outputType: 'audio',
      inputs: [{ type: 'text', label: 'Prompt' }],
    },
  },
  {
    id: 'pdf-1',
    type: 'demoBlock',
    position: { x: 960, y: 340 },
    data: {
      contentType: 'pdf',
      label: 'PDF',
      model: 'Deep Research',
      status: 'completed',
      resultUrl: '',
      outputType: 'pdf',
      inputs: [{ type: 'text', label: 'Prompt' }],
    },
  },
]

const SHOWCASE_EDGES: Edge[] = [
  {
    id: 'e-note-image',
    source: 'note-1',
    target: 'image-1',
    sourceHandle: 'output-text',
    targetHandle: 'input-text',
    style: { stroke: PORT_COLORS.text, strokeWidth: 2 },
  },
  {
    id: 'e-note-video',
    source: 'note-1',
    target: 'video-1',
    sourceHandle: 'output-text',
    targetHandle: 'input-text',
    style: { stroke: PORT_COLORS.text, strokeWidth: 2 },
  },
  {
    id: 'e-image-video',
    source: 'image-1',
    target: 'video-1',
    sourceHandle: 'output-image',
    targetHandle: 'input-image',
    style: { stroke: PORT_COLORS.image, strokeWidth: 2 },
    animated: true,
  },
  {
    id: 'e-note-music',
    source: 'note-1',
    target: 'music-1',
    sourceHandle: 'output-text',
    targetHandle: 'input-text',
    style: { stroke: PORT_COLORS.text, strokeWidth: 2 },
  },
  {
    id: 'e-note-pdf',
    source: 'note-1',
    target: 'pdf-1',
    sourceHandle: 'output-text',
    targetHandle: 'input-text',
    style: { stroke: PORT_COLORS.text, strokeWidth: 2 },
  },
]

function HeroCanvasInner() {
  const [nodes, , onNodesChange] = useNodesState(SHOWCASE_NODES)

  return (
    <div style={{ height: 620, backgroundColor: '#09090b' }}>
      <ReactFlow
        nodes={nodes}
        edges={SHOWCASE_EDGES}
        onNodesChange={onNodesChange}
        nodeTypes={demoNodeTypes}
        colorMode="dark"
        fitView
        fitViewOptions={{ padding: 0.15, maxZoom: 0.85 }}
        nodesDraggable
        panOnDrag
        panOnScroll={false}
        zoomOnScroll={false}
        zoomOnPinch
        zoomOnDoubleClick={false}
        nodesConnectable={false}
        elementsSelectable={false}
        preventScrolling={false}
        proOptions={{ hideAttribution: true }}
        style={{ cursor: 'grab', backgroundColor: '#09090b' }}
      >
        <Background
          variant={BackgroundVariant.Cross}
          gap={40}
          size={1}
          color="#52525b"
          style={{ backgroundColor: '#09090b' }}
        />
      </ReactFlow>
    </div>
  )
}

function HeroCanvas() {
  const f = useFadeIn<HTMLDivElement>()
  return (
    <div ref={f.ref} className={`mx-auto mt-16 max-w-6xl px-6 ${f.className}`}>
      <div className="relative overflow-hidden rounded-2xl border border-zinc-800/40 shadow-[0_0_120px_rgba(99,102,241,0.06)] transform-gpu">
        <ReactFlowProvider>
          <HeroCanvasInner />
        </ReactFlowProvider>
      </div>
      <p className="mt-3 text-center text-[11px] text-zinc-700">
        Drag the nodes around — this is your real canvas
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Agent Showcase                                                     */
/* ------------------------------------------------------------------ */

type AgentLine = {
  text: string
  isAction?: boolean
  isTool?: boolean
}

const AGENT_CONVERSATION: Array<
  | { role: 'user'; text: string }
  | { role: 'agent'; lines: AgentLine[] }
> = [
  {
    role: 'user',
    text: 'Research the latest trends in AI-generated music and create a content pipeline — image, video, and music from a single prompt.',
  },
  {
    role: 'agent',
    lines: [
      { text: "I'll research this and set up your pipeline." },
      { text: 'Searching the web for AI music trends 2025...', isTool: true },
      { text: 'Reading 12 sources...', isTool: true },
      { text: 'Generated PDF report — "AI Music Trends 2025"', isAction: true },
      { text: 'Added Note node with creative brief', isAction: true },
      { text: 'Added Image — Imagen 4', isAction: true },
      { text: 'Added Video — Kling Video v2.1', isAction: true },
      { text: 'Added Music — MiniMax Music', isAction: true },
      { text: 'Connected Note → Image → Video', isAction: true },
      { text: 'Connected Note → Music', isAction: true },
      {
        text: 'Done. I\'ve created a research report and wired up your full pipeline. Hit generate to run everything.',
      },
    ],
  },
]

function AgentShowcase() {
  const { ref, triggered } = useOnScreen<HTMLElement>(0.2)
  const [visibleCount, setVisibleCount] = useState(0)
  const messagesRef = useRef<HTMLDivElement>(null)

  const allLines: Array<{ role: string; text: string; isAction?: boolean; isTool?: boolean }> = []
  for (const msg of AGENT_CONVERSATION) {
    if (msg.role === 'user') {
      allLines.push({ role: 'user', text: msg.text })
    } else {
      for (const line of msg.lines) {
        allLines.push({ role: 'agent', ...line })
      }
    }
  }

  useEffect(() => {
    if (!triggered) return
    let i = 0
    const delays = [500, 800, 600, 500, 350, 350, 350, 350, 350, 350, 600]
    const step = () => {
      i++
      setVisibleCount(i)
      if (i < allLines.length) {
        setTimeout(step, delays[i] ?? 350)
      }
    }
    setTimeout(step, 600)
  }, [triggered, allLines.length])

  // Auto-scroll to bottom as new messages appear
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTo({ top: messagesRef.current.scrollHeight, behavior: 'smooth' })
    }
  }, [visibleCount])

  return (
    <section id="agent" ref={ref} className="px-6 py-28">
      <div className="mx-auto max-w-[1120px]">
        <div className="grid gap-12 lg:grid-cols-2 items-center">
          {/* Left — chat mockup */}
          <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 overflow-hidden">
            {/* Panel header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800/60">
              <Bot size={14} className="text-zinc-400" />
              <span className="text-[12px] font-semibold text-zinc-400">
                Agent
              </span>
            </div>
            {/* Messages */}
            <div ref={messagesRef} className="p-4 space-y-3 h-[380px] overflow-y-auto dark-scrollbar">
              {allLines.slice(0, visibleCount).map((line, i) => {
                if (line.role === 'user') {
                  return (
                    <div key={i} className="flex justify-end">
                      <div className="max-w-[85%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed bg-zinc-800 text-zinc-200 border border-zinc-700/50">
                        {line.text}
                      </div>
                    </div>
                  )
                }
                if (line.isAction) {
                  return (
                    <div
                      key={i}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800 border border-zinc-700/50 text-xs text-zinc-400"
                      style={{ animation: 'fadeSlideIn 0.3s ease-out' }}
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/70 shrink-0" />
                      {line.text}
                    </div>
                  )
                }
                if (line.isTool) {
                  return (
                    <div
                      key={i}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800/60 border border-zinc-700/30 text-xs text-zinc-500"
                      style={{ animation: 'fadeSlideIn 0.3s ease-out' }}
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500/60 shrink-0" />
                      {line.text}
                    </div>
                  )
                }
                return (
                  <div key={i} className="flex justify-start">
                    <div className="max-w-[90%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed text-zinc-300 border border-zinc-800">
                      {line.text}
                    </div>
                  </div>
                )
              })}
              {visibleCount > 0 && visibleCount < allLines.length && (
                <div className="flex items-center gap-1.5 px-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-pulse" />
                  <div
                    className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-pulse"
                    style={{ animationDelay: '0.2s' }}
                  />
                  <div
                    className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-pulse"
                    style={{ animationDelay: '0.4s' }}
                  />
                </div>
              )}
            </div>
            {/* Input bar */}
            <div className="px-4 pb-4">
              <div className="flex items-center gap-2 bg-zinc-800/40 rounded-xl px-3.5 py-2.5 border border-zinc-800/60">
                <span className="flex-1 text-[12px] text-zinc-600">
                  Ask the agent anything...
                </span>
                <Send size={14} className="text-zinc-600" />
              </div>
            </div>
          </div>

          {/* Right — description */}
          <div>
            <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full bg-zinc-800/50 border border-zinc-700/40">
              <Bot size={12} className="text-zinc-400" />
              <span className="text-[11px] font-medium text-zinc-400">
                AI Agent
              </span>
            </div>
            <h2 className="text-[clamp(1.75rem,3.5vw,2.75rem)] font-bold leading-[1.1] tracking-[-0.03em] text-white">
              Describe it.
              <br />
              <span className="text-zinc-500">The agent builds it.</span>
            </h2>
            <p className="mt-5 text-[16px] leading-relaxed text-zinc-500 max-w-md">
              Tell the agent what you need in plain language. It researches the web,
              picks the right models, creates nodes, wires connections, generates
              PDFs, and runs everything — hands-free.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                'Builds entire workflows from a single message',
                'Deep research — searches the web, synthesizes reports',
                'Generates publication-ready PDFs on the canvas',
                'Picks the best model for each task automatically',
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2.5 text-[14px] text-zinc-400"
                >
                  <Check
                    size={14}
                    className="shrink-0 text-emerald-500/70 mt-0.5"
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/*  Navbar                                                             */
/* ------------------------------------------------------------------ */

function Navbar({ onSignIn }: { onSignIn: () => void }) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 32)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  return (
    <nav
      className={`fixed inset-x-0 top-0 z-50 border-b backdrop-blur-2xl transition-[background-color,border-color] duration-500 ${scrolled ? 'bg-[#09090b]/80 border-zinc-800/40' : 'bg-transparent border-transparent'}`}
    >
      <div className="mx-auto flex h-14 max-w-[1120px] items-center justify-between px-6">
        <a
          href="#"
          className="font-logo text-[22px] text-white"
        >
          Ayles Flow
        </a>

        <div className="hidden items-center gap-7 md:flex">
          {['Agent', 'Features', 'Pricing'].map((l) => (
            <a
              key={l}
              href={`#${l.toLowerCase()}`}
              className="text-[13px] text-zinc-500 transition-colors hover:text-zinc-200"
            >
              {l}
            </a>
          ))}
        </div>

        <button
          onClick={onSignIn}
          className="rounded-full bg-white px-4 py-1.5 text-[13px] font-medium text-zinc-950 transition-colors hover:bg-zinc-200 cursor-pointer"
        >
          Sign in
        </button>
      </div>
    </nav>
  )
}

/* ------------------------------------------------------------------ */
/*  Hero                                                               */
/* ------------------------------------------------------------------ */

function Hero({ onSignIn }: { onSignIn: () => void }) {
  return (
    <section className="relative overflow-hidden px-6 pb-4 pt-32 sm:pt-40">
      <div className="relative mx-auto max-w-3xl text-center">
        <a
          href="/quasar"
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-zinc-700/50 px-4 py-1.5 text-[12px] text-zinc-400"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Partnered with SILX AI Inc. — Powered by Quasar
        </a>

        <h1 className="font-logo text-[clamp(3rem,7vw,5.5rem)] leading-[1.05] tracking-[-0.02em] text-white italic">
          Ready to flow?
        </h1>

        <p className="mx-auto mt-6 max-w-lg text-[17px] leading-relaxed text-zinc-500">
          Design, deploy, and scale AI workflows on one infinite canvas.
          Use any model. Let agents build the pipeline.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={onSignIn}
            className="group inline-flex items-center gap-2 rounded-full bg-white px-7 py-3 text-[14px] font-semibold text-zinc-950 transition-colors hover:bg-zinc-200 cursor-pointer"
          >
            Flow now
            <ArrowRight
              size={15}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </button>
          <a
            href="#agent"
            className="inline-flex rounded-full border border-zinc-800 px-7 py-3 text-[14px] text-zinc-500 transition-colors hover:border-zinc-700 hover:text-zinc-300 cursor-pointer"
          >
            See the agent
          </a>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/*  Provider logos                                                      */
/* ------------------------------------------------------------------ */

function QuasarLogo({ size = 20 }: { size?: number }) {
  return (
   <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 512 512"
    fill="none"
  >
    <rect width={512} height={512} rx={8} fill="#F43E01" />
    <g transform="scale(2.0) translate(-128, -128)">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M251.3 156.4C251.1 155.5 249.8 155.4 249.7 156.3L248.3 171.8C244.8 211.2 212.0 241.6 167.0 247.9C166.1 248.0 166.2 249.5 167.1 249.7C213.4 260.3 249.9 293.8 258.1 333.4L261.3 349.2C261.5 350.1 262.8 350.2 262.9 349.3L264.3 333.8C267.8 294.4 300.6 264.0 345.6 257.7C346.5 257.6 346.4 256.1 345.5 255.9C299.2 245.3 262.7 211.8 254.5 172.2L251.3 156.4ZM244.4 171.2L247.4 138.0C247.4 137.6 247.7 137.3 248.1 137.3L250.6 137.4C251.0 137.4 251.4 137.7 251.5 138.1L258.4 171.7C266.6 211.5 304.5 244.9 351.6 253.6L362.6 255.6C363.0 255.7 363.3 256.1 363.3 256.5L363.4 258.3C363.4 258.7 363.2 259.0 362.8 259.1L351.8 260.1C305.7 264.3 271.4 294.3 267.9 333.7L264.9 366.9C264.8 367.3 264.5 367.6 264.1 367.6L261.6 367.5C261.2 367.5 260.8 367.2 260.7 366.8L253.8 333.2C245.6 293.4 207.7 260.0 160.6 251.3L149.6 249.3C149.2 249.2 148.9 248.8 148.9 248.4L148.8 246.6C148.8 246.2 149.0 245.9 149.4 245.8L160.4 244.8C206.5 240.6 240.8 210.6 244.4 171.2Z"
        fill="white"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M206.8 315.6C226.5 305.8 250.9 289.6 275.1 269.2C299.3 248.8 318.7 228.5 330.4 211.9C336.3 203.6 340.2 196.4 341.8 190.8C342.7 188.0 342.9 185.7 342.7 184.0C342.5 182.3 341.9 181.4 341.3 180.8C340.6 180.3 339.5 179.8 337.5 179.6C335.5 179.4 332.8 179.6 329.5 180.3C322.8 181.7 314.3 184.9 304.3 189.8C284.6 199.6 261.2 215.8 237.0 236.2C212.8 256.6 193.4 277.0 181.7 293.6C175.8 301.9 171.9 309.1 170.3 314.7C169.4 317.5 169.2 319.8 169.4 321.5C169.6 323.2 170.2 324.1 170.8 324.7C171.5 325.2 172.6 325.7 174.6 325.9C176.6 326.1 179.3 325.9 182.6 325.2C189.3 323.8 197.8 320.6 206.8 315.6ZM167.6 326.7C180.0 337.2 229.5 312.5 278.2 271.5C326.9 230.5 356.4 189.0 344.0 178.5C331.6 168.0 282.1 192.7 233.4 233.7C184.7 274.7 155.2 316.2 167.6 326.7Z"
        fill="white"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M175.8 204.5C189.5 222.3 211.4 244.7 238.1 267.5C264.8 290.3 291.2 308.9 312.2 320.6C322.7 326.5 331.7 330.5 338.5 332.5C341.9 333.5 344.6 333.9 346.6 333.9C348.6 333.9 349.6 333.5 350.2 332.9C350.8 332.4 351.3 331.5 351.3 329.9C351.3 328.2 350.8 325.9 349.6 323.0C347.3 317.2 342.6 309.6 335.7 300.8C322.0 283.0 300.1 260.6 273.4 237.8C246.7 215.0 220.3 196.4 199.3 184.7C188.8 178.8 179.8 174.8 173.0 172.8C169.6 171.8 166.9 171.4 164.9 171.4C162.9 171.4 161.9 171.8 161.3 172.4C160.7 172.9 160.2 173.8 160.2 175.4C160.2 177.1 160.7 179.4 161.9 182.3C164.2 188.1 168.9 195.7 175.8 204.5ZM158.4 169.5C147.3 178.8 181.8 223.4 236.6 269.2C291.4 315.0 344.1 344.5 355.2 335.2C366.3 325.9 331.8 281.3 277.0 235.5C222.2 189.7 169.5 160.2 158.4 169.5Z"
        fill="white"
      />
    </g>
  </svg>
  )
}

function AnthropicLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill="none">
      <path fillRule="nonzero" d="M318.663 149.787h-43.368l78.952 212.423 43.368.004-78.952-212.427zm-125.326 0l-78.952 212.427h44.255l15.932-44.608 82.846-.004 16.107 44.612h44.255l-79.126-212.427h-45.317zm-4.251 128.341l26.91-74.701 27.083 74.701h-53.993z" fill="currentColor"/>
    </svg>
  )
}

function OpenAILogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.998 5.998 0 0 0-3.998 2.9 6.042 6.042 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
    </svg>
  )
}

function GoogleLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

function BFLLogo({ size = 20 }: { size?: number }) {
  return (
   <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 197 140"
    fill="none"
  >
    <g clipPath="url(#clip0_24_990)">
      <path
        d="M140.651 59.8389H119.806L98.9601 30.4717L33.9327 121.982H54.8224L98.9591 59.8408H119.805L75.6681 121.982H96.6163L140.651 59.8389L196.895 139.025H181.162V139.026H163.987V122.049L140.651 89.2061L117.445 121.986V139.025H63.5626L63.5616 139.027H42.7159L42.7169 139.025H0.894653L98.9601 0.973633L140.651 59.8389Z"
        fill="white"
      />
    </g>
    <defs>
      <clipPath id="clip0_24_990">
        <rect
          width={196}
          height={140}
          fill="white"
          transform="translate(0.894775)"
        />
      </clipPath>
    </defs>
  </svg>


  )
}

function KlingLogo({ size = 20 }: { size?: number }) {
  return (
    <span style={{ fontSize: size, fontWeight: 700, lineHeight: 1 }} className="text-current">K</span>
  )
}

function MiniMaxLogo({ size = 20 }: { size?: number }) {
  return (
    <img
      src="https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://minimaxi.com/&size=256"
      alt="MiniMax"
      width={size}
      height={size}
      className="rounded-sm"
      loading="lazy"
    />
  )
}

function ElevenLabsLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="8" y="3" width="3" height="18" rx="1.5" fill="currentColor" />
      <rect x="14" y="3" width="3" height="18" rx="1.5" fill="currentColor" />
    </svg>
  )
}

const PROVIDER_LOGOS: Array<{
  name: string
  logo: (props: { size?: number }) => React.ReactElement
}> = [
  { name: 'Quasar', logo: QuasarLogo },
  { name: 'Anthropic', logo: AnthropicLogo },
  { name: 'OpenAI', logo: OpenAILogo },
  { name: 'Google', logo: GoogleLogo },
  { name: 'Black Forest Labs', logo: BFLLogo },
  { name: 'Kling', logo: KlingLogo },
  { name: 'MiniMax', logo: MiniMaxLogo },
  { name: 'ElevenLabs', logo: ElevenLabsLogo },
]

function Providers() {
  const f = useFadeIn<HTMLDivElement>()
  return (
    <div ref={f.ref} className={f.className}>
      <div className="mx-auto max-w-5xl border-t border-zinc-800/40 px-6 py-14 text-center">
        <p className="mb-10 text-[11px] font-medium uppercase tracking-[0.15em] text-zinc-600">
          Powered by leading AI models
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-5">
          {PROVIDER_LOGOS.map((p) => (
            <div
              key={p.name}
              className="flex items-center gap-2 text-zinc-500 opacity-60 transition-opacity duration-200 hover:opacity-100"
            >
              <p.logo size={18} />
              <span className="text-[13px] font-medium">{p.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}


/* ------------------------------------------------------------------ */
/*  Steps — 01 Create · 02 Connect · 03 Generate                      */
/* ------------------------------------------------------------------ */

function Steps() {
  const f = useFadeIn<HTMLElement>()

  const menuItems = [
    { icon: Image, label: 'Image' },
    { icon: Video, label: 'Video' },
    { icon: Mic, label: 'Audio' },
    { icon: Music, label: 'Music' },
    { icon: Type, label: 'Text' },
    { icon: FileText, label: 'PDF' },
  ]

  return (
    <section ref={f.ref} className={`px-6 py-28 ${f.className}`}>
      <div className="mx-auto max-w-[1120px] grid gap-5 sm:grid-cols-3">
        {/* 01 — Create */}
        <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/20 overflow-hidden flex flex-col">
          <div className="p-6 pb-4">
            <div className="flex items-baseline gap-3">
              <span className="text-5xl font-bold text-zinc-800/60 tabular-nums">
                01
              </span>
              <span className="text-2xl font-bold text-white">Create</span>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center px-6 pb-4">
            <div className="w-[200px] bg-zinc-900 border border-zinc-800 rounded-lg shadow-[0_8px_30px_rgba(0,0,0,0.5)] p-1">
              <div className="px-3 py-1 text-[10px] text-zinc-600 uppercase tracking-wide">
                Add Block
              </div>
              {menuItems.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-2 px-3 py-1.5 text-[11px] text-zinc-300 rounded-md"
                >
                  <item.icon size={13} className="text-zinc-500" />
                  {item.label}
                </div>
              ))}
              <div className="h-px bg-zinc-800 my-1" />
              <div className="flex items-center gap-2 px-3 py-1.5 text-[11px] text-zinc-300 rounded-md">
                <Upload size={13} className="text-zinc-500" />
                Upload
              </div>
            </div>
          </div>
          <div className="px-6 pb-6">
            <h3 className="text-[15px] font-semibold text-zinc-200">
              Drop any block onto the canvas
            </h3>
            <p className="text-[13px] text-zinc-500 mt-1">
              Image, video, audio, music, text, PDF — or upload your own files.
            </p>
          </div>
        </div>

        {/* 02 — Connect */}
        <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/20 overflow-hidden flex flex-col">
          <div className="p-6 pb-4">
            <div className="flex items-baseline gap-3">
              <span className="text-5xl font-bold text-zinc-800/60 tabular-nums">
                02
              </span>
              <span className="text-2xl font-bold text-white">Connect</span>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center px-4 pb-4">
            <div
              className="relative w-full rounded-xl overflow-hidden"
              style={{
                aspectRatio: '4/3',
                backgroundImage:
                  'radial-gradient(#27272a40 1px, transparent 1px)',
                backgroundSize: '12px 12px',
                backgroundColor: '#09090b',
              }}
            >
              <svg
                viewBox="0 0 400 300"
                className="absolute inset-0 w-full h-full"
              >
                <path d="M 100 130 C 130 130, 135 70, 160 70" fill="none" stroke={PORT_COLORS.text} strokeWidth="2" opacity="0.4" />
                <path d="M 240 70 C 270 70, 270 150, 300 150" fill="none" stroke={PORT_COLORS.image} strokeWidth="2" opacity="0.4" />
                <path d="M 100 130 C 140 130, 140 220, 160 220" fill="none" stroke={PORT_COLORS.text} strokeWidth="2" opacity="0.4" />
                {/* Note */}
                <rect x="20" y="115" width="80" height="30" rx="6" fill="#18181b" stroke="#27272a" />
                <circle cx="100" cy="130" r="4" fill={PORT_COLORS.text} stroke="#27272a" strokeWidth="1.5" />
                <text x="55" y="134" textAnchor="middle" fill="#71717a" fontSize="10">Note</text>
                {/* Image */}
                <rect x="160" y="55" width="80" height="30" rx="6" fill="#18181b" stroke="#27272a" />
                <circle cx="160" cy="70" r="4" fill={PORT_COLORS.text} stroke="#27272a" strokeWidth="1.5" />
                <circle cx="240" cy="70" r="4" fill={PORT_COLORS.image} stroke="#27272a" strokeWidth="1.5" />
                <text x="200" y="74" textAnchor="middle" fill="#71717a" fontSize="10">Image</text>
                {/* Video */}
                <rect x="160" y="205" width="80" height="30" rx="6" fill="#18181b" stroke="#27272a" />
                <circle cx="160" cy="220" r="4" fill={PORT_COLORS.text} stroke="#27272a" strokeWidth="1.5" />
                <circle cx="240" cy="220" r="4" fill={PORT_COLORS.video} stroke="#27272a" strokeWidth="1.5" />
                <text x="200" y="224" textAnchor="middle" fill="#71717a" fontSize="10">Video</text>
                {/* Music */}
                <rect x="300" y="135" width="80" height="30" rx="6" fill="#18181b" stroke="#27272a" />
                <circle cx="300" cy="150" r="4" fill={PORT_COLORS.image} stroke="#27272a" strokeWidth="1.5" />
                <circle cx="380" cy="150" r="4" fill={PORT_COLORS.audio} stroke="#27272a" strokeWidth="1.5" />
                <text x="340" y="154" textAnchor="middle" fill="#71717a" fontSize="10">Music</text>
              </svg>
            </div>
          </div>
          <div className="px-6 pb-6">
            <h3 className="text-[15px] font-semibold text-zinc-200">
              Wire outputs to inputs
            </h3>
            <p className="text-[13px] text-zinc-500 mt-1">
              Chain models into multi-step pipelines. One output feeds the next.
            </p>
          </div>
        </div>

        {/* 03 — Generate */}
        <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/20 overflow-hidden flex flex-col">
          <div className="p-6 pb-4">
            <div className="flex items-baseline gap-3">
              <span className="text-5xl font-bold text-zinc-800/60 tabular-nums">
                03
              </span>
              <span className="text-2xl font-bold text-white">Generate</span>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center px-6 pb-4">
            <div className="w-[220px] rounded-xl bg-zinc-900 border border-zinc-800/60 overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.4)]">
              <div className="px-3 py-1.5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Image size={10} className="text-zinc-500" />
                  <span className="text-[9px] font-medium text-zinc-500 uppercase">
                    Image
                  </span>
                </div>
                <span className="text-[9px] text-zinc-600">FLUX 1.1 Pro</span>
              </div>
              <img
                src="https://picsum.photos/seed/ayles-gen/440/280"
                alt="Generated image"
                className="w-full h-auto block"
                style={{ backgroundColor: '#0a0a15', minHeight: 120 }}
                loading="lazy"
              />
            </div>
          </div>
          <div className="px-6 pb-6">
            <h3 className="text-[15px] font-semibold text-zinc-200">
              Hit run, get results
            </h3>
            <p className="text-[13px] text-zinc-500 mt-1">
              Output lands on canvas. Download it, or pipe it into the next
              step.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/*  Capabilities                                                       */
/* ------------------------------------------------------------------ */

function Capabilities() {
  const f = useFadeIn<HTMLElement>()
  const items = [
    {
      icon: Bot,
      title: 'AI Agent',
      desc: 'Build entire workflows from one sentence. The agent picks models, creates nodes, connects everything.',
    },
    {
      icon: Globe,
      title: 'Deep Research',
      desc: 'The agent searches the web, reads sources, and delivers structured research reports.',
    },
    {
      icon: FileText,
      title: 'PDF Generation',
      desc: 'Create publication-ready PDF documents directly on the canvas from agent output.',
    },
    {
      icon: Image,
      title: 'Every Media Type',
      desc: 'Image, video, audio, music, text — generate anything from a single workspace.',
    },
    {
      icon: Video,
      title: 'Chained Pipelines',
      desc: "One model's output feeds the next. Build multi-step production workflows visually.",
    },
    {
      icon: StickyNote,
      title: 'Version History',
      desc: 'Save snapshots. Restore any state. Experiment without fear of losing work.',
    },
  ]

  return (
    <section
      id="features"
      ref={f.ref}
      className={`px-6 py-28 ${f.className}`}
    >
      <div className="mx-auto max-w-[1040px]">
        <p className="mb-3 text-[13px] font-medium text-zinc-600">
          Capabilities
        </p>
        <h2 className="max-w-md text-[clamp(1.75rem,3.5vw,2.5rem)] font-bold leading-[1.15] tracking-[-0.025em] text-white">
          Built for people
          <br />
          who ship.
        </h2>

        <div className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-zinc-800/60 bg-zinc-800/20 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div
              key={item.title}
              className="border-b border-r border-zinc-800/40 bg-[#09090b] p-7 last:border-b-0 sm:[&:nth-child(2n)]:border-r-0 lg:[&:nth-child(2n)]:border-r lg:[&:nth-child(3n)]:border-r-0"
            >
              <item.icon
                size={18}
                className="text-zinc-600 mb-3"
                strokeWidth={1.5}
              />
              <h3 className="mb-2 text-[15px] font-semibold text-zinc-200">
                {item.title}
              </h3>
              <p className="text-[14px] leading-relaxed text-zinc-500">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/*  Pricing                                                            */
/* ------------------------------------------------------------------ */

function Pricing({ onSignIn }: { onSignIn: () => void }) {
  const f = useFadeIn<HTMLElement>()
  const plans = [
    {
      name: 'Free',
      price: '$0',
      sub: 'No credit card required.',
      features: [
        '10 credits / month',
        'All AI models',
        'Unlimited projects',
        'AI Agent',
      ],
      cta: 'Flow now',
      primary: false,
    },
    {
      name: 'Pro',
      price: '$17',
      sub: 'Everything, more capacity.',
      features: [
        '500 credits / month',
        'All AI models',
        'Unlimited projects',
        'AI Agent',
        'Deep Research',
        'Priority support',
      ],
      cta: 'Flow now',
      primary: true,
    },
  ]

  return (
    <section id="pricing" ref={f.ref} className={`px-6 py-28 ${f.className}`}>
      <div className="mx-auto max-w-[720px]">
        <div className="mb-14 text-center">
          <p className="mb-3 text-[13px] font-medium text-zinc-600">Pricing</p>
          <h2 className="text-[clamp(1.75rem,3.5vw,2.5rem)] font-bold tracking-[-0.025em] text-white">
            Start free. Scale when ready.
          </h2>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`flex flex-col rounded-2xl border p-7 ${
                p.primary
                  ? 'border-zinc-700/60 bg-zinc-900/50'
                  : 'border-zinc-800/50 bg-[#09090b]'
              }`}
            >
              <div className="mb-5 flex items-center gap-2">
                <span className="text-[15px] font-semibold text-zinc-200">
                  {p.name}
                </span>
                {p.primary && (
                  <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-[10px] font-semibold text-zinc-400">
                    POPULAR
                  </span>
                )}
              </div>
              <div className="mb-1">
                <span className="text-4xl font-bold tracking-tight text-white">
                  {p.price}
                </span>
                <span className="ml-1 text-[14px] text-zinc-600">/mo</span>
              </div>
              <p className="mb-6 text-[13px] text-zinc-600">{p.sub}</p>
              <ul className="mb-8 flex-1 space-y-2.5">
                {p.features.map((feat) => (
                  <li
                    key={feat}
                    className="flex items-center gap-2.5 text-[14px] text-zinc-400"
                  >
                    <Check size={14} className="shrink-0 text-zinc-600" />
                    {feat}
                  </li>
                ))}
              </ul>
              <button
                onClick={onSignIn}
                className={`w-full rounded-full py-2.5 text-[13px] font-semibold transition-colors cursor-pointer ${
                  p.primary
                    ? 'bg-white text-zinc-950 hover:bg-zinc-200'
                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                {p.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/*  Final CTA                                                          */
/* ------------------------------------------------------------------ */

function Cta({ onSignIn }: { onSignIn: () => void }) {
  const f = useFadeIn<HTMLElement>()
  return (
    <section ref={f.ref} className={`px-6 py-32 ${f.className}`}>
      <div className="mx-auto max-w-xl text-center">
        <h2 className="text-[clamp(1.75rem,4vw,2.75rem)] font-bold tracking-[-0.025em] text-white">
          Ready to ship faster?
        </h2>
        <p className="mx-auto mt-4 max-w-sm text-[16px] text-zinc-500">
          Go from idea to production in minutes. Free, no credit card.
        </p>
        <button
          onClick={onSignIn}
          className="group mt-10 inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-[14px] font-semibold text-zinc-950 transition-colors hover:bg-zinc-200 cursor-pointer"
        >
          Flow now
          <ArrowRight
            size={15}
            className="transition-transform group-hover:translate-x-0.5"
          />
        </button>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/*  Landing Page                                                       */
/* ------------------------------------------------------------------ */

export default function LandingPage() {
  const clerk = useClerk()
  const handleSignIn = () => clerk.openSignIn({})

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <Navbar onSignIn={handleSignIn} />
      <Hero onSignIn={handleSignIn} />
      <HeroCanvas />
      <Providers />
      <AgentShowcase />
      <Steps />
      <Capabilities />
      <Pricing onSignIn={handleSignIn} />
      <Cta onSignIn={handleSignIn} />
      <Footer onSignIn={handleSignIn} />
    </div>
  )
}
