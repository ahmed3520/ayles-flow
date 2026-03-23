import { markdownToRichTextHtml } from '@/utils/nodeTextUtils'

type BlogFrontmatter = {
  title: string
  description: string
  publishedAt: string
  author: string
  tags: Array<string>
  featured: boolean
  category: string
  image: string
  imageAlt: string
}

type PartialFrontmatter = Partial<BlogFrontmatter>

export type BlogPost = BlogFrontmatter & {
  slug: string
  content: string
  html: string
  readingTimeMinutes: number
  excerpt: string
}

const blogModules = import.meta.glob<string>('../content/blog/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
})

function parseBoolean(value: string) {
  return value.trim().toLowerCase() === 'true'
}

function parseFrontmatter(raw: string): {
  frontmatter: BlogFrontmatter
  content: string
} {
  const normalized = raw.replace(/\r\n/g, '\n')
  if (!normalized.startsWith('---\n')) {
    throw new Error('Markdown post is missing frontmatter.')
  }

  const endIndex = normalized.indexOf('\n---\n', 4)
  if (endIndex === -1) {
    throw new Error('Markdown post frontmatter is not closed.')
  }

  const frontmatterBlock = normalized.slice(4, endIndex)
  const content = normalized.slice(endIndex + 5).trim()
  const lines = frontmatterBlock.split('\n')

  const partial: PartialFrontmatter = {
    tags: [],
    featured: false,
  }
  let activeListKey: 'tags' | null = null

  for (const line of lines) {
    if (!line.trim()) continue

    const listItem = line.match(/^\s*-\s+(.+)$/)
    if (listItem && activeListKey) {
      partial[activeListKey] = [...(partial[activeListKey] ?? []), listItem[1]]
      continue
    }

    activeListKey = null
    const pair = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/)
    if (!pair) continue

    const [, key, rawValue] = pair
    const value = rawValue.trim()

    switch (key) {
      case 'title':
      case 'description':
      case 'publishedAt':
      case 'author':
        partial[key] = value
        break
      case 'featured':
        partial.featured = parseBoolean(value)
        break
      case 'category':
        partial.category = value
        break
      case 'image':
        partial.image = value
        break
      case 'imageAlt':
        partial.imageAlt = value
        break
      case 'tags':
        partial.tags = value ? value.split(',').map((tag) => tag.trim()) : []
        activeListKey = value ? null : 'tags'
        break
      default:
        break
    }
  }

  if (
    !partial.title ||
    !partial.description ||
    !partial.publishedAt ||
    !partial.author ||
    !partial.image
  ) {
    throw new Error('Markdown post frontmatter is missing required fields.')
  }

  return {
    frontmatter: {
      title: partial.title,
      description: partial.description,
      publishedAt: partial.publishedAt,
      author: partial.author,
      tags: partial.tags ?? [],
      featured: partial.featured ?? false,
      category: partial.category ?? 'Guide',
      image: partial.image,
      imageAlt: partial.imageAlt ?? partial.title,
    },
    content,
  }
}

function estimateReadingTime(content: string) {
  const words = content.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.ceil(words / 220))
}

function buildExcerpt(content: string) {
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const paragraph = lines.find(
    (line) =>
      !line.startsWith('#') &&
      !line.startsWith('- ') &&
      !line.startsWith('>') &&
      !/^\d+\.\s/.test(line),
  )

  if (!paragraph) return ''
  return paragraph.length > 180 ? `${paragraph.slice(0, 177)}...` : paragraph
}

function normalizeHeading(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function removeLeadingTitleHeading(content: string, title: string) {
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  const firstContentLineIndex = lines.findIndex((line) => line.trim().length > 0)

  if (firstContentLineIndex === -1) return content.trim()

  const firstLine = lines[firstContentLineIndex]
  const headingMatch = firstLine.match(/^#\s+(.+)$/)
  if (!headingMatch) return content.trim()

  if (normalizeHeading(headingMatch[1]) !== normalizeHeading(title)) {
    return content.trim()
  }

  lines.splice(firstContentLineIndex, 1)
  if (lines[firstContentLineIndex]?.trim() === '') {
    lines.splice(firstContentLineIndex, 1)
  }

  return lines.join('\n').trim()
}

function sortNewestFirst(a: BlogPost, b: BlogPost) {
  return (
    new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  )
}

export const BLOG_POSTS: Array<BlogPost> = Object.entries(blogModules)
  .map(([path, raw]) => {
    const slug = path.split('/').pop()?.replace(/\.md$/, '')
    if (!slug) {
      throw new Error(`Unable to infer blog slug from path: ${path}`)
    }

    const { frontmatter, content } = parseFrontmatter(raw)
    const normalizedContent = removeLeadingTitleHeading(content, frontmatter.title)

    return {
      slug,
      ...frontmatter,
      content: normalizedContent,
      html: markdownToRichTextHtml(normalizedContent),
      readingTimeMinutes: estimateReadingTime(normalizedContent),
      excerpt: buildExcerpt(normalizedContent),
    }
  })
  .filter((post) => !post.slug.startsWith('_'))
  .sort(sortNewestFirst)

export function getBlogPostBySlug(slug: string) {
  return BLOG_POSTS.find((post) => post.slug === slug)
}

export function getBlogPostPath(slug: string) {
  return `/blog/${slug}`
}
