const COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'AI Workflow Builder', href: '/ai-workflow-builder' },
      {
        label: 'Visual AI Workflow Builder',
        href: '/visual-ai-workflow-builder',
      },
      { label: 'Image to Video Workflow', href: '/image-to-video-workflow' },
      { label: 'Pricing', href: '/#pricing' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Blog', href: '/blog' },
      { label: 'Documentation', href: '/docs' },
      { label: 'AI Content Workflow', href: '/ai-content-workflow' },
      {
        label: 'AI Research Report Generator',
        href: '/ai-research-report-generator',
      },
      { label: 'Changelog', href: '/changelog' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Contact', href: '/contact' },
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
    ],
  },
]

export default function Footer({ onSignIn }: { onSignIn?: () => void }) {
  return (
    <footer className="border-t border-zinc-800/40 px-6 pt-16 pb-10">
      <div className="mx-auto max-w-[1040px]">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          {/* Brand column */}
          <div className="lg:col-span-1">
            <span className="font-logo text-[19px] text-white">Ayles Flow</span>
            <p className="mt-3 text-[13px] leading-relaxed text-zinc-600 max-w-[200px]">
              Visual AI workflow builder for multimodal teams.
            </p>
            {onSignIn && (
              <button
                onClick={onSignIn}
                className="mt-5 rounded-full bg-white px-4 py-1.5 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-zinc-200 cursor-pointer"
              >
                Flow now
              </button>
            )}
          </div>

          {/* Link columns */}
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="text-[12px] font-semibold text-zinc-400 uppercase tracking-wide mb-4">
                {col.title}
              </h4>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-[13px] text-zinc-600 transition-colors hover:text-zinc-300"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-14 pt-6 border-t border-zinc-800/40 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-[12px] text-zinc-700">
            &copy; {new Date().getFullYear()} Ayles Flow. All rights reserved.
          </span>
          <div className="flex items-center gap-5">
            <a
              href="https://x.com/aylesflow"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Ayles Flow on X"
              className="text-zinc-700 transition-colors hover:text-zinc-400"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a
              href="mailto:hello@aylesflow.com"
              aria-label="Email Ayles Flow"
              className="text-zinc-700 transition-colors hover:text-zinc-400"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm16.2 2H4.8L12 12.4 19.2 7zM4 17h16V8.3l-7.43 5.58a1 1 0 0 1-1.14 0L4 8.3V17z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
