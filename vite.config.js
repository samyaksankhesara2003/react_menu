import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // The Speechmatics PCM worklet must load via audioWorklet.addModule(), which
    // is unreliable with inlined data: URIs (CSP / Safari). Force it to be
    // emitted as a real asset file instead of base64-inlined.
    assetsInlineLimit(filePath) {
      if (filePath.includes('pcm-audio-worklet')) return false
      return undefined
    },
  },
})
