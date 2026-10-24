import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import istanbul from 'vite-plugin-istanbul'
import ogHandler from './api/_og.ts'

const MUSIC_DIR = fileURLToPath(new URL('./public/music', import.meta.url))
const TITLES_FILE = `${MUSIC_DIR}/titles.json`
const VIRTUAL_ID = 'virtual:music-tracks'
const RESOLVED_ID = `\0${VIRTUAL_ID}`

function titleFromFile(file: string): string {
  const base = file.replace(/\.mp3$/i, '').replace(/[-_]+/g, ' ').trim()
  return base.charAt(0).toUpperCase() + base.slice(1)
}

// Tracks are every .mp3 in public/music. titles.json (optional) gives titles, and its key order sets the play order.
function readTracks(): { file: string; title: string }[] {
  const files = readdirSync(MUSIC_DIR).filter((name) => /\.mp3$/i.test(name))
  const titles: Record<string, unknown> = existsSync(TITLES_FILE)
    ? JSON.parse(readFileSync(TITLES_FILE, 'utf8'))
    : {}
  const ordered = Object.keys(titles).filter((file) => files.includes(file))
  const rest = files.filter((file) => !ordered.includes(file)).sort()
  return [...ordered, ...rest].map((file) => {
    const title = titles[file]
    return { file, title: typeof title === 'string' && title !== '' ? title : titleFromFile(file) }
  })
}

// Provides the track list as a module, so nothing has to be generated or committed.
function musicTracks(): Plugin {
  return {
    name: 'music-tracks',
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : null
    },
    load(id) {
      return id === RESOLVED_ID ? `export default ${JSON.stringify(readTracks())};` : null
    },
    configureServer(server) {
      // Adding, renaming or removing a file in public/music refreshes the list during development.
      server.watcher.add(MUSIC_DIR)
      const refresh = (file: string) => {
        if (!file.startsWith(MUSIC_DIR)) return
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID)
        if (mod) server.moduleGraph.invalidateModule(mod)
        server.ws.send({ type: 'full-reload' })
      }
      server.watcher.on('add', refresh)
      server.watcher.on('unlink', refresh)
      server.watcher.on('change', refresh)
    },
  }
}

// Serves the bookmarks BFF at /api/og during development, the same handler Vercel runs in production.
function bookmarksApi(): Plugin {
  return {
    name: 'bookmarks-api',
    configureServer(server) {
      server.middlewares.use('/api/og', (req, res) => {
        void ogHandler(req, res)
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/og', (req, res) => {
        void ogHandler(req, res)
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    musicTracks(),
    bookmarksApi(),
    // Only for `npm run e2e:coverage`: instruments src so Playwright can collect window.__coverage__.
    ...(process.env.E2E_COVERAGE ? [istanbul({ include: 'src/**', forceBuildInstrument: true, exclude: ['**/*.test.ts'], extension: ['.ts', '.tsx'], requireEnv: false })] : []),
  ],
  build: { sourcemap: Boolean(process.env.E2E_COVERAGE) },
})
