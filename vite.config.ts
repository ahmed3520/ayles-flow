import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import { fileURLToPath, URL } from 'url'

import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from '@cloudflare/vite-plugin'

const config = defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Temporary fix: Clerk's SWR dependency pulls use-sync-external-store
      // into the client bundle incorrectly. Aliasing to react resolves this
      // until Clerk removes SWR in the next major release.
      // See: https://github.com/TanStack/router/issues/5738
      'use-sync-external-store/shim/index.js': 'react',
    },
  },
  plugins: [
    devtools(),
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
