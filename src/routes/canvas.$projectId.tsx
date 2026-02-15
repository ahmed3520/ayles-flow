import { SignIn, UserButton, useUser } from '@clerk/tanstack-react-start'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useEffect } from 'react'

import { api } from '../../convex/_generated/api'

import type { Id } from '../../convex/_generated/dataModel'

import Canvas from '@/components/canvas/Canvas'

export const Route = createFileRoute('/canvas/$projectId')({
  component: CanvasProjectPage,
  ssr: false,
})

function CanvasProjectPage() {
  const { projectId } = Route.useParams()
  const navigate = useNavigate()
  const { isLoaded, isSignedIn } = useUser()
  const storeUser = useMutation(api.users.store)

  // Store user in Convex on mount
  useEffect(() => {
    if (isSignedIn) {
      storeUser()
    }
  }, [isSignedIn, storeUser])

  // Require authentication — show inline sign-in instead of redirecting away
  if (isLoaded && !isSignedIn) {
    return (
      <div className="fixed inset-0 z-50 bg-zinc-950 flex items-center justify-center">
        <SignIn routing="hash" />
      </div>
    )
  }

  // Loading state
  if (!isLoaded) {
    return (
      <div className="fixed inset-0 z-50 bg-zinc-950 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-zinc-500" />
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <UserButton
          appearance={{
            elements: {
              avatarBox: 'w-9 h-9',
            },
          }}
        />
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
