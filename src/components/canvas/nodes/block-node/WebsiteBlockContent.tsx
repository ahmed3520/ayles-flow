import { GripHorizontal, Loader2 } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'

import type { BlockNodeData } from '@/types/nodes'

type WebsiteBlockContentProps = {
  data: BlockNodeData
  deployLogs: string | null
  setDeployLogs: Dispatch<SetStateAction<string | null>>
}

export default function WebsiteBlockContent({
  data,
  deployLogs,
  setDeployLogs,
}: WebsiteBlockContentProps) {
  return (
    <div className="flex flex-1 min-h-0 flex-col">
      {data.restoreStep ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-b-xl bg-zinc-950">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-emerald-500/20">
            <Loader2 size={24} className="animate-spin text-emerald-400" />
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-[12px] font-medium text-zinc-300">
              Restoring Project
            </span>
            <span className="text-[11px] text-emerald-400/80">
              {data.restoreStep}
            </span>
          </div>
          <div className="mt-1 flex gap-1">
            {['Creating', 'Restoring', 'Installing', 'Starting'].map(
              (step, index) => {
                const current = (data.restoreStep || '').toLowerCase()
                const stepIdx = [
                  'creating',
                  'restoring',
                  'installing',
                  'starting',
                ].findIndex((value) => current.includes(value))

                return (
                  <div
                    key={step}
                    className={`h-1 w-8 rounded-full transition-colors ${
                      index === stepIdx
                        ? 'bg-emerald-400'
                        : index < stepIdx
                          ? 'bg-emerald-400/40'
                          : 'bg-zinc-800'
                    }`}
                  />
                )
              },
            )}
          </div>
        </div>
      ) : data.previewUrl ? (
        <div className="relative flex-1 min-h-0">
          <div
            className="absolute top-2 left-2 z-10 flex h-6 cursor-grab items-center gap-1.5 rounded-md border border-zinc-700/70 bg-zinc-900/80 px-2 text-[10px] font-medium text-zinc-300 select-none active:cursor-grabbing"
            title="Drag node"
          >
            <GripHorizontal size={10} className="text-zinc-400" />
            <span>Drag</span>
          </div>
          <iframe
            src={data.previewUrl}
            className="nodrag nowheel h-full w-full rounded-b-xl bg-white"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            title={data.label || 'Live preview'}
          />
          {deployLogs && (
            <div className="absolute inset-0 z-20 flex flex-col rounded-b-xl bg-zinc-950/95">
              <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
                <span className="text-[11px] font-medium text-zinc-400">
                  {data.deploymentStatus === 'deploying'
                    ? 'Deploying...'
                    : 'Deploy Logs'}
                </span>
                <button
                  type="button"
                  className="text-[10px] text-zinc-500 hover:text-zinc-300"
                  onClick={() => setDeployLogs(null)}
                >
                  Close
                </button>
              </div>
              <pre className="nodrag nowheel flex-1 overflow-auto whitespace-pre-wrap p-3 font-mono text-[10px] leading-relaxed text-zinc-400">
                {deployLogs}
                {data.deploymentStatus === 'deploying' && (
                  <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-emerald-400" />
                )}
              </pre>
              {data.deploymentUrl && (
                <div className="border-t border-zinc-800 px-3 py-2">
                  <a
                    href={data.deploymentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-emerald-400 underline hover:text-emerald-300"
                  >
                    {data.deploymentUrl}
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <Loader2 size={20} className="animate-spin text-emerald-400/60" />
          <span className="text-[11px] text-zinc-500">Loading preview...</span>
        </div>
      )}
    </div>
  )
}
