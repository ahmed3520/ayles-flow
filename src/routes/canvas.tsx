import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/canvas')({
  component: () => <Outlet />,
  ssr: false,
})
