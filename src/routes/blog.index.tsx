import { useClerk } from '@clerk/tanstack-react-start'
import { createFileRoute } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'

import BlogCoverImage from '@/components/BlogCoverImage'
import Footer from '@/components/Footer'
import { BLOG_POSTS, getBlogPostPath } from '@/data/blog'
import {
  buildBreadcrumbSchema,
  buildCollectionPageSchema,
  buildSeoHead,
} from '@/utils/seo'

const BLOG_TITLE = 'Ayles Flow Blog | AI Workflow Guides for Creative Teams'
const BLOG_DESCRIPTION =
  'Practical guides for teams building connected AI workflows across research, text, image, video, and final delivery.'

export const Route = createFileRoute('/blog/')({
  head: () =>
    buildSeoHead({
      title: BLOG_TITLE,
      description: BLOG_DESCRIPTION,
      path: '/blog',
      schema: [
        buildCollectionPageSchema({
          title: BLOG_TITLE,
          description: BLOG_DESCRIPTION,
          path: '/blog',
          items: BLOG_POSTS.map((post) => ({
            name: post.title,
            path: getBlogPostPath(post.slug),
          })),
        }),
        buildBreadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Blog', path: '/blog' },
        ]),
      ],
    }),
  component: BlogIndexPage,
})

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function BlogIndexPage() {
  const clerk = useClerk()
  const handleSignIn = () => clerk.openSignIn({})

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      {/* Nav */}
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
              href="/blog"
              className="hidden text-[13px] font-medium text-zinc-200 transition-colors hover:text-white md:block"
            >
              Blog
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
        {/* Header */}
        <section className="px-6 pb-4 pt-20 sm:pt-28">
          <div className="mx-auto max-w-[1120px]">
            <h1 className="text-[clamp(2.5rem,5vw,4rem)] font-bold leading-[1.05] tracking-[-0.04em] text-white">
              Blog
            </h1>
            <p className="mt-4 max-w-lg text-[17px] leading-relaxed text-zinc-500">
              Workflow design, media pipelines, and how to turn isolated AI
              steps into reusable production systems.
            </p>
          </div>
        </section>

        {/* Grid */}
        {BLOG_POSTS.length > 0 ? (
          <section className="px-6 pb-20 pt-10">
            <div className="mx-auto max-w-[1120px]">
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {BLOG_POSTS.map((post) => (
                  <a
                    key={post.slug}
                    href={getBlogPostPath(post.slug)}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-800/50 transition-colors hover:border-zinc-700/60"
                  >
                    <BlogCoverImage
                      src={post.image}
                      alt={post.imageAlt}
                      className="h-[200px] border-b border-zinc-200/80"
                      paddingClassName="p-0"
                    />
                    {/* Card body */}
                    <div className="flex flex-1 flex-col bg-zinc-950/60 p-5">
                      <span className="mb-3 inline-flex w-fit rounded-full bg-white/8 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-300">
                        {post.category}
                      </span>
                      <h3 className="text-[17px] font-semibold leading-snug tracking-[-0.01em] text-zinc-100 transition-colors group-hover:text-white">
                        {post.title}
                      </h3>
                      <p className="mt-2 flex-1 text-[14px] leading-relaxed text-zinc-500">
                        {post.excerpt}
                      </p>
                      <div className="mt-4 flex items-center justify-between">
                        <span className="text-[12px] text-zinc-600">
                          {formatDate(post.publishedAt)}
                        </span>
                        <span className="inline-flex items-center gap-2 text-[12px] text-zinc-600 transition-colors group-hover:text-zinc-300">
                          {post.readingTimeMinutes} min read
                          <ArrowRight
                            size={13}
                            className="transition-transform group-hover:translate-x-0.5"
                          />
                        </span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {/* CTA */}
        <section className="px-6 pb-24 pt-10">
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
