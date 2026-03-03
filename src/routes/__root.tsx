import { ClerkProvider } from '@clerk/tanstack-react-start'
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import BetaBanner from '../components/BetaBanner'
import ConvexProvider from '../integrations/convex/provider'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Ayles Flow — Your AI Production Studio' },
      {
        name: 'description',
        content:
          'Design, deploy, and scale AI workflows on one infinite canvas. Use any model — image, video, audio, music, text. Let agents build the pipeline. Powered by Quasar.',
      },
      { name: 'theme-color', content: '#09090b' },
      // Open Graph
      { property: 'og:type', content: 'website' },
      { property: 'og:title', content: 'Ayles Flow — Your AI Production Studio' },
      {
        property: 'og:description',
        content:
          'Design, deploy, and scale AI workflows on one infinite canvas. Use any model. Let agents build the pipeline.',
      },
      { property: 'og:url', content: 'https://aylesflow.com' },
      { property: 'og:site_name', content: 'Ayles Flow' },
      { property: 'og:image', content: 'https://aylesflow.com/assets/android-chrome-512x512.png' },
      // Twitter
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:site', content: '@aylesflow' },
      { name: 'twitter:title', content: 'Ayles Flow — Your AI Production Studio' },
      {
        name: 'twitter:description',
        content:
          'Design, deploy, and scale AI workflows on one infinite canvas. Use any model. Let agents build the pipeline.',
      },
      { name: 'twitter:image', content: 'https://aylesflow.com/assets/android-chrome-512x512.png' },
    ],
    links: [
      { rel: 'icon', href: '/assets/favicon.ico', sizes: 'any' },
      { rel: 'icon', href: '/assets/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
      { rel: 'icon', href: '/assets/favicon-16x16.png', type: 'image/png', sizes: '16x16' },
      { rel: 'apple-touch-icon', href: '/assets/apple-touch-icon.png' },
      { rel: 'manifest', href: '/manifest.json' },
      {
        rel: 'preconnect',
        href: 'https://fonts.googleapis.com',
      },
      {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossOrigin: 'anonymous',
      },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Caveat:wght@400;500;600&family=Instrument+Serif:ital@0;1&display=swap',
      },
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),

  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <ClerkProvider afterSignOutUrl="/">
          <ConvexProvider>
            <BetaBanner />
            {children}
            <TanStackDevtools
              config={{
                position: 'bottom-right',
              }}
              plugins={[
                {
                  name: 'Tanstack Router',
                  render: <TanStackRouterDevtoolsPanel />,
                },
              ]}
            />
          </ConvexProvider>
        </ClerkProvider>
        <Scripts />
      </body>
    </html>
  )
}
