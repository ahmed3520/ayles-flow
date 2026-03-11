import { Outlet, createFileRoute } from '@tanstack/react-router'
import { buildSeoHead } from '@/utils/seo'

export const Route = createFileRoute('/canvas')({
  head: () =>
    buildSeoHead({
      title: 'Canvas | Ayles Flow',
      description: 'Canvas workspace for Ayles Flow projects.',
      path: '/canvas',
      noindex: true,
    }),
  headers: () => ({
    'X-Robots-Tag': 'noindex, nofollow',
  }),
  component: () => <Outlet />,
  ssr: false,
})
