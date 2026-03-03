import {
  SignedIn,
  SignedOut,
  UserButton,
} from '@clerk/tanstack-react-start'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { FolderOpen, Loader2, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'

import { api } from '../../convex/_generated/api'

import CanvasPreview from '@/components/CanvasPreview'
import LandingPage from '@/components/LandingPage'

export const Route = createFileRoute('/')({ component: Home })

function StoreUser({ storeUser }: { storeUser: () => void }) {
  useEffect(() => {
    storeUser()
  }, [storeUser])

  return null
}

function ProjectDashboard() {
  const navigate = useNavigate()
  const projects = useQuery(api.projects.list) ?? []
  const createProject = useMutation(api.projects.create)
  const removeProject = useMutation(api.projects.remove)
  const [isCreating, setIsCreating] = useState(false)

  const handleNewProject = async () => {
    setIsCreating(true)
    try {
      const id = await createProject({ name: 'Untitled Project' })
      navigate({ to: '/canvas/$projectId', params: { projectId: id } })
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="min-h-screen text-zinc-200">
      <div className="max-w-5xl mx-auto px-6 py-12 min-h-screen">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="font-logo text-[28px] text-white italic">Ayles Flow</h1>
            <p className="text-sm text-zinc-500 mt-1">Your projects</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/billing"
              className="px-3 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Billing
            </Link>
            <UserButton
              appearance={{
                elements: {
                  avatarBox: 'w-9 h-9',
                },
              }}
            />
            <button
              onClick={handleNewProject}
              disabled={isCreating}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl transition-colors"
            >
              {isCreating ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Plus size={16} />
              )}
              New Project
            </button>
          </div>
        </div>

        {/* Projects grid */}
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <FolderOpen size={48} className="text-zinc-700 mb-4" />
            <h2 className="text-lg font-medium text-zinc-400">
              No projects yet
            </h2>
            <p className="text-sm text-zinc-600 mt-2 max-w-sm">
              Create your first project to start building on the canvas
            </p>
            <button
              onClick={handleNewProject}
              disabled={isCreating}
              className="mt-6 flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl transition-colors"
            >
              <Plus size={16} />
              Create Project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <button
                key={project._id}
                onClick={() =>
                  navigate({
                    to: '/canvas/$projectId',
                    params: { projectId: project._id },
                  })
                }
                className="group text-left rounded-2xl bg-zinc-900 border border-zinc-800/60 hover:border-zinc-700/60 hover:bg-zinc-800/50 transition-all overflow-hidden cursor-pointer"
              >
                {/* Canvas preview thumbnail */}
                <div className="h-36 bg-zinc-950/60 border-b border-zinc-800/40">
                  <CanvasPreview
                    thumbnailUrl={project.thumbnailUrl}
                    nodes={project.nodes as Array<any>}
                    edges={project.edges as Array<any>}
                  />
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <h3 className="text-sm font-semibold text-zinc-200 group-hover:text-white transition-colors truncate">
                      {project.name}
                    </h3>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation()
                        removeProject({ id: project._id })
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.stopPropagation()
                          removeProject({ id: project._id })
                        }
                      }}
                      className="p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-zinc-700 transition-all text-zinc-500 hover:text-red-400 text-xs cursor-pointer"
                      title="Delete project"
                    >
                      Delete
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-zinc-600">
                      {new Date(project.updatedAt).toLocaleDateString(
                        undefined,
                        {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        },
                      )}
                    </p>
                    <span className="text-[10px] text-zinc-600">
                      {(project.nodes as Array<unknown>).length} node
                      {(project.nodes as Array<unknown>).length !== 1
                        ? 's'
                        : ''}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Home() {
  const storeUser = useMutation(api.users.store)

  return (
    <div className="min-h-screen">
      <SignedIn>
        <StoreUser storeUser={storeUser} />
        <ProjectDashboard />
      </SignedIn>
      <SignedOut>
        <LandingPage />
      </SignedOut>
    </div>
  )
}
