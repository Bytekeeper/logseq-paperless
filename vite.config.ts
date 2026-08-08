import { defineConfig, type Plugin } from 'vite'
import logseqDevPluginPkg from 'vite-plugin-logseq'

// vite-plugin-logseq is CJS with `exports.default = fn` and `__esModule: true`.
// Node's CJS/ESM interop then makes the default import itself carry a nested
// `.default`, so it needs unwrapping one extra level here.
const logseqDevPlugin =
  (logseqDevPluginPkg as unknown as { default: () => Plugin }).default ??
  (logseqDevPluginPkg as unknown as () => Plugin)

export default defineConfig({
  base: './',
  plugins: [logseqDevPlugin()],
  build: {
    outDir: 'dist',
    target: 'esnext',
    minify: 'esbuild',
  },
})
