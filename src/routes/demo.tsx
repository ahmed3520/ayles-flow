import { Outlet, createFileRoute } from '@tanstack/react-router'

import { buildSeoHead } from '@/utils/seo'

export const Route = createFileRoute('/demo')({
  head: () =>
    buildSeoHead({
      title: 'Demo Routes | Ayles Flow',
      description: 'Internal demo routes for development and testing only.',
      path: '/demo',
      noindex: true,
    }),
  headers: () => ({
    'X-Robots-Tag': 'noindex, nofollow',
  }),
  component: DemoLayout,
})

function DemoLayout() {
  return <Outlet />
}
