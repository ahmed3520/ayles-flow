import { createFileRoute, notFound } from '@tanstack/react-router'

import SeoLandingPage from '@/components/SeoLandingPage'
import { getSeoPageBySlug, getSeoPagePath } from '@/data/seoPages'
import {
  buildBreadcrumbSchema,
  buildFaqSchema,
  buildSeoHead,
  buildWebPageSchema,
} from '@/utils/seo'

export const Route = createFileRoute('/$landingSlug')({
  loader: ({ params }) => {
    const page = getSeoPageBySlug(params.landingSlug)
    if (!page) throw notFound()
    return page
  },
  head: ({ loaderData, params }) => {
    const page = loaderData ?? getSeoPageBySlug(params.landingSlug)
    if (!page) {
      return buildSeoHead({
        title: 'Ayles Flow',
        description: 'Explore Ayles Flow.',
        path: '/',
      })
    }

    return buildSeoHead({
      title: page.seoTitle,
      description: page.description,
      path: getSeoPagePath(page.slug),
      schema: [
        buildWebPageSchema({
          title: page.seoTitle,
          description: page.description,
          path: getSeoPagePath(page.slug),
        }),
        buildBreadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: page.title, path: getSeoPagePath(page.slug) },
        ]),
        buildFaqSchema(page.faqs),
      ],
    })
  },
  component: LandingPageRoute,
})

function LandingPageRoute() {
  const page = Route.useLoaderData()
  return <SeoLandingPage page={page} />
}
