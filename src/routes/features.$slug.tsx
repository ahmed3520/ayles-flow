import { useClerk } from '@clerk/tanstack-react-start'
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { createFileRoute, notFound } from '@tanstack/react-router'
import {
  ArrowRight,
  Bot,
  Check,
  Globe,
  Image,
  Network,
  Send,
  Type,
} from 'lucide-react'

import type { Edge, Node } from '@xyflow/react'
import type { BlockNodeData } from '@/types/nodes'
import BlockNodeComponent from '@/components/canvas/nodes/BlockNode'
import Footer from '@/components/Footer'
import {
  FEATURE_PAGES,
  getFeaturePageBySlug,
  getFeaturePagePath,
} from '@/data/featurePages'
import { NODE_DEFAULTS } from '@/types/nodes'
import {
  buildBreadcrumbSchema,
  buildSeoHead,
  buildWebPageSchema,
} from '@/utils/seo'

import type { FeatureIconKey } from '@/data/featurePages'

const FEATURE_ICONS = {
  network: Network,
  bot: Bot,
  globe: Globe,
  type: Type,
  image: Image,
} as const

const nodeTypes = { blockNode: BlockNodeComponent }

export const Route = createFileRoute('/features/$slug')({
  loader: ({ params }) => {
    const page = getFeaturePageBySlug(params.slug)
    if (!page) throw notFound()
    return page
  },
  head: ({ loaderData, params }) => {
    const page = loaderData ?? getFeaturePageBySlug(params.slug)
    if (!page) {
      return buildSeoHead({
        title: 'Features | Ayles Flow',
        description: 'Explore Ayles Flow feature pages.',
        path: '/features',
      })
    }
    return buildSeoHead({
      title: page.seoTitle,
      description: page.description,
      path: getFeaturePagePath(page.slug),
      schema: [
        buildWebPageSchema({
          title: page.seoTitle,
          description: page.description,
          path: getFeaturePagePath(page.slug),
        }),
        buildBreadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Features', path: '/features' },
          { name: page.title, path: getFeaturePagePath(page.slug) },
        ]),
      ],
    })
  },
  component: FeaturePage,
})

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function nodeStyle(
  contentType: BlockNodeData['contentType'],
  overrides?: Partial<{ height: number; width: number }>,
) {
  const d = NODE_DEFAULTS[contentType]
  return { width: d.width, height: d.height, ...overrides }
}

const PORT_COLORS: Record<string, string> = {
  text: '#a1a1aa',
  image: '#60a5fa',
  video: '#a78bfa',
  audio: '#f472b6',
  pdf: '#34d399',
}

/* ------------------------------------------------------------------ */
/*  Canvas scenes — real BlockNode components                          */
/* ------------------------------------------------------------------ */

const CANVAS_SCENE: Node<BlockNodeData>[] = [
  {
    id: 'note-1',
    type: 'blockNode',
    position: { x: 0, y: 60 },
    style: nodeStyle('note', { width: 280, height: 220 }),
    data: {
      contentType: 'note',
      label: 'Creative Brief',
      prompt:
        '<p>Q3 product launch campaign for Ayles Flow.</p><p>Deliver hero image, short demo video, narration, and final PDF brief.</p>',
      model: '',
      generationStatus: 'completed',
      outputType: 'text',
      noteColor: 'blue',
    },
  },
  {
    id: 'ticket-1',
    type: 'blockNode',
    position: { x: 0, y: 320 },
    style: nodeStyle('ticket', { width: 280, height: 200 }),
    data: {
      contentType: 'ticket',
      label: 'Launch Deliverables',
      prompt:
        '<p>Ship launch assets for Monday review.</p><ul><li>Brand-safe visual direction</li><li>Clear product UI framing</li></ul>',
      model: '',
      generationStatus: 'completed',
      outputType: 'text',
      ticketStatus: 'doing',
      ticketPriority: 'high',
      ticketTag: 'design',
    },
  },
  {
    id: 'image-1',
    type: 'blockNode',
    position: { x: 330, y: 60 },
    style: nodeStyle('image', { width: 300, height: 240 }),
    data: {
      contentType: 'image',
      label: 'Hero Image',
      prompt:
        'Premium SaaS hero visual, product dashboard, dark theme, clean gradient lighting',
      model: 'FLUX 1.1 Pro Ultra',
      generationStatus: 'completed',
      outputType: 'image',
      resultUrl:
        'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=360&h=270&q=80',
    },
  },
  {
    id: 'video-1',
    type: 'blockNode',
    position: { x: 680, y: 60 },
    style: nodeStyle('video', { width: 300, height: 240 }),
    data: {
      contentType: 'video',
      label: 'Launch Video',
      prompt:
        '8-second product reveal from dashboard hero still, cinematic camera move',
      model: 'Kling Video v2.1',
      generationStatus: 'idle',
      outputType: 'video',
    },
  },
  {
    id: 'music-1',
    type: 'blockNode',
    position: { x: 330, y: 340 },
    style: nodeStyle('music', { width: 300, height: 170 }),
    data: {
      contentType: 'music',
      label: 'Brand Soundtrack',
      prompt: 'Minimal electronic underscore, premium and steady tempo',
      model: 'MiniMax Music',
      generationStatus: 'completed',
      outputType: 'audio',
      resultUrl: 'https://samplelib.com/lib/preview/mp3/sample-6s.mp3',
    },
  },
  {
    id: 'audio-1',
    type: 'blockNode',
    position: { x: 680, y: 340 },
    style: nodeStyle('audio', { width: 300, height: 170 }),
    data: {
      contentType: 'audio',
      label: 'Narration',
      prompt: 'Confident launch voiceover, concise and product-focused',
      model: 'ElevenLabs',
      generationStatus: 'completed',
      outputType: 'audio',
      resultUrl: 'https://samplelib.com/lib/preview/mp3/sample-3s.mp3',
    },
  },
]

const CANVAS_EDGES: Edge[] = [
  {
    id: 'e1',
    source: 'note-1',
    target: 'image-1',
    sourceHandle: 'output-text',
    targetHandle: 'input-text',
    style: { stroke: PORT_COLORS.text, strokeWidth: 2 },
    animated: true,
  },
  {
    id: 'e2',
    source: 'image-1',
    target: 'video-1',
    sourceHandle: 'output-image',
    targetHandle: 'input-image',
    style: { stroke: PORT_COLORS.image, strokeWidth: 2 },
  },
]

// Media generation scene — focused on generation variety
const MEDIA_SCENE: Node<BlockNodeData>[] = [
  {
    id: 'img-flux',
    type: 'blockNode',
    position: { x: 0, y: 0 },
    style: nodeStyle('image', { width: 300, height: 250 }),
    data: {
      contentType: 'image',
      label: 'Primary Visual',
      prompt:
        'Enterprise software hero visual, clean UI framing, premium contrast',
      model: 'FLUX 1.1 Pro Ultra',
      generationStatus: 'completed',
      outputType: 'image',
      resultUrl:
        'https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=360&h=270&q=80',
    },
  },
  {
    id: 'img-imagen',
    type: 'blockNode',
    position: { x: 340, y: 0 },
    style: nodeStyle('image', { width: 300, height: 250 }),
    data: {
      contentType: 'image',
      label: 'Campaign Variant',
      prompt:
        'Team collaboration scene with dashboard on screen, editorial style',
      model: 'Imagen 4',
      generationStatus: 'completed',
      outputType: 'image',
      resultUrl:
        'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=360&h=270&q=80',
    },
  },
  {
    id: 'vid-1',
    type: 'blockNode',
    position: { x: 680, y: 0 },
    style: nodeStyle('video', { width: 300, height: 250 }),
    data: {
      contentType: 'video',
      label: 'Demo Cut',
      prompt: 'Short demo clip from hero visual with subtle motion and zoom',
      model: 'Kling Video v2.1',
      generationStatus: 'generating',
      outputType: 'video',
    },
  },
  {
    id: 'music-gen',
    type: 'blockNode',
    position: { x: 0, y: 290 },
    style: nodeStyle('music', { width: 300, height: 170 }),
    data: {
      contentType: 'music',
      label: 'Music Bed',
      prompt:
        'Modern tech underscore for launch video, restrained and polished',
      model: 'MiniMax Music',
      generationStatus: 'completed',
      outputType: 'audio',
      resultUrl: 'https://samplelib.com/lib/preview/mp3/sample-6s.mp3',
    },
  },
  {
    id: 'audio-gen',
    type: 'blockNode',
    position: { x: 340, y: 290 },
    style: nodeStyle('audio', { width: 300, height: 170 }),
    data: {
      contentType: 'audio',
      label: 'Voiceover',
      prompt: 'Warm professional narration for a 30-second product intro',
      model: 'ElevenLabs',
      generationStatus: 'completed',
      outputType: 'audio',
      resultUrl: 'https://samplelib.com/lib/preview/mp3/sample-3s.mp3',
    },
  },
  {
    id: 'text-gen',
    type: 'blockNode',
    position: { x: 680, y: 290 },
    style: nodeStyle('text', { width: 300, height: 170 }),
    data: {
      contentType: 'text',
      label: 'Launch Copy',
      prompt: 'Write a concise homepage value proposition for Ayles Flow',
      model: 'Claude Sonnet 4.6',
      generationStatus: 'completed',
      outputType: 'text',
      resultText:
        'Ayles Flow helps teams ship multimodal AI workflows from one visual canvas, faster and with less operational overhead.',
    },
  },
]

const MEDIA_EDGES: Edge[] = [
  {
    id: 'me1',
    source: 'img-flux',
    target: 'vid-1',
    sourceHandle: 'output-image',
    targetHandle: 'input-image',
    style: { stroke: PORT_COLORS.image, strokeWidth: 2 },
    animated: true,
  },
]

/* ------------------------------------------------------------------ */
/*  CanvasDemo — wraps ReactFlow with real BlockNode components        */
/* ------------------------------------------------------------------ */

function CanvasDemo({
  nodes,
  edges,
  height = 520,
}: {
  nodes: Node<BlockNodeData>[]
  edges: Edge[]
  height?: number
}) {
  return (
    <div
      className="overflow-hidden rounded-2xl border border-zinc-800/40 shadow-[0_0_120px_rgba(99,102,241,0.06)] transform-gpu"
      style={{ height }}
    >
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          colorMode="dark"
          fitView
          fitViewOptions={{ padding: 0.08, maxZoom: 1 }}
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
            gap={36}
            size={1}
            color="#52525b"
            style={{ backgroundColor: '#09090b' }}
          />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  CSS mockups — text editor, agent, research                         */
/* ------------------------------------------------------------------ */

function TextEditorMockup() {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800/40 bg-zinc-900/30">
      {/* Editor toolbar */}
      <div className="flex items-center gap-1 border-b border-zinc-800/40 px-4 py-2">
        {['H1', 'H2', 'B', 'I', 'Code'].map((btn) => (
          <div
            key={btn}
            className="rounded px-2 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-800/60 hover:text-zinc-400"
          >
            {btn}
          </div>
        ))}
        <div className="mx-2 h-4 w-px bg-zinc-800/60" />
        {['List', 'Quote', 'Table'].map((btn) => (
          <div
            key={btn}
            className="rounded px-2 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-800/60 hover:text-zinc-400"
          >
            {btn}
          </div>
        ))}
      </div>

      {/* Editor content */}
      <div className="relative p-6">
        <div className="space-y-4">
          <h2 className="text-[20px] font-bold text-zinc-200">
            Launch Brief: Ayles Flow Enterprise Rollout
          </h2>
          <p className="text-[14px] leading-relaxed text-zinc-400">
            Objective: publish a unified launch narrative for operations teams
            adopting multimodal AI workflows. Deliver landing copy, demo assets,
            and a one-page executive brief by Friday.
          </p>
          <h3 className="text-[16px] font-semibold text-zinc-300">
            Key points
          </h3>
          <ul className="list-disc space-y-1.5 pl-5 text-[14px] text-zinc-400">
            <li>
              Position Ayles Flow as the workflow layer, not another model
            </li>
            <li>Highlight research to PDF handoff as a core differentiator</li>
            <li>Use proof points from enterprise pilot teams in Q1</li>
          </ul>
        </div>

        {/* Slash menu popup */}
        <div className="absolute left-24 top-32 w-[200px] rounded-lg border border-zinc-800 bg-zinc-900 p-1 shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
          <div className="px-3 py-1 text-[10px] text-zinc-600 uppercase tracking-wide">
            Slash Commands
          </div>
          {[
            { label: 'Heading 1', active: false },
            { label: 'Heading 2', active: true },
            { label: 'Bullet List', active: false },
            { label: 'Code Block', active: false },
            { label: 'Table', active: false },
          ].map((item) => (
            <div
              key={item.label}
              className={`rounded-md px-3 py-1.5 text-[12px] ${item.active ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-400'}`}
            >
              {item.label}
            </div>
          ))}
        </div>

        {/* AI selection helper */}
        <div className="absolute right-6 top-44 flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 px-1.5 py-1 shadow-[0_4px_16px_rgba(0,0,0,0.4)]">
          {['Summarize', 'Rewrite', 'Shorten', 'Expand', 'Fix'].map(
            (action) => (
              <div
                key={action}
                className="rounded px-2 py-1 text-[10px] font-medium text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
              >
                {action}
              </div>
            ),
          )}
        </div>
      </div>

      {/* Version history bar */}
      <div className="flex items-center justify-between border-t border-zinc-800/40 px-4 py-2">
        <span className="text-[11px] text-zinc-600">
          Version 12 · Auto-saved
        </span>
        <span className="text-[11px] text-zinc-600 hover:text-zinc-400 cursor-pointer">
          View history
        </span>
      </div>
    </div>
  )
}

function AgentMockup() {
  const lines = [
    {
      role: 'user' as const,
      text: 'Build a launch workflow: research competitors, generate hero image + demo video, draft landing copy, then export a one-page PDF brief.',
    },
    {
      role: 'tool' as const,
      text: 'Searching the web for enterprise AI workflow competitors…',
    },
    { role: 'tool' as const, text: 'Reading 14 sources…' },
    {
      role: 'action' as const,
      text: 'Generated report — "AI Workflow Market Snapshot Q2 2026"',
    },
    { role: 'action' as const, text: 'Added Image node — FLUX 1.1 Pro Ultra' },
    { role: 'action' as const, text: 'Added Video node — Kling v2.1' },
    {
      role: 'action' as const,
      text: 'Added Text Editor node — launch copy draft',
    },
    { role: 'action' as const, text: 'Added PDF node — executive brief' },
    {
      role: 'action' as const,
      text: 'Connected Research → Copy → PDF pipeline',
    },
    {
      role: 'agent' as const,
      text: 'Workflow ready. Run generation to produce assets and the final brief.',
    },
  ]

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800/40 bg-zinc-900/40">
      <div className="flex items-center gap-2 border-b border-zinc-800/60 px-4 py-3">
        <Bot size={14} className="text-zinc-400" />
        <span className="text-[12px] font-semibold text-zinc-400">Agent</span>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-[10px] text-zinc-600">Claude Sonnet 4.6</span>
        </div>
      </div>
      <div
        className="space-y-2.5 overflow-y-auto p-4 pr-2"
        style={{ height: 360 }}
      >
        {lines.map((line, i) => {
          if (line.role === 'user') {
            return (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl border border-zinc-700/50 bg-zinc-800 px-4 py-2.5 text-[13px] leading-relaxed text-zinc-200">
                  {line.text}
                </div>
              </div>
            )
          }
          if (line.role === 'action') {
            return (
              <div
                key={i}
                className="flex w-fit max-w-[95%] items-center gap-1.5 rounded-lg border border-zinc-700/50 bg-zinc-800 px-2.5 py-1 text-xs text-zinc-400"
              >
                <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500/70" />
                {line.text}
              </div>
            )
          }
          if (line.role === 'tool') {
            return (
              <div
                key={i}
                className="flex w-fit max-w-[95%] items-center gap-1.5 rounded-lg border border-zinc-700/30 bg-zinc-800/60 px-2.5 py-1 text-xs text-zinc-500"
              >
                <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500/60" />
                {line.text}
              </div>
            )
          }
          return (
            <div key={i} className="flex justify-start">
              <div className="max-w-[90%] rounded-2xl border border-zinc-800 px-4 py-2.5 text-[13px] leading-relaxed text-zinc-300">
                {line.text}
              </div>
            </div>
          )
        })}
      </div>
      <div className="px-4 pb-4">
        <div className="flex items-center gap-2 rounded-xl border border-zinc-800/60 bg-zinc-800/40 px-3.5 py-2.5">
          <span className="flex-1 text-[12px] text-zinc-600">
            Ask the agent anything…
          </span>
          <Send size={14} className="text-zinc-600" />
        </div>
      </div>
    </div>
  )
}

function ResearchMockup() {
  const findings = [
    'Teams choose platforms that unify research, generation, and document output in one workflow [1][2].',
    'Procurement reviews focus on governance controls, permissions, and audit history before raw model variety [3][4].',
    'Operational lift is highest when reports can move directly into editable docs and exportable PDFs [5][6].',
  ]

  const sources = [
    'OpenAI Platform Docs — tools and workflow orchestration',
    'Anthropic Docs — tool use and agent workflows',
    'Google Cloud Vertex AI Docs — governance and enterprise controls',
    'Microsoft Azure AI Docs — security and compliance controls',
    'NIST AI Risk Management Framework (AI RMF 1.0)',
    'OECD AI Policy Observatory — AI governance guidance',
  ]

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800/40 bg-zinc-900/30">
      <div className="flex items-center justify-between border-b border-zinc-800/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <Globe size={13} className="text-zinc-400" />
          <span className="text-[12px] font-semibold text-zinc-400">
            Deep Research Report
          </span>
        </div>
        <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-[10px] font-medium text-zinc-500">
          6 verified sources
        </span>
      </div>
      <div className="space-y-4 p-5">
        <div>
          <h4 className="text-[15px] font-semibold text-zinc-200">
            Decision Brief: Enterprise AI Workflow Platforms
          </h4>
          <p className="mt-2 text-[13px] leading-relaxed text-zinc-500">
            This brief evaluates how enterprise teams compare AI workflow
            platforms for production use. Priority areas are orchestration
            depth, governance controls, and deliverable handoff to documents and
            PDFs.
          </p>
        </div>
        <div className="space-y-2">
          <h5 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
            Key findings
          </h5>
          {findings.map((finding) => (
            <div
              key={finding}
              className="flex items-start gap-2 text-[12px] text-zinc-400"
            >
              <Check size={12} className="mt-0.5 shrink-0 text-zinc-600" />
              {finding}
            </div>
          ))}
        </div>
        <div className="space-y-1.5 border-t border-zinc-800/40 pt-3">
          <h5 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
            Sources
          </h5>
          <div className="space-y-1">
            {sources.map((source, index) => (
              <p key={source} className="text-[11px] text-zinc-500">
                [{index + 1}] {source}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Mockup selector                                                    */
/* ------------------------------------------------------------------ */

function FeatureMockup({ icon }: { icon: FeatureIconKey }) {
  switch (icon) {
    case 'network':
      return (
        <div>
          <CanvasDemo nodes={CANVAS_SCENE} edges={CANVAS_EDGES} height={520} />
          <p className="mt-2 text-center text-[11px] text-zinc-700">
            Live canvas demo with real node interactions
          </p>
        </div>
      )
    case 'type':
      return <TextEditorMockup />
    case 'bot':
      return <AgentMockup />
    case 'globe':
      return <ResearchMockup />
    case 'image':
      return (
        <div>
          <CanvasDemo nodes={MEDIA_SCENE} edges={MEDIA_EDGES} height={520} />
          <p className="mt-2 text-center text-[11px] text-zinc-700">
            Cross-modal media pipeline demo
          </p>
        </div>
      )
    default:
      return null
  }
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

function FeaturePage() {
  const page = Route.useLoaderData()
  const clerk = useClerk()
  const handleSignIn = () => clerk.openSignIn({})

  const Icon = FEATURE_ICONS[page.icon]
  const relatedPages = FEATURE_PAGES.filter(
    (entry) => entry.slug !== page.slug,
  ).slice(0, 3)

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      {/* Nav — same as landing page */}
      <nav className="border-b border-zinc-800/40 bg-[#09090b]/80 backdrop-blur-2xl">
        <div className="mx-auto flex h-14 max-w-[1120px] items-center justify-between px-6">
          <a href="/" className="font-logo text-[22px] text-white">
            Ayles Flow
          </a>
          <div className="flex items-center gap-4">
            <a
              href="/features"
              className="hidden text-[13px] text-zinc-500 transition-colors hover:text-zinc-200 md:block"
            >
              Features
            </a>
            <a
              href="/#agent"
              className="hidden text-[13px] text-zinc-500 transition-colors hover:text-zinc-200 md:block"
            >
              Agent
            </a>
            <a
              href="/#pricing"
              className="hidden text-[13px] text-zinc-500 transition-colors hover:text-zinc-200 md:block"
            >
              Pricing
            </a>
            <button
              type="button"
              onClick={handleSignIn}
              className="cursor-pointer rounded-full bg-white px-4 py-1.5 text-[13px] font-medium text-zinc-950 transition-colors hover:bg-zinc-200"
            >
              Sign in
            </button>
          </div>
        </div>
      </nav>

      <main>
        {/* Hero — copy left, product demo right */}
        <section className="px-6 pb-6 pt-20 sm:pt-28">
          <div className="mx-auto max-w-[1120px]">
            <div className="grid items-start gap-12 lg:grid-cols-2">
              <div className="pt-4">
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/40 px-3.5 py-1.5 text-[12px] font-medium text-zinc-400">
                  <Icon size={13} />
                  {page.heroEyebrow}
                </div>
                <h1 className="mt-5 text-[clamp(2rem,4.5vw,3.2rem)] font-bold leading-[1.08] tracking-[-0.03em] text-white">
                  {page.heroHeadline}
                </h1>
                <p className="mt-5 max-w-[500px] text-[17px] leading-relaxed text-zinc-500">
                  {page.heroSubheadline}
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    onClick={handleSignIn}
                    className="group inline-flex cursor-pointer items-center gap-2 rounded-full bg-white px-7 py-3 text-[14px] font-semibold text-zinc-950 transition-colors hover:bg-zinc-200"
                  >
                    Flow now
                    <ArrowRight
                      size={15}
                      className="transition-transform group-hover:translate-x-0.5"
                    />
                  </button>
                  <a
                    href="/contact"
                    className="inline-flex rounded-full border border-zinc-800 px-7 py-3 text-[14px] text-zinc-500 transition-colors hover:border-zinc-700 hover:text-zinc-300"
                  >
                    Talk to us
                  </a>
                </div>

                {/* Quick stats */}
                <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {page.metrics.map((m) => (
                    <div key={m.label}>
                      <p className="text-[11px] uppercase tracking-wide text-zinc-600">
                        {m.label}
                      </p>
                      <p className="mt-1 text-[15px] font-semibold text-zinc-300">
                        {m.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Product demo */}
              <div>
                <FeatureMockup icon={page.icon} />
              </div>
            </div>
          </div>
        </section>

        {/* Highlights — capabilities grid (matches landing) */}
        <section className="px-6 py-20">
          <div className="mx-auto max-w-[1120px]">
            <p className="mb-3 text-[13px] font-medium text-zinc-600">
              Capabilities
            </p>
            <h2 className="max-w-md text-[clamp(1.75rem,3.5vw,2.5rem)] font-bold leading-[1.15] tracking-[-0.025em] text-white">
              Built for people
              <br />
              who ship.
            </h2>

            <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-zinc-800/60 bg-zinc-800/20 sm:grid-cols-2 lg:grid-cols-4">
              {page.highlights.map((item) => (
                <div
                  key={item.title}
                  className="border-b border-r border-zinc-800/40 bg-[#09090b] p-7 last:border-b-0 sm:[&:nth-child(2n)]:border-r-0 lg:[&:nth-child(2n)]:border-r lg:[&:nth-child(4n)]:border-r-0"
                >
                  <h3 className="mb-2 text-[15px] font-semibold text-zinc-200">
                    {item.title}
                  </h3>
                  <p className="text-[14px] leading-relaxed text-zinc-500">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works — 01/02/03 pattern (matches landing Steps) */}
        <section className="border-y border-zinc-800/40 bg-zinc-950/40 px-6 py-20">
          <div className="mx-auto max-w-[1120px]">
            <p className="mb-3 text-[13px] font-medium text-zinc-600">
              How it works
            </p>
            <h2 className="max-w-md text-[clamp(1.75rem,3.5vw,2.5rem)] font-bold leading-[1.15] tracking-[-0.025em] text-white">
              Three steps.
              <br />
              Zero friction.
            </h2>

            <div className="mt-14 grid gap-5 sm:grid-cols-3">
              {page.workflowSteps.map((step, i) => (
                <div
                  key={step.title}
                  className="flex flex-col rounded-2xl border border-zinc-800/60 bg-zinc-900/20 p-6"
                >
                  <div className="flex items-baseline gap-3">
                    <span className="text-5xl font-bold tabular-nums text-zinc-800/60">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="text-[18px] font-bold text-white">
                      {step.title}
                    </span>
                  </div>
                  <p className="mt-3 text-[14px] leading-relaxed text-zinc-500">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Use cases */}
        <section className="px-6 py-20">
          <div className="mx-auto max-w-[1120px]">
            <p className="mb-3 text-[13px] font-medium text-zinc-600">
              Use cases
            </p>
            <h2 className="max-w-lg text-[clamp(1.75rem,3.5vw,2.5rem)] font-bold tracking-[-0.025em] text-white">
              Where teams get the biggest lift.
            </h2>

            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {page.useCases.map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-zinc-800/60 bg-zinc-900/20 p-6"
                >
                  <h3 className="text-[15px] font-semibold text-zinc-200">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-zinc-500">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-t border-zinc-800/40 bg-zinc-950/40 px-6 py-20">
          <div className="mx-auto max-w-[860px]">
            <h2 className="mb-10 text-center text-2xl font-bold tracking-[-0.02em] text-white">
              FAQ
            </h2>
            <div className="divide-y divide-zinc-800/50">
              {page.faqs.map((faq) => (
                <div key={faq.question} className="py-5">
                  <h3 className="text-[15px] font-semibold text-zinc-200">
                    {faq.question}
                  </h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-zinc-500">
                    {faq.answer}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Related features */}
        <section className="px-6 py-20">
          <div className="mx-auto max-w-[1120px]">
            <div className="mb-9 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="mb-3 text-[13px] font-medium text-zinc-600">
                  More features
                </p>
                <h2 className="text-2xl font-bold tracking-[-0.02em] text-white">
                  Explore the rest of the stack
                </h2>
              </div>
              <a
                href="/features"
                className="inline-flex rounded-full border border-zinc-800 px-5 py-2.5 text-[14px] text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200"
              >
                See all features
              </a>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {relatedPages.map((related) => {
                const RelIcon = FEATURE_ICONS[related.icon]
                return (
                  <a
                    key={related.slug}
                    href={getFeaturePagePath(related.slug)}
                    className="group rounded-2xl border border-zinc-800/60 bg-zinc-900/20 p-5 transition-colors hover:border-zinc-700/60 hover:bg-zinc-900/40"
                  >
                    <div className="mb-3 flex items-center gap-2">
                      <RelIcon
                        size={14}
                        className="text-zinc-600"
                        strokeWidth={1.5}
                      />
                      <h3 className="text-[15px] font-semibold text-zinc-100 transition-colors group-hover:text-white">
                        {related.title}
                      </h3>
                    </div>
                    <p className="text-[14px] leading-relaxed text-zinc-500">
                      {related.summary}
                    </p>
                  </a>
                )
              })}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-6 pb-24">
          <div className="mx-auto max-w-xl text-center">
            <h2 className="text-[clamp(1.75rem,4vw,2.75rem)] font-bold tracking-[-0.025em] text-white">
              Ready to ship faster?
            </h2>
            <p className="mx-auto mt-4 max-w-sm text-[16px] text-zinc-500">
              Go from idea to production in minutes. Free, no credit card.
            </p>
            <button
              type="button"
              onClick={handleSignIn}
              className="group mt-10 inline-flex cursor-pointer items-center gap-2 rounded-full bg-white px-8 py-3.5 text-[14px] font-semibold text-zinc-950 transition-colors hover:bg-zinc-200"
            >
              Flow now
              <ArrowRight
                size={15}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </button>
          </div>
        </section>
      </main>

      <Footer onSignIn={handleSignIn} />
    </div>
  )
}
