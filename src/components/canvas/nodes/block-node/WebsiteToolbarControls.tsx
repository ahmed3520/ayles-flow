import {
  Download,
  ExternalLink,
  FileText,
  Globe,
  Loader2,
  RefreshCw,
  Rocket,
} from 'lucide-react'
import { VIEWPORT_PRESETS } from './constants'
import type { Dispatch, SetStateAction } from 'react'

import type { BlockNodeData } from '@/types/nodes'

import type { ViewportPreset } from './constants'

type WebsiteToolbarControlsProps = {
  data: BlockNodeData
  deployLogs: string | null
  downloading: boolean
  setDeployLogs: Dispatch<SetStateAction<string | null>>
  setDownloading: Dispatch<SetStateAction<boolean>>
  setViewportPreset: (preset: ViewportPreset) => void
  updateData: (updates: Partial<BlockNodeData>) => void
}

export default function WebsiteToolbarControls({
  data,
  deployLogs,
  downloading,
  setDeployLogs,
  setDownloading,
  setViewportPreset,
  updateData,
}: WebsiteToolbarControlsProps) {
  return (
    <>
      {data.previewUrl &&
        (Object.keys(VIEWPORT_PRESETS) as Array<ViewportPreset>).map(
          (preset) => {
            const { icon: PresetIcon } = VIEWPORT_PRESETS[preset]
            const isActive = (data.viewportPreset || 'desktop') === preset

            return (
              <button
                key={preset}
                type="button"
                className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
                  isActive
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
                }`}
                onClick={() => setViewportPreset(preset)}
                title={preset.charAt(0).toUpperCase() + preset.slice(1)}
              >
                <PresetIcon size={13} />
              </button>
            )
          },
        )}
      {data.previewUrl && (
        <>
          <div className="h-3.5 w-px bg-zinc-700/50" />
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
            onClick={() => {
              const base = data.previewUrl?.split('?_r=')[0]
              if (!base) return
              updateData({ previewUrl: `${base}?_r=${Date.now()}` })
            }}
            title="Refresh preview"
          >
            <RefreshCw size={11} />
          </button>
          <a
            href={data.previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
            title="Open preview in new tab"
          >
            <ExternalLink size={11} />
          </a>
          <div className="h-3.5 w-px bg-zinc-700/50" />
          <button
            type="button"
            className="flex h-6 items-center gap-1 rounded-md px-1.5 text-emerald-400/80 transition-colors hover:bg-emerald-500/10 hover:text-emerald-300 disabled:opacity-40"
            disabled={data.deploymentStatus === 'deploying' || downloading}
            title={
              data.deploymentUrl
                ? `Deployed: ${data.deploymentUrl}`
                : 'Deploy to Vercel'
            }
            onClick={async () => {
              if (!data.sandboxId) return

              updateData({ deploymentStatus: 'deploying' })
              setDeployLogs('')

              let gotResult = false

              try {
                const { deployToVercel } = await import('@/data/sandbox-sync')
                const response = (await deployToVercel({
                  data: {
                    sandboxId: data.sandboxId,
                    projectName: data.label || 'project',
                  },
                })) as unknown as Response

                const reader = response.body?.getReader()
                if (!reader) throw new Error('No response stream')

                const decoder = new TextDecoder()
                let buffer = ''

                for (;;) {
                  const { done, value } = await reader.read()
                  if (done) break

                  buffer += decoder.decode(value, { stream: true })
                  const lines = buffer.split('\n')
                  buffer = lines.pop() || ''

                  for (const line of lines) {
                    if (!line.trim()) continue

                    try {
                      const event = JSON.parse(line)

                      if (event.type === 'log') {
                        setDeployLogs((prev) => (prev || '') + event.text)
                      } else if (event.type === 'done') {
                        gotResult = true
                        setDeployLogs(
                          (prev) => (prev || '') + `\n\nDeployed: ${event.url}`,
                        )
                        updateData({
                          deploymentUrl: event.url,
                          deploymentStatus: 'ready',
                        })
                      } else if (event.type === 'error') {
                        gotResult = true
                        setDeployLogs(
                          (prev) => (prev || '') + `\nERROR: ${event.text}`,
                        )
                        updateData({ deploymentStatus: 'error' })
                      }
                    } catch {
                      // skip malformed lines
                    }
                  }
                }

                if (!gotResult) {
                  updateData({ deploymentStatus: 'error' })
                }
              } catch (error) {
                const message =
                  error instanceof Error ? error.message : String(error)
                setDeployLogs((prev) => (prev || '') + `\nERROR: ${message}`)
                updateData({ deploymentStatus: 'error' })
              }
            }}
          >
            {data.deploymentStatus === 'deploying' ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <Rocket size={11} />
            )}
            <span className="text-[10px] font-medium">
              {data.deploymentStatus === 'deploying'
                ? 'Deploying...'
                : data.deploymentStatus === 'ready'
                  ? 'Deployed'
                  : 'Deploy'}
            </span>
          </button>
          {deployLogs !== null && (
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
              onClick={() => setDeployLogs(deployLogs ? null : '')}
              title="Toggle deploy logs"
            >
              <FileText size={11} />
            </button>
          )}
          {data.deploymentUrl && (
            <a
              href={data.deploymentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-6 items-center gap-1 rounded-md px-1.5 text-emerald-400/60 transition-colors hover:bg-emerald-500/10 hover:text-emerald-300"
              title={data.deploymentUrl}
            >
              <Globe size={11} />
              <span className="text-[10px] font-medium">Live</span>
            </a>
          )}
          <div className="h-3.5 w-px bg-zinc-700/50" />
          <button
            type="button"
            className="flex h-6 items-center gap-1 rounded-md px-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300 disabled:opacity-40"
            disabled={downloading || data.deploymentStatus === 'deploying'}
            title="Download project"
            onClick={async () => {
              if (!data.sandboxId) return

              setDownloading(true)
              try {
                const { downloadProject } = await import('@/data/sandbox-sync')
                const result = await downloadProject({
                  data: {
                    sandboxId: data.sandboxId,
                    projectName: data.label || 'project',
                  },
                })
                const bytes = Uint8Array.from(atob(result.base64), (char) =>
                  char.charCodeAt(0),
                )
                const blob = new Blob([bytes], { type: 'application/gzip' })
                const url = URL.createObjectURL(blob)
                const anchor = document.createElement('a')
                anchor.href = url
                anchor.download = result.fileName
                anchor.click()
                URL.revokeObjectURL(url)
              } catch (error) {
                console.error('[download]', error)
              } finally {
                setDownloading(false)
              }
            }}
          >
            {downloading ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <Download size={11} />
            )}
            <span className="text-[10px] font-medium">
              {downloading ? 'Downloading...' : 'Download'}
            </span>
          </button>
        </>
      )}
    </>
  )
}
