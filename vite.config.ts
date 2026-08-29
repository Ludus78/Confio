import { crx } from '@crxjs/vite-plugin'
import { defineConfig } from 'vite'
import manifest from './manifest.config.ts'

export default defineConfig({
  plugins: [crx({ manifest })],
  // CRXJS HMR talks to the extension pages from a chrome-extension:// origin.
  server: {
    cors: {
      origin: [/chrome-extension:\/\//],
    },
  },
})
