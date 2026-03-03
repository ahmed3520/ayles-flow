import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'

import Footer from '@/components/Footer'

export default function StaticPageLayout({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <nav className="border-b border-zinc-800/40">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-6">
          <Link
            to="/"
            className="font-logo text-[19px] text-white"
          >
            Ayles Flow
          </Link>
          <Link
            to="/"
            className="flex items-center gap-1.5 text-[13px] text-zinc-500 transition-colors hover:text-zinc-200"
          >
            <ArrowLeft size={14} />
            Back
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-bold tracking-[-0.02em] mb-10">
          {title}
        </h1>
        <div className="prose-landing space-y-6 text-[15px] leading-relaxed text-zinc-400">
          {children}
        </div>
      </main>

      <Footer />
    </div>
  )
}
