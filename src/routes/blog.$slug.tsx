import { useClerk } from '@clerk/tanstack-react-start'
import { createFileRoute, notFound } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight } from 'lucide-react'

import BlogCoverImage from '@/components/BlogCoverImage'
import Footer from '@/components/Footer'
import { BLOG_POSTS, getBlogPostBySlug, getBlogPostPath } from '@/data/blog'
import {
  buildArticleSchema,
  buildBreadcrumbSchema,
  buildSeoHead,
  buildWebPageSchema,
} from '@/utils/seo'

export const Route = createFileRoute('/blog/$slug')({
  loader: ({ params }) => {
    const post = getBlogPostBySlug(params.slug)
    if (!post) throw notFound()
    return post
  },
  head: ({ loaderData, params }) => {
    const post = loaderData ?? getBlogPostBySlug(params.slug)
    if (!post) {
      return buildSeoHead({
        title: 'Blog | Ayles Flow',
        description: 'Ayles Flow blog.',
        path: '/blog',
      })
    }

    return buildSeoHead({
      title: `${post.title} | Ayles Flow`,
      description: post.description,
      path: getBlogPostPath(post.slug),
      imagePath: post.image,
      imageAlt: post.imageAlt,
      schema: [
        buildWebPageSchema({
          title: post.title,
          description: post.description,
          path: getBlogPostPath(post.slug),
          type: 'Article',
        }),
        buildArticleSchema({
          title: post.title,
          description: post.description,
          path: getBlogPostPath(post.slug),
          publishedAt: post.publishedAt,
          author: post.author,
          imagePath: post.image,
        }),
        buildBreadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Blog', path: '/blog' },
          { name: post.title, path: getBlogPostPath(post.slug) },
        ]),
      ],
    })
  },
  component: BlogPostPage,
})

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function BlogPostPage() {
  const post = Route.useLoaderData()
  const clerk = useClerk()
  const handleSignIn = () => clerk.openSignIn({})

  const relatedPosts = BLOG_POSTS.filter(
    (entry) => entry.slug !== post.slug,
  ).slice(0, 3)

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
              href="/blog"
              className="inline-flex items-center gap-2 text-[13px] text-zinc-400 transition-colors hover:text-zinc-200"
            >
              <ArrowLeft size={14} />
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
        {/* Hero image */}
        <section className="px-6 pt-10 sm:pt-14">
          <div className="mx-auto max-w-[860px]">
            <BlogCoverImage
              src={post.image}
              alt={post.imageAlt}
              className="h-[280px] rounded-[2rem] border border-zinc-200/80 shadow-[0_20px_60px_rgba(0,0,0,0.35)] sm:h-[460px]"
              paddingClassName="p-0"
            />
          </div>
        </section>

        {/* Title + meta */}
        <section className="px-6 pt-10">
          <div className="mx-auto max-w-[760px]">
            <span className="inline-flex rounded-full bg-white/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-300">
              {post.category}
            </span>
            <h1 className="mt-4 text-[clamp(2rem,5vw,3.25rem)] font-bold leading-[1.08] tracking-[-0.03em] text-white">
              {post.title}
            </h1>
            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-zinc-500">
              <span>{post.author}</span>
              <span className="h-1 w-1 rounded-full bg-zinc-700" />
              <span>{formatDate(post.publishedAt)}</span>
              <span className="h-1 w-1 rounded-full bg-zinc-700" />
              <span>{post.readingTimeMinutes} min read</span>
            </div>
          </div>
        </section>

        {/* Article body */}
        <article className="px-6 pb-20 pt-8">
          <div className="mx-auto max-w-[760px]">
            <div
              className="blog-prose"
              dangerouslySetInnerHTML={{ __html: post.html }}
            />
          </div>
        </article>

        {/* Related posts */}
        {relatedPosts.length > 0 ? (
          <section className="border-t border-zinc-800/40 px-6 py-20">
            <div className="mx-auto max-w-[1120px]">
              <div className="mb-10 flex items-end justify-between">
                <h2 className="text-2xl font-bold tracking-[-0.02em] text-white">
                  More from the blog
                </h2>
                <a
                  href="/blog"
                  className="text-[13px] font-medium text-zinc-400 transition-colors hover:text-white"
                >
                  All posts
                </a>
              </div>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {relatedPosts.map((entry) => (
                  <a
                    key={entry.slug}
                    href={getBlogPostPath(entry.slug)}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-800/50 transition-colors hover:border-zinc-700/60"
                  >
                    <BlogCoverImage
                      src={entry.image}
                      alt={entry.imageAlt}
                      className="h-[180px] border-b border-zinc-200/80"
                      paddingClassName="p-0"
                    />
                    <div className="flex flex-1 flex-col bg-zinc-950/60 p-5">
                      <span className="mb-3 inline-flex w-fit rounded-full bg-white/8 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-300">
                        {entry.category}
                      </span>
                      <h3 className="text-[16px] font-semibold leading-snug text-zinc-100 transition-colors group-hover:text-white">
                        {entry.title}
                      </h3>
                      <p className="mt-2 flex-1 text-[13px] leading-relaxed text-zinc-500">
                        {entry.excerpt}
                      </p>
                      <div className="mt-4 flex items-center justify-between text-[12px] text-zinc-600">
                        <span>{formatDate(entry.publishedAt)}</span>
                        <span>{entry.readingTimeMinutes} min read</span>
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
