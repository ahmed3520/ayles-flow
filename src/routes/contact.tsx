import { createFileRoute } from '@tanstack/react-router'
import { Mail, MessageSquare } from 'lucide-react'

import StaticPageLayout from '@/components/StaticPageLayout'

export const Route = createFileRoute('/contact')({ component: Contact })

function Contact() {
  return (
    <StaticPageLayout title="Contact Us">
      <p>
        Have a question, feedback, or need help? Reach out through any of the
        channels below.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 pt-2">
        <a
          href="mailto:hello@aylesflow.com"
          className="flex items-start gap-4 rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-5 transition-colors hover:border-zinc-700/60"
        >
          <Mail size={20} className="text-zinc-500 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-[15px] font-semibold text-zinc-200 mb-1">
              Email
            </h3>
            <p className="text-[13px] text-zinc-500">
              hello@aylesflow.com
            </p>
            <p className="text-[12px] text-zinc-600 mt-1">
              We typically respond within 24 hours.
            </p>
          </div>
        </a>

        <a
          href="https://x.com/aylesflow"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-4 rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-5 transition-colors hover:border-zinc-700/60"
        >
          <MessageSquare size={20} className="text-zinc-500 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-[15px] font-semibold text-zinc-200 mb-1">
              X (Twitter)
            </h3>
            <p className="text-[13px] text-zinc-500">@aylesflow</p>
            <p className="text-[12px] text-zinc-600 mt-1">
              DMs open for quick questions.
            </p>
          </div>
        </a>
      </div>

      <section className="pt-4">
        <h2 className="text-xl font-semibold text-zinc-200 mb-3">
          Report a Bug
        </h2>
        <p>
          Found something broken? Email us at{' '}
          <a
            href="mailto:support@aylesflow.com"
            className="text-zinc-200 underline underline-offset-2 hover:text-white"
          >
            support@aylesflow.com
          </a>{' '}
          with a description of the issue and steps to reproduce it. Screenshots
          or screen recordings help a lot.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-200 mb-3">
          Enterprise
        </h2>
        <p>
          Need custom integrations, higher limits, or a dedicated instance?
          Reach out to{' '}
          <a
            href="mailto:enterprise@aylesflow.com"
            className="text-zinc-200 underline underline-offset-2 hover:text-white"
          >
            enterprise@aylesflow.com
          </a>{' '}
          and we&apos;ll set up a call.
        </p>
      </section>
    </StaticPageLayout>
  )
}
