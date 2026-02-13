import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import {
  PanelLeftClose,
  PanelLeft,
  Plus,
  Trash2,
  FolderOpen,
} from 'lucide-react'

interface ProjectsSidebarProps {
  currentProjectId: Id<'projects'> | null
  onSelectProject: (id: Id<'projects'>) => void
  onNewProject: () => void
}

export default function ProjectsSidebar({
  currentProjectId,
  onSelectProject,
  onNewProject,
}: ProjectsSidebarProps) {
  const [isOpen, setIsOpen] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState('')

  const projects = useQuery(api.projects.list) ?? []
  const createProject = useMutation(api.projects.create)
  const removeProject = useMutation(api.projects.remove)

  const handleCreate = async () => {
    if (!newName.trim()) return
    const id = await createProject({ name: newName.trim() })
    setNewName('')
    setIsCreating(false)
    onSelectProject(id)
  }

  const handleDelete = async (id: Id<'projects'>, e: React.MouseEvent) => {
    e.stopPropagation()
    await removeProject({ id })
    if (currentProjectId === id) {
      onNewProject()
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="absolute left-4 top-4 z-20 p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-colors"
        title="Open projects"
      >
        <PanelLeft size={18} className="text-zinc-400" />
      </button>
    )
  }

  return (
    <div className="absolute left-4 top-4 bottom-4 z-20 w-64 flex flex-col bg-zinc-900 rounded-2xl border border-zinc-800 shadow-[0_4px_16px_rgba(0,0,0,0.4)] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-200">Projects</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsCreating(true)}
            className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
            title="New project"
          >
            <Plus size={16} className="text-zinc-400" />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
            title="Close sidebar"
          >
            <PanelLeftClose size={16} className="text-zinc-400" />
          </button>
        </div>
      </div>

      {isCreating && (
        <div className="px-3 py-2 border-b border-zinc-800">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate()
              if (e.key === 'Escape') {
                setIsCreating(false)
                setNewName('')
              }
            }}
            placeholder="Project name..."
            className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500"
            autoFocus
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleCreate}
              className="flex-1 px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
            >
              Create
            </button>
            <button
              onClick={() => {
                setIsCreating(false)
                setNewName('')
              }}
              className="flex-1 px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2">
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <FolderOpen size={32} className="text-zinc-600 mb-2" />
            <p className="text-sm text-zinc-500">No projects yet</p>
            <p className="text-xs text-zinc-600 mt-1">
              Click + to create your first project
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {projects.map((project) => (
              <button
                key={project._id}
                onClick={() => onSelectProject(project._id)}
                className={`group flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-left transition-colors ${
                  currentProjectId === project._id
                    ? 'bg-indigo-600/20 border border-indigo-500/30'
                    : 'hover:bg-zinc-800 border border-transparent'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium truncate ${
                      currentProjectId === project._id
                        ? 'text-indigo-300'
                        : 'text-zinc-300'
                    }`}
                  >
                    {project.name}
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {new Date(project.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={(e) => handleDelete(project._id, e)}
                  className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-zinc-700 transition-all"
                  title="Delete project"
                >
                  <Trash2 size={14} className="text-zinc-500 hover:text-red-400" />
                </button>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
