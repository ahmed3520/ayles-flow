import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { History, RotateCcw, Trash2, X } from 'lucide-react'

import { api } from '../../../convex/_generated/api'

import type { Id } from '../../../convex/_generated/dataModel'

interface VersionPanelProps {
  projectId: Id<'projects'>
  onClose: () => void
  onRestore: () => void
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function VersionPanel({
  projectId,
  onClose,
  onRestore,
}: VersionPanelProps) {
  const [versionName, setVersionName] = useState('')
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null)

  const versions = useQuery(api.versions.list, { projectId }) ?? []
  const createVersion = useMutation(api.versions.create)
  const restoreVersion = useMutation(api.versions.restore)
  const removeVersion = useMutation(api.versions.remove)

  const handleSaveVersion = async () => {
    const name = versionName.trim()
    if (!name) return
    await createVersion({ projectId, name })
    setVersionName('')
  }

  const handleRestore = async (versionId: Id<'versions'>) => {
    await restoreVersion({ projectId, versionId })
    setConfirmRestore(null)
    onRestore()
  }

  const handleDelete = async (versionId: Id<'versions'>) => {
    await removeVersion({ id: versionId })
  }

  return (
    <div className="absolute right-4 top-4 bottom-4 z-20 w-72 flex flex-col bg-zinc-900 rounded-2xl border border-zinc-800 shadow-[0_4px_16px_rgba(0,0,0,0.4)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <History size={14} className="text-zinc-400" />
          <h2 className="text-sm font-semibold text-zinc-200">Versions</h2>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
        >
          <X size={14} className="text-zinc-400" />
        </button>
      </div>

      {/* Save new version */}
      <div className="px-3 py-3 border-b border-zinc-800">
        <div className="flex gap-2">
          <input
            type="text"
            value={versionName}
            onChange={(e) => setVersionName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveVersion()
            }}
            placeholder="Version name..."
            className="flex-1 px-3 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500"
          />
          <button
            onClick={handleSaveVersion}
            disabled={!versionName.trim()}
            className="px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            Save
          </button>
        </div>
      </div>

      {/* Version list */}
      <div className="flex-1 overflow-y-auto p-2">
        {versions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <History size={28} className="text-zinc-700 mb-2" />
            <p className="text-xs text-zinc-500">No versions saved yet</p>
            <p className="text-[10px] text-zinc-600 mt-1">
              Save a version to create a snapshot you can restore later
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {versions.map((version) => (
              <div
                key={version._id}
                className="group px-3 py-2.5 rounded-xl hover:bg-zinc-800/50 transition-colors"
              >
                {confirmRestore === version._id ? (
                  <div>
                    <p className="text-xs text-amber-400 mb-2">
                      Restore this version? Current work will be overwritten.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRestore(version._id)}
                        className="flex-1 px-2 py-1 text-[10px] font-medium bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setConfirmRestore(null)}
                        className="flex-1 px-2 py-1 text-[10px] font-medium bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-zinc-300 truncate">
                        {version.name}
                      </p>
                      <p className="text-[10px] text-zinc-600 mt-0.5">
                        {timeAgo(version.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setConfirmRestore(version._id)}
                        className="p-1.5 rounded-lg hover:bg-zinc-700 transition-colors"
                        title="Restore version"
                      >
                        <RotateCcw size={12} className="text-zinc-400" />
                      </button>
                      <button
                        onClick={() => handleDelete(version._id)}
                        className="p-1.5 rounded-lg hover:bg-zinc-700 transition-colors"
                        title="Delete version"
                      >
                        <Trash2 size={12} className="text-zinc-500 hover:text-red-400" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
