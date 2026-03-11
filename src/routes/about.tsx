import { createFileRoute, Link } from '@tanstack/react-router'

import StaticPageLayout from '@/components/StaticPageLayout'
import {
  buildBreadcrumbSchema,
  buildSeoHead,
  buildWebPageSchema,
} from '@/utils/seo'

const ABOUT_TITLE = 'About Ayles Flow | Visual AI Workflow Platform'
const ABOUT_DESCRIPTION =
  'Learn what Ayles Flow is building: a visual AI workflow platform for multimodal production, agent automation, deep research, and PDF deliverables.'

export const Route = createFileRoute('/about')({
  head: () =>
    buildSeoHead({
      title: ABOUT_TITLE,
      description: ABOUT_DESCRIPTION,
      path: '/about',
      schema: [
        buildWebPageSchema({
          title: ABOUT_TITLE,
          description: ABOUT_DESCRIPTION,
          path: '/about',
        }),
        buildBreadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'About', path: '/about' },
        ]),
      ],
    }),
  component: About,
})

function About() {
  return (
    <StaticPageLayout title="About Ayles Flow">
      <p className="text-[17px] text-zinc-300 leading-relaxed">
        Ayles Flow is an AI production studio built for creators, teams, and
        anyone who wants to go from idea to production without friction.
      </p>

      <section>
        <h2 className="text-xl font-semibold text-zinc-200 mb-3">
          The Problem
        </h2>
        <p>
          AI models are powerful but fragmented. You need one tool for images,
          another for video, another for audio. Connecting outputs between them
          means copying files, switching tabs, and losing context. For teams, it
          gets worse — no shared workspace, no reusable workflows, no visibility
          into what was tried before.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-200 mb-3">
          Our Solution
        </h2>
        <p>
          Ayles Flow puts every AI model on a single visual canvas. You create
          nodes, connect them into pipelines, and generate. One model&apos;s
          output feeds the next — image to video, text to audio, prompt to PDF.
          The AI agent can build entire workflows from a single message, run
          deep research, and generate documents.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-200 mb-3">
          What We Believe
        </h2>
        <ul className="space-y-3">
          <li>
            <span className="text-zinc-200 font-medium">Speed matters.</span>{' '}
            Going from idea to output should take minutes, not hours.
          </li>
          <li>
            <span className="text-zinc-200 font-medium">
              Tools should be visual.
            </span>{' '}
            Complex workflows are easier to build when you can see them.
          </li>
          <li>
            <span className="text-zinc-200 font-medium">
              AI should do the wiring.
            </span>{' '}
            The agent handles the tedious parts so you can focus on the creative
            work.
          </li>
          <li>
            <span className="text-zinc-200 font-medium">
              One workspace, every model.
            </span>{' '}
            You shouldn&apos;t have to choose between providers — use the best
            model for each task.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-200 mb-3">
          Models We Support
        </h2>
        <p>
          We integrate with leading AI providers including Quasar, Google
          (Imagen 4, Lyria 2), Black Forest Labs (FLUX), OpenAI (GPT Image),
          Kling (Video), MiniMax (Video, Music), ElevenLabs (Speech), Stability
          AI, and more. New models are added regularly.
        </p>
      </section>

      <div className="pt-4">
        <Link
          to="/features"
          className="inline-flex rounded-full bg-white px-6 py-2.5 text-[14px] font-semibold text-zinc-950 transition-opacity hover:opacity-85"
        >
          Explore the feature pages
        </Link>
      </div>
    </StaticPageLayout>
  )
}
