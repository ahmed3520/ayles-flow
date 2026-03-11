import { SignedIn, UserButton, useUser } from '@clerk/tanstack-react-start'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { ArrowLeft } from 'lucide-react'
import { useEffect } from 'react'

import { api } from '../../convex/_generated/api'

import type { Id } from '../../convex/_generated/dataModel'

import Canvas from '@/components/canvas/Canvas'
import { buildSeoHead } from '@/utils/seo'

export const Route = createFileRoute('/canvas/$projectId')({
  head: ({ params }) =>
    buildSeoHead({
      title: 'Project Canvas | Ayles Flow',
      description: 'Project canvas workspace for Ayles Flow.',
      path: `/canvas/${params.projectId}`,
      noindex: true,
    }),
  headers: () => ({
    'X-Robots-Tag': 'noindex, nofollow',
  }),
  component: CanvasProjectPage,
  ssr: false,
})

function CanvasProjectPage() {
  const { projectId } = Route.useParams()
  const navigate = useNavigate()
  const { isSignedIn } = useUser()
  const storeUser = useMutation(api.users.store)

  // Store user in Convex on mount
  useEffect(() => {
    if (isSignedIn) {
      storeUser()
    }
  }, [isSignedIn, storeUser])

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <SignedIn>
          <UserButton
            appearance={{
              elements: {
                avatarBox: 'w-9 h-9',
              },
            }}
          />
        </SignedIn>
      </div>
      <button
        onClick={() => navigate({ to: '/' })}
        className="absolute top-4 left-4 z-20 p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-colors"
        title="Back to projects"
      >
        <ArrowLeft size={18} className="text-zinc-400" />
      </button>
      <Canvas projectId={projectId as Id<'projects'>} />
    </div>
  )
}
