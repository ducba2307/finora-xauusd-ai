import { defineConfig } from 'vitest/config'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const contractFallbackPlugin = () => ({
  name: 'contract-fallback',
  resolveId(id: string) {
    // Normalizes windows backslashes
    const normalized = id.replace(/\\/g, '/')
    const srcDir = path.resolve(__dirname, 'src').replace(/\\/g, '/')
    
    if (normalized.startsWith(srcDir)) {
      const relPath = normalized.slice(srcDir.length).replace(/^\//, '')
      // Check if file exists in src
      const extensions = ['', '.ts', '.tsx', '/index.ts', '/index.tsx']
      const existsInSrc = extensions.some(ext => {
        const p = path.resolve(__dirname, 'src', relPath + ext)
        return fs.existsSync(p) && fs.statSync(p).isFile()
      })
      if (!existsInSrc) {
        // Fall back to src/test/contracts/
        for (const ext of extensions) {
          const p = path.resolve(__dirname, 'src/test/contracts', relPath + ext)
          if (fs.existsSync(p) && fs.statSync(p).isFile()) {
            return p
          }
        }
      }
    }
    return null
  }
})

export default defineConfig({
  plugins: [contractFallbackPlugin()],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/test/**/*.test.ts', 'src/test/**/*.spec.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
