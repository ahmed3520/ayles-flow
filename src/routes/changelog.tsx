import { createFileRoute } from '@tanstack/react-router'

import StaticPageLayout from '@/components/StaticPageLayout'

export const Route = createFileRoute('/changelog')({ component: Changelog })

function Changelog() {
  const entries = [
    {
      date: 'February 17, 2026',
      title: 'Launch',
      items: [
        'Visual canvas with node-based workflow builder',
        'AI Agent — build workflows from natural language',
        'Deep Research — web search, source reading, structured reports',
        'PDF generation with formatted documents and citations',
        '10 image models: Imagen 4, FLUX 1.1 Pro Ultra, FLUX.2, FLUX Schnell, Recraft V3, HiDream, GPT Image, Ideogram V3, SD 3.5 Medium, FLUX Kontext',
        '6 video models: Kling 2.1 Master, MiniMax Video-01, Hailuo-02 Pro (text-to-video and image-to-video)',
        '3 audio models: ElevenLabs V3, Orpheus TTS, Chatterbox',
        '3 music models: MiniMax Music, Lyria 2, CassetteAI',
        '8 block types: image, video, audio, music, text, note, ticket, PDF',
        'File uploads — image, audio, video, PDF',
        'Copy, paste, duplicate nodes',
        'Context menu with block creation and node actions',
        'Project dashboard with canvas previews',
        'Free and Pro billing plans',
      ],
    },
  ]

  return (
    <StaticPageLayout title="Changelog">
      <p>What&apos;s new in Ayles Flow.</p>

      <div className="space-y-10 pt-2">
        {entries.map((entry) => (
          <div key={entry.date} className="relative pl-6 border-l border-zinc-800/60">
            <div className="absolute left-0 top-1 w-2 h-2 rounded-full bg-zinc-700 -translate-x-[5px]" />
            <p className="text-[12px] text-zinc-600 font-medium uppercase tracking-wide mb-1">
              {entry.date}
            </p>
            <h3 className="text-[17px] font-semibold text-zinc-200 mb-3">
              {entry.title}
            </h3>
            <ul className="space-y-1.5">
              {entry.items.map((item) => (
                <li
                  key={item}
                  className="text-[14px] text-zinc-500 flex items-start gap-2"
                >
                  <span className="text-zinc-700 mt-1.5 shrink-0">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </StaticPageLayout>
  )
}
