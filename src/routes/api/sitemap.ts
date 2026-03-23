import { createFileRoute } from '@tanstack/react-router'
import { BLOG_POSTS, getBlogPostPath } from '@/data/blog'
import { SITE_URL } from '@/utils/seo'

type SitemapEntry = {
  loc: string
  priority: string
  changefreq: string
  lastmod?: string
}

const today = new Date().toISOString().split('T')[0]

const STATIC_URLS: Array<SitemapEntry> = [
  { loc: '/', priority: '1.0', changefreq: 'weekly' },
  { loc: '/about', priority: '0.8', changefreq: 'monthly' },
  { loc: '/docs', priority: '0.8', changefreq: 'weekly' },
  { loc: '/features', priority: '0.9', changefreq: 'weekly' },
  { loc: '/features/visual-canvas', priority: '0.9', changefreq: 'weekly' },
  { loc: '/features/text-editor', priority: '0.9', changefreq: 'weekly' },
  { loc: '/features/deep-research', priority: '0.9', changefreq: 'weekly' },
  { loc: '/features/ai-agent', priority: '0.8', changefreq: 'weekly' },
  { loc: '/features/media-generation', priority: '0.8', changefreq: 'weekly' },
  { loc: '/ai-workflow-builder', priority: '0.9', changefreq: 'weekly' },
  {
    loc: '/visual-ai-workflow-builder',
    priority: '0.8',
    changefreq: 'weekly',
  },
  { loc: '/image-to-video-workflow', priority: '0.8', changefreq: 'weekly' },
  { loc: '/ai-content-workflow', priority: '0.7', changefreq: 'weekly' },
  {
    loc: '/ai-research-report-generator',
    priority: '0.7',
    changefreq: 'weekly',
  },
  { loc: '/blog', priority: '0.7', changefreq: 'weekly' },
  { loc: '/changelog', priority: '0.7', changefreq: 'weekly' },
  { loc: '/contact', priority: '0.5', changefreq: 'monthly' },
  { loc: '/quasar', priority: '0.5', changefreq: 'monthly' },
  { loc: '/privacy', priority: '0.3', changefreq: 'yearly' },
  { loc: '/terms', priority: '0.3', changefreq: 'yearly' },
]

function buildSitemapXml(entries: Array<SitemapEntry>) {
  const urls = entries
    .map(
      (e) => `  <url>
    <loc>${SITE_URL}${e.loc}</loc>
    <lastmod>${e.lastmod ?? today}</lastmod>
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority}</priority>
  </url>`,
    )
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`
}

export const Route = createFileRoute('/api/sitemap')({
  server: {
    handlers: {
      GET: () => {
        const blogEntries: Array<SitemapEntry> = BLOG_POSTS.map((post) => ({
          loc: getBlogPostPath(post.slug),
          priority: '0.7',
          changefreq: 'monthly',
          lastmod: post.publishedAt,
        }))

        const all = [...STATIC_URLS, ...blogEntries]
        const xml = buildSitemapXml(all)

        return new Response(xml, {
          headers: {
            'Content-Type': 'application/xml',
            'Cache-Control': 'public, max-age=3600',
          },
        })
      },
    },
  },
})
