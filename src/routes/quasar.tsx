import { createFileRoute } from '@tanstack/react-router'

import StaticPageLayout from '@/components/StaticPageLayout'

export const Route = createFileRoute('/quasar')({ component: Quasar })

function Quasar() {
  return (
    <StaticPageLayout title="Ayles Flow × Quasar">
      <p className="text-[17px] text-zinc-300 leading-relaxed">
        We believe the future of AI workflows depends on context.
      </p>

      <section>
        <h2 className="text-xl font-semibold text-zinc-200 mb-3">
          The Problem
        </h2>
        <p>
          While working with frontier AI systems, we repeatedly hit the same
          limitation: context windows. Even the most advanced models break down
          when projects grow large. Long workflows lose memory. Systems lose
          coherence. Real production becomes fragile.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-200 mb-3">
          That&apos;s where Quasar changes everything.
        </h2>
        <p>
          The Quasar series of models is built to handle massive, persistent
          context. With support for up to 20 million tokens, Quasar can process
          and reason over entire systems — not just short conversations — while
          maintaining performance and stability.
        </p>
        <p className="mt-4">
          This makes Quasar fundamentally different.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-200 mb-3">
          Why We Partnered
        </h2>
        <p>
          At Ayles, we&apos;ve supported Quasar since day one because it aligns
          with how we think about building AI: long-lived, structured, and
          production-ready. Canvas-based work demands models that can see the
          whole picture, not just the last few messages.
        </p>
        <p className="mt-4">
          That&apos;s why we partnered with SILX AI Inc. to bring an exclusive
          version of Quasar to Ayles.
        </p>
      </section>
    </StaticPageLayout>
  )
}
