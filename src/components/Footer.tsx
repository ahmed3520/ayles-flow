const COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'Canvas', href: '/#' },
      { label: 'AI Agent', href: '/#agent' },
      { label: 'Features', href: '/#features' },
      { label: 'Pricing', href: '/#pricing' },
    ],
  },
  {
    title: 'Models',
    links: [{ label: 'Quasar by SILX AI', href: '/quasar' }],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Documentation', href: '/docs' },
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
            <span className="font-logo text-[19px] text-white">
              Ayles Flow
            </span>
            <p className="mt-3 text-[13px] leading-relaxed text-zinc-600 max-w-[200px]">
              Your AI production studio. One canvas, every model.
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
              href="#"
              className="text-zinc-700 transition-colors hover:text-zinc-400"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a
              href="#"
              className="text-zinc-700 transition-colors hover:text-zinc-400"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
