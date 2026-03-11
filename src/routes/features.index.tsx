import { useClerk } from '@clerk/tanstack-react-start'
import { createFileRoute } from '@tanstack/react-router'
import { ArrowRight, Bot, Globe, Image, Network, Type } from 'lucide-react'

import Footer from '@/components/Footer'
import { FEATURE_PAGES, getFeaturePagePath } from '@/data/featurePages'
import {
  buildBreadcrumbSchema,
  buildCollectionPageSchema,
  buildSeoHead,
} from '@/utils/seo'

const FEATURES_TITLE = 'Ayles Flow Features | AI Workflows, Research, and PDFs'
const FEATURES_DESCRIPTION =
  'Explore Ayles Flow features for AI workflow building, agent automation, deep research, PDF generation, and multimodal production.'

const FEATURE_ICONS = {
  network: Network,
  bot: Bot,
  globe: Globe,
  type: Type,
  image: Image,
} as const

export const Route = createFileRoute('/features/')({
  head: () =>
    buildSeoHead({
      title: FEATURES_TITLE,
      description: FEATURES_DESCRIPTION,
      path: '/features',
      schema: [
        buildCollectionPageSchema({
          title: FEATURES_TITLE,
          description: FEATURES_DESCRIPTION,
          path: '/features',
          items: FEATURE_PAGES.map((page) => ({
            name: page.title,
            path: getFeaturePagePath(page.slug),
          })),
        }),
        buildBreadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Features', path: '/features' },
        ]),
      ],
    }),
  component: FeaturesPage,
})

function FeaturesPage() {
  const clerk = useClerk()
  const handleSignIn = () => clerk.openSignIn({})

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      {/* Nav — matches landing page */}
      <nav className="border-b border-zinc-800/40 bg-[#09090b]/80 backdrop-blur-2xl">
        <div className="mx-auto flex h-14 max-w-[1120px] items-center justify-between px-6">
          <a href="/" className="font-logo text-[22px] text-white">
            Ayles Flow
          </a>
          <div className="flex items-center gap-4">
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

      {/* Hero */}
      <section className="px-6 pb-6 pt-24 sm:pt-32">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-5 text-[13px] font-medium text-zinc-600">
            Platform
          </p>
          <h1 className="font-logo text-[clamp(2.5rem,6vw,4.5rem)] leading-[1.05] tracking-[-0.02em] text-white italic">
            Everything ships from one canvas.
          </h1>
          <p className="mx-auto mt-6 max-w-lg text-[17px] leading-relaxed text-zinc-500">
            Image, video, audio, music, text, research, and PDF — connected into
            real pipelines. Let the AI agent build it for you.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
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
              href="/#agent"
              className="inline-flex cursor-pointer rounded-full border border-zinc-800 px-7 py-3 text-[14px] text-zinc-500 transition-colors hover:border-zinc-700 hover:text-zinc-300"
            >
              See the agent
            </a>
          </div>
        </div>
      </section>

      {/* Feature cards */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-[1040px]">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURE_PAGES.map((page) => {
              const Icon = FEATURE_ICONS[page.icon]

              return (
                <a
                  key={page.slug}
                  href={getFeaturePagePath(page.slug)}
                  className="group flex flex-col rounded-2xl border border-zinc-800/60 bg-zinc-900/20 p-6 transition-colors hover:border-zinc-700/60 hover:bg-zinc-900/40"
                >
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950">
                    <Icon size={18} className="text-zinc-500" />
                  </div>
                  <h2 className="text-[17px] font-semibold text-zinc-100 transition-colors group-hover:text-white">
                    {page.title}
                  </h2>
                  <p className="mt-2 flex-1 text-[14px] leading-relaxed text-zinc-500">
                    {page.summary}
                  </p>
                  <div className="mt-5 flex items-center gap-1.5 text-[13px] font-medium text-zinc-500 transition-colors group-hover:text-zinc-300">
                    Learn more
                    <ArrowRight
                      size={13}
                      className="transition-transform group-hover:translate-x-0.5"
                    />
                  </div>
                </a>
              )
            })}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="px-6 py-20">
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

      <Footer onSignIn={handleSignIn} />
    </div>
  )
}
