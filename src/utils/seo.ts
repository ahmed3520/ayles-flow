import type { MetaDescriptor } from '@tanstack/react-router'

export const SITE_NAME = 'Ayles Flow'
export const SITE_URL = 'https://aylesflow.com'
export const SITE_X_URL = 'https://x.com/aylesflow'
export const DEFAULT_OG_IMAGE_PATH = '/assets/android-chrome-512x512.png'

type JsonLdObject = Record<string, unknown>

type SeoHeadOptions = {
  title: string
  description: string
  path: string
  noindex?: boolean
  imagePath?: string
  imageAlt?: string
  schema?: JsonLdObject | Array<JsonLdObject>
}

export function absoluteUrl(path: string) {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return new URL(normalizedPath, SITE_URL).toString()
}

function normalizePathname(pathname: string) {
  if (!pathname || pathname === '/') {
    return '/'
  }

  return pathname.replace(/\/+$/, '') || '/'
}

export function canonicalUrl(path: string) {
  const source =
    path.startsWith('http://') || path.startsWith('https://')
      ? new URL(path)
      : new URL(path.startsWith('/') ? path : `/${path}`, SITE_URL)

  source.pathname = normalizePathname(source.pathname)
  source.search = ''
  source.hash = ''

  return source.toString()
}

export function buildSeoHead({
  title,
  description,
  path,
  noindex = false,
  imagePath = DEFAULT_OG_IMAGE_PATH,
  imageAlt,
  schema,
}: SeoHeadOptions) {
  const url = canonicalUrl(path)
  const image = absoluteUrl(imagePath)
  const robots = noindex
    ? 'noindex, nofollow'
    : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'

  const meta: Array<MetaDescriptor> = [
    { title },
    { name: 'description', content: description },
    { name: 'robots', content: robots },
    { property: 'og:type', content: 'website' },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:url', content: url },
    { property: 'og:site_name', content: SITE_NAME },
    { property: 'og:image', content: image },
    { property: 'og:image:alt', content: imageAlt ?? title },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:site', content: '@aylesflow' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: image },
    { name: 'twitter:image:alt', content: imageAlt ?? title },
  ]

  const schemas = schema ? (Array.isArray(schema) ? schema : [schema]) : []
  for (const entry of schemas) {
    meta.push({ 'script:ld+json': entry })
  }

  return {
    meta: meta as Array<any>,
    links: [{ rel: 'canonical', href: url }] as Array<any>,
  }
}

export function buildWebsiteSchema({ description }: { description: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    description,
  }
}

export function buildOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: absoluteUrl(DEFAULT_OG_IMAGE_PATH),
    sameAs: [SITE_X_URL],
  }
}

export function buildSoftwareApplicationSchema({
  description,
  featureList,
}: {
  description: string
  featureList: Array<string>
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE_NAME,
    url: SITE_URL,
    operatingSystem: 'Web',
    applicationCategory: 'BusinessApplication',
    description,
    featureList,
  }
}

export function buildWebPageSchema({
  title,
  description,
  path,
  type = 'WebPage',
}: {
  title: string
  description: string
  path: string
  type?: string
}) {
  return {
    '@context': 'https://schema.org',
    '@type': type,
    name: title,
    description,
    url: canonicalUrl(path),
    isPartOf: {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: SITE_URL,
    },
  }
}

export function buildCollectionPageSchema({
  title,
  description,
  path,
  items,
}: {
  title: string
  description: string
  path: string
  items: Array<{ name: string; path: string }>
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    description,
    url: canonicalUrl(path),
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        url: canonicalUrl(item.path),
      })),
    },
  }
}

export function buildBreadcrumbSchema(
  items: Array<{ name: string; path: string }>,
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: canonicalUrl(item.path),
    })),
  }
}

export function buildFaqSchema(
  items: Array<{ question: string; answer: string }>,
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }
}

export function buildArticleSchema({
  title,
  description,
  path,
  publishedAt,
  author,
  imagePath,
}: {
  title: string
  description: string
  path: string
  publishedAt: string
  author: string
  imagePath?: string
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    description,
    image: absoluteUrl(imagePath ?? DEFAULT_OG_IMAGE_PATH),
    datePublished: publishedAt,
    author: {
      '@type': 'Person',
        name: author,
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: absoluteUrl(DEFAULT_OG_IMAGE_PATH),
      },
    },
    mainEntityOfPage: canonicalUrl(path),
    url: canonicalUrl(path),
  }
}
