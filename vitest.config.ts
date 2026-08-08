import { defineConfig } from 'vitest/config'

// Deliberately separate from vite.config.ts: vite-plugin-logseq's dev-server
// hook assumes a real httpServer in non-middleware mode, which breaks
// vitest's internal test server. Tests don't need the plugin at all.
export default defineConfig({
  test: {
    environment: 'jsdom',
  },
})
