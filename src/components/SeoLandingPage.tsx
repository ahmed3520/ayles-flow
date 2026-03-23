import { useClerk } from '@clerk/tanstack-react-start'
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  ArrowRight,
  Check,
  Sparkles,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import type { Edge, Node } from '@xyflow/react'
import type { BlockNodeData } from '@/types/nodes'
import BlockNodeComponent from '@/components/canvas/nodes/BlockNode'
import Footer from '@/components/Footer'
import {
  SEO_PAGES,
  getSeoPageBySlug,
  getSeoPagePath,
  type SeoPage,
} from '@/data/seoPages'
import { NODE_DEFAULTS } from '@/types/nodes'

/* ------------------------------------------------------------------ */
/*  Fade-in hook (matches main landing page)                           */
/* ------------------------------------------------------------------ */

function useFadeIn<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.15 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return { ref, className: `transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}` }
}

/* ------------------------------------------------------------------ */
/*  Canvas demo — real BlockNode components                            */
/* ------------------------------------------------------------------ */

const nodeTypes = { blockNode: BlockNodeComponent }

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

const HERO_NODES: Node<BlockNodeData>[] = [
  {
    id: 'note-1',
    type: 'blockNode',
    position: { x: 0, y: 40 },
    style: nodeStyle('note', { width: 260, height: 200 }),
    data: {
      contentType: 'note',
      label: 'Creative Brief',
      prompt:
        '<p>Campaign direction and key deliverables for cross-team workflow.</p>',
      model: '',
      generationStatus: 'completed',
      outputType: 'text',
      noteColor: 'blue',
    },
  },
  {
    id: 'image-1',
    type: 'blockNode',
    position: { x: 310, y: 0 },
    style: nodeStyle('image', { width: 280, height: 220 }),
    data: {
      contentType: 'image',
      label: 'Hero Visual',
      prompt:
        'Premium product visual, dark gradient, clean editorial framing',
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
    position: { x: 310, y: 260 },
    style: nodeStyle('video', { width: 280, height: 200 }),
    data: {
      contentType: 'video',
      label: 'Demo Cut',
      prompt: 'Short product reveal from hero image, cinematic camera move',
      model: 'Kling Video v2.1',
      generationStatus: 'generating',
      outputType: 'video',
    },
  },
  {
    id: 'text-1',
    type: 'blockNode',
    position: { x: 0, y: 280 },
    style: nodeStyle('text', { width: 260, height: 170 }),
    data: {
      contentType: 'text',
      label: 'Landing Copy',
      prompt: 'Write concise launch copy for the campaign page',
      model: 'Claude Sonnet 4.6',
      generationStatus: 'completed',
      outputType: 'text',
      resultText:
        'Ship multimodal AI workflows from one visual canvas — faster, together.',
    },
  },
]

const HERO_EDGES: Edge[] = [
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

function CanvasDemo({ height = 480 }: { height?: number }) {
  return (
    <div
      className="overflow-hidden rounded-2xl border border-zinc-800/40 shadow-[0_0_120px_rgba(99,102,241,0.06)] transform-gpu"
      style={{ height }}
    >
      <ReactFlowProvider>
        <ReactFlow
          nodes={HERO_NODES}
          edges={HERO_EDGES}
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
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function SeoLandingPage({ page }: { page: SeoPage }) {
  const clerk = useClerk()
  const handleSignIn = () => clerk.openSignIn({})
  const relatedPages = page.relatedSlugs
    .map((slug) => getSeoPageBySlug(slug))
    .filter((entry): entry is SeoPage => Boolean(entry))

  const fadeHero = useFadeIn<HTMLDivElement>()
  const fadeCapabilities = useFadeIn<HTMLDivElement>()
  const fadeSteps = useFadeIn<HTMLDivElement>()
  const fadeDifferentiators = useFadeIn<HTMLDivElement>()
  const fadeProof = useFadeIn<HTMLDivElement>()
  const fadeComparison = useFadeIn<HTMLDivElement>()
  const fadeUseCases = useFadeIn<HTMLDivElement>()
  const fadeFaq = useFadeIn<HTMLDivElement>()
  const fadeRelated = useFadeIn<HTMLDivElement>()
  const fadeCta = useFadeIn<HTMLDivElement>()

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      {/* Nav — matches feature pages */}
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
              href="/ai-workflow-builder"
              className="hidden text-[13px] text-zinc-500 transition-colors hover:text-zinc-200 md:block"
            >
              Workflow Builder
            </a>
            <a
              href="/image-to-video-workflow"
              className="hidden text-[13px] text-zinc-500 transition-colors hover:text-zinc-200 md:block"
            >
              Image to Video
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
        {/* Hero — copy left, live canvas demo right */}
        <section className="px-6 pb-6 pt-20 sm:pt-28">
          <div
            ref={fadeHero.ref}
            className={`mx-auto max-w-[1120px] ${fadeHero.className}`}
          >
            <div className="grid items-start gap-12 lg:grid-cols-2">
              <div className="pt-4">
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/40 px-3.5 py-1.5 text-[12px] font-medium text-zinc-400">
                  <Sparkles size={13} />
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
                    {page.ctaLabel}
                    <ArrowRight
                      size={15}
                      className="transition-transform group-hover:translate-x-0.5"
                    />
                  </button>
                  <a
                    href="/features"
                    className="inline-flex rounded-full border border-zinc-800 px-7 py-3 text-[14px] text-zinc-500 transition-colors hover:border-zinc-700 hover:text-zinc-300"
                  >
                    Explore features
                  </a>
                </div>
                <p className="mt-4 text-[13px] leading-relaxed text-zinc-600">
                  {page.ctaNote}
                </p>

                {/* Quick stats */}
                <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {page.heroStats.map((stat) => (
                    <div key={stat.label}>
                      <p className="text-[11px] uppercase tracking-wide text-zinc-600">
                        {stat.label}
                      </p>
                      <p className="mt-1 text-[15px] font-semibold text-zinc-300">
                        {stat.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Live canvas demo */}
              <div>
                <CanvasDemo height={480} />
                <p className="mt-2 text-center text-[11px] text-zinc-700">
                  Interactive canvas — drag nodes to explore
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Capabilities — 4-col border grid (matches feature pages) */}
        <section className="px-6 py-20">
          <div
            ref={fadeCapabilities.ref}
            className={`mx-auto max-w-[1120px] ${fadeCapabilities.className}`}
          >
            <p className="mb-3 text-[13px] font-medium text-zinc-600">
              Why it matters
            </p>
            <h2 className="max-w-md text-[clamp(1.75rem,3.5vw,2.5rem)] font-bold leading-[1.15] tracking-[-0.025em] text-white">
              {page.whyTitle}
            </h2>
            {page.whyBody ? (
              <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-zinc-500">
                {page.whyBody}
              </p>
            ) : null}

            <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-zinc-800/60 bg-zinc-800/20 sm:grid-cols-2">
              {page.whyPoints.map((point) => (
                <div
                  key={point}
                  className="border-b border-r border-zinc-800/40 bg-[#09090b] p-7 last:border-b-0 sm:[&:nth-child(2n)]:border-r-0"
                >
                  <div className="flex items-start gap-3">
                    <Check
                      size={16}
                      className="mt-0.5 shrink-0 text-emerald-400"
                    />
                    <p className="text-[15px] leading-relaxed text-zinc-300">
                      {point}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works — numbered steps (matches feature pages) */}
        <section className="border-y border-zinc-800/40 bg-zinc-950/40 px-6 py-20">
          <div
            ref={fadeSteps.ref}
            className={`mx-auto max-w-[1120px] ${fadeSteps.className}`}
          >
            <p className="mb-3 text-[13px] font-medium text-zinc-600">
              Workflow
            </p>
            <h2 className="max-w-md text-[clamp(1.75rem,3.5vw,2.5rem)] font-bold leading-[1.15] tracking-[-0.025em] text-white">
              {page.workflow.title}
            </h2>
            <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-zinc-500">
              {page.workflow.overview}
            </p>

            <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: 'Inputs', items: page.workflow.inputs },
                { label: 'Flow', items: page.workflow.steps },
                { label: 'Outputs', items: page.workflow.outputs },
                { label: 'Models', items: page.workflow.models },
              ].map((col, i) => (
                <div
                  key={col.label}
                  className="flex flex-col rounded-2xl border border-zinc-800/60 bg-zinc-900/20 p-6"
                >
                  <div className="flex items-baseline gap-3">
                    <span className="text-4xl font-bold tabular-nums text-zinc-800/60">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="text-[16px] font-bold text-white">
                      {col.label}
                    </span>
                  </div>
                  <ul className="mt-4 space-y-2">
                    {col.items.map((item) => (
                      <li key={item} className="flex items-start gap-2.5">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400/70" />
                        <span className="text-[14px] leading-relaxed text-zinc-400">
                          {item}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Differentiators — feature grid (matches feature pages highlights) */}
        <section className="px-6 py-20">
          <div
            ref={fadeDifferentiators.ref}
            className={`mx-auto max-w-[1120px] ${fadeDifferentiators.className}`}
          >
            <p className="mb-3 text-[13px] font-medium text-zinc-600">
              Why Ayles
            </p>
            <h2 className="max-w-lg text-[clamp(1.75rem,3.5vw,2.5rem)] font-bold leading-[1.15] tracking-[-0.025em] text-white">
              Built for creative teams
              <br />
              who ship.
            </h2>

            <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-zinc-800/60 bg-zinc-800/20 sm:grid-cols-2 lg:grid-cols-4">
              {page.differentiators.map((card) => (
                <div
                  key={card.title}
                  className="border-b border-r border-zinc-800/40 bg-[#09090b] p-7 last:border-b-0 sm:[&:nth-child(2n)]:border-r-0 lg:[&:nth-child(2n)]:border-r lg:[&:nth-child(4n)]:border-r-0"
                >
                  <h3 className="mb-2 text-[15px] font-semibold text-zinc-200">
                    {card.title}
                  </h3>
                  <p className="text-[14px] leading-relaxed text-zinc-500">
                    {card.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Proof — cards with icons */}
        <section className="border-y border-zinc-800/40 bg-zinc-950/40 px-6 py-20">
          <div
            ref={fadeProof.ref}
            className={`mx-auto max-w-[1120px] ${fadeProof.className}`}
          >
            <p className="mb-3 text-[13px] font-medium text-zinc-600">
              Proof
            </p>
            <h2 className="max-w-lg text-[clamp(1.75rem,3.5vw,2.5rem)] font-bold tracking-[-0.025em] text-white">
              {page.proofTitle}
            </h2>
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {page.proofCards.map((card) => (
                <div
                  key={card.title}
                  className="rounded-2xl border border-zinc-800/60 bg-zinc-900/20 p-6"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900">
                    <Sparkles size={16} className="text-zinc-400" />
                  </div>
                  <h3 className="mt-5 text-[15px] font-semibold text-zinc-200">
                    {card.title}
                  </h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-zinc-500">
                    {card.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Comparison table */}
        {page.comparison ? (
          <section className="px-6 py-20">
            <div
              ref={fadeComparison.ref}
              className={`mx-auto max-w-[1120px] ${fadeComparison.className}`}
            >
              <p className="mb-3 text-[13px] font-medium text-zinc-600">
                Comparison
              </p>
              <h2 className="max-w-lg text-[clamp(1.75rem,3.5vw,2.5rem)] font-bold tracking-[-0.025em] text-white">
                {page.title} vs {page.comparison.competitorName}
              </h2>
              <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-zinc-500">
                {page.comparison.intro}
              </p>

              <div className="mt-12 overflow-hidden rounded-2xl border border-zinc-800/60">
                <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1fr)] border-b border-zinc-800/60 bg-zinc-950/90">
                  <div className="px-5 py-4 text-[12px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
                    Dimension
                  </div>
                  <div className="px-5 py-4 text-[12px] font-semibold uppercase tracking-[0.18em] text-zinc-300">
                    Ayles Flow
                  </div>
                  <div className="px-5 py-4 text-[12px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    {page.comparison.competitorName}
                  </div>
                </div>
                {page.comparison.rows.map((row) => (
                  <div
                    key={row.label}
                    className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1fr)] border-t border-zinc-800/40 bg-zinc-900/20"
                  >
                    <div className="px-5 py-5 text-[14px] font-semibold text-zinc-200">
                      {row.label}
                    </div>
                    <div className="px-5 py-5 text-[14px] leading-relaxed text-zinc-300">
                      {row.ayles}
                    </div>
                    <div className="px-5 py-5 text-[14px] leading-relaxed text-zinc-500">
                      {row.competitor}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-6 max-w-4xl text-[15px] leading-relaxed text-zinc-500">
                {page.comparison.recommendation}
              </p>
            </div>
          </section>
        ) : null}

        {/* Use cases */}
        <section className={`px-6 py-20 ${page.comparison ? 'border-t border-zinc-800/40 bg-zinc-950/40' : ''}`}>
          <div
            ref={fadeUseCases.ref}
            className={`mx-auto max-w-[1120px] ${fadeUseCases.className}`}
          >
            <p className="mb-3 text-[13px] font-medium text-zinc-600">
              Use cases
            </p>
            <h2 className="max-w-lg text-[clamp(1.75rem,3.5vw,2.5rem)] font-bold tracking-[-0.025em] text-white">
              Where teams get the biggest lift.
            </h2>

            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {page.useCases.map((useCase) => (
                <div
                  key={useCase.title}
                  className="rounded-2xl border border-zinc-800/60 bg-zinc-900/20 p-6"
                >
                  <h3 className="text-[15px] font-semibold text-zinc-200">
                    {useCase.title}
                  </h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-zinc-500">
                    {useCase.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-t border-zinc-800/40 bg-zinc-950/40 px-6 py-20">
          <div
            ref={fadeFaq.ref}
            className={`mx-auto max-w-[860px] ${fadeFaq.className}`}
          >
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

        {/* Related pages */}
        <section className="px-6 py-20">
          <div
            ref={fadeRelated.ref}
            className={`mx-auto max-w-[1120px] ${fadeRelated.className}`}
          >
            <div className="mb-9 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="mb-3 text-[13px] font-medium text-zinc-600">
                  Keep exploring
                </p>
                <h2 className="text-2xl font-bold tracking-[-0.02em] text-white">
                  Related workflow pages
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
              {relatedPages.map((related) => (
                <a
                  key={related.slug}
                  href={getSeoPagePath(related.slug)}
                  className="group rounded-2xl border border-zinc-800/60 bg-zinc-900/20 p-5 transition-colors hover:border-zinc-700/60 hover:bg-zinc-900/40"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
                    {related.heroEyebrow}
                  </p>
                  <h3 className="mt-3 text-[15px] font-semibold text-zinc-100 transition-colors group-hover:text-white">
                    {related.title}
                  </h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-zinc-500">
                    {related.description}
                  </p>
                  <div className="mt-4 inline-flex items-center gap-2 text-[13px] font-medium text-zinc-400 transition-colors group-hover:text-zinc-200">
                    View page
                    <ArrowRight size={14} />
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-6 pb-24">
          <div
            ref={fadeCta.ref}
            className={`mx-auto max-w-xl text-center ${fadeCta.className}`}
          >
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
              {page.ctaLabel}
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

export function getFeaturedSeoPages() {
  return SEO_PAGES.slice(0, 4)
}
