import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useReducedMotion } from 'motion/react'
import type { Command, Feature, Side, Theme, WorkspaceFrame } from './types'
import { featureMeta, commandNames, initialFrame } from './constants'
import { Mainframe } from './components/Mainframe'
import { Stack } from './components/Stack'
import { Dock } from './components/Dock'
import { FeaturePanel } from './components/FeaturePanel'
import { CommandPalette } from './components/CommandPalette'
import './App.css'

function App() {
  const [frames, setFrames] = useState<WorkspaceFrame[]>(() => {
    const saved = localStorage.getItem('focus-space-frames')
    if (!saved) return [initialFrame]
    return (JSON.parse(saved) as Partial<WorkspaceFrame>[]).map(
      (frame) => ({ ...initialFrame, ...frame, feature: frame.feature ?? 'notes' }),
    )
  })
  const [activeFrameId, setActiveFrameId] = useState('main')
  const [stackFocusIndex, setStackFocusIndex] = useState(-1)
  const [focusedSide, setFocusedSide] = useState<Side>('main')
  const [withinSide, setWithinSide] = useState(false)
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem('focus-space-theme') as Theme | null) ?? 'dark',
  )
  const [menuOpen, setMenuOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [menuFocusIndex, setMenuFocusIndex] = useState(0)
  const [searchMode, setSearchMode] = useState(false)
  const [rightFocusIndex, setRightFocusIndex] = useState(0)
  const [featurePanel, setFeaturePanel] = useState<Feature | null>(null)
  const [featureAnchorY, setFeatureAnchorY] = useState<number | null>(null)
  const [entryFocusIndex, setEntryFocusIndex] = useState(0)
  const [noteBodies, setNoteBodies] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('focus-space-note-bodies')
    return saved
      ? (JSON.parse(saved) as Record<string, string>)
      : { main: '# Notes\n\nStart writing in Markdown…\n\n- [ ] Capture the next idea' }
  })

  const frameRefs = useRef<Record<string, HTMLElement | null>>({})
  const stackRefs = useRef<Record<string, HTMLElement | null>>({})
  const sideRefs = useRef<Record<Side, HTMLElement | null>>({
    left: null,
    main: null,
    right: null,
  })
  const profileRef = useRef<HTMLButtonElement | null>(null)
  const rightItemRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const actionInputRef = useRef<HTMLInputElement | null>(null)
  const featureAsideRef = useRef<HTMLElement | null>(null)
  const featureEntryRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const reduceMotion = useReducedMotion() ?? false

  const activeFrame = frames.find((frame) => frame.id === activeFrameId) ?? frames[0]
  const stackedFrames = frames.filter((frame) => frame.id !== activeFrame.id)
  const visibleCommands = useMemo(
    () => commandNames.filter((command) => command.toLowerCase().includes(query.toLowerCase())),
    [query],
  )
  const searchResults = useMemo(
    () =>
      frames.filter(
        (frame) =>
          `${frame.title} ${frame.feature} ${frame.description}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [frames, query],
  )
  const featureEntries = useMemo(
    () => (featurePanel ? frames.filter((frame) => frame.feature === featurePanel) : []),
    [featurePanel, frames],
  )
  const activeMenuId = searchMode
    ? searchResults[menuFocusIndex]?.id
    : visibleCommands[menuFocusIndex]

  const framesCountByFeature = Object.fromEntries(
    (Object.keys(featureMeta) as Feature[]).map((feature) => [
      feature,
      frames.filter((frame) => frame.feature === feature).length,
    ]),
  ) as Record<Feature, number>

  const openFeatureDirectly = useCallback(
    (feature: Feature) => {
      const existing = frames.find((frame) => frame.feature === feature)
      if (existing) {
        setActiveFrameId(existing.id)
      } else {
        const created = { ...featureMeta[feature].frame, feature, id: crypto.randomUUID() }
        setFrames((current) => [created, ...current])
        setActiveFrameId(created.id)
      }
      setFocusedSide('main')
      setWithinSide(true)
    },
    [frames],
  )

  const openFeaturePanel = (feature: Feature) => {
    setFeaturePanel(feature)
    const featureButton = rightItemRefs.current[`feature-${feature}`]
    if (featureButton) {
      setFeatureAnchorY(
        featureButton.getBoundingClientRect().top +
          featureButton.getBoundingClientRect().height / 2,
      )
    }
  }

  const focusDockItem = () => {
    const features = Object.keys(featureMeta) as Feature[]
    const id =
      rightFocusIndex === 0
        ? 'profile'
        : rightFocusIndex === features.length + 1
          ? 'settings'
          : rightFocusIndex === features.length + 2
            ? 'logout'
            : `feature-${features[rightFocusIndex - 1]}`
    rightItemRefs.current[id]?.focus()
  }

  const closeFeaturePanel = () => {
    setFeaturePanel(null)
    focusDockItem()
  }

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }, [])

  const runCommand = (command: Command) => {
    if (command === 'Search') {
      setSearchMode(true)
      setQuery('')
      setMenuOpen(true)
      setMenuFocusIndex(0)
      actionInputRef.current?.focus()
      return
    }
    const newFrame = { ...featureMeta[command].frame, feature: command, id: crypto.randomUUID() }
    setFrames((current) => [newFrame, ...current])
    setActiveFrameId(newFrame.id)
    setFocusedSide('main')
    setWithinSide(true)
    setMenuOpen(false)
    setQuery('')
    setSearchMode(false)
  }

  const commandKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (searchMode) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        if (!searchResults.length) return
        const delta = event.key === 'ArrowDown' ? 1 : -1
        setMenuFocusIndex((current) => (current + delta + searchResults.length) % searchResults.length)
      }
      if (event.key === 'Enter' && searchResults[menuFocusIndex]) {
        const result = searchResults[menuFocusIndex]
        setActiveFrameId(result.id)
        setFocusedSide('main')
        setWithinSide(true)
        setMenuOpen(false)
        setSearchMode(false)
        setQuery('')
      }
      if (event.key === 'Escape') {
        setMenuOpen(false)
        setSearchMode(false)
      }
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!visibleCommands.length) return
      const delta = event.key === 'ArrowDown' ? 1 : -1
      setMenuFocusIndex((current) => (current + delta + visibleCommands.length) % visibleCommands.length)
    }
    if (event.key === 'Enter' && visibleCommands[menuFocusIndex]) {
      runCommand(visibleCommands[menuFocusIndex])
    }
    if (event.key === 'Escape') setMenuOpen(false)
  }

  useEffect(() => {
    localStorage.setItem('focus-space-frames', JSON.stringify(frames))
  }, [frames])
  useEffect(() => {
    localStorage.setItem('focus-space-note-bodies', JSON.stringify(noteBodies))
  }, [noteBodies])
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('focus-space-theme', theme)
  }, [theme])
  useEffect(() => {
    if (focusedSide !== 'left' || !withinSide || stackFocusIndex < 0) return
    stackRefs.current[stackedFrames[stackFocusIndex]?.id]?.focus()
  }, [focusedSide, stackFocusIndex, stackedFrames, withinSide])
  useEffect(() => {
    if (!withinSide) sideRefs.current[focusedSide]?.focus()
  }, [focusedSide, withinSide])
  useEffect(() => {
    if (focusedSide === 'main' && withinSide && !menuOpen) {
      frameRefs.current[activeFrameId]?.focus()
    }
  }, [activeFrameId, focusedSide, frames, menuOpen, withinSide])
  useEffect(() => {
    if (!featurePanel) return
    setEntryFocusIndex(0)
    const firstEntry = featureEntries[0] ? featureEntryRefs.current[featureEntries[0].id] : null
    if (firstEntry) firstEntry.focus()
    else featureAsideRef.current?.focus()
  }, [featureEntries, featurePanel])

  useEffect(() => {
    const navigate = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setFocusedSide('main')
        setWithinSide(true)
        setMenuOpen(true)
        setSearchMode(false)
        setMenuFocusIndex(0)
        actionInputRef.current?.focus()
        return
      }
      if (
        (event.metaKey || event.ctrlKey) &&
        event.shiftKey &&
        event.key.toLowerCase() === 'l'
      ) {
        event.preventDefault()
        toggleTheme()
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        setMenuOpen(false)
        setStackFocusIndex(-1)
        setFocusedSide('main')
        setWithinSide(false)
        sideRefs.current.main?.focus()
        return
      }
      if (featurePanel) return
      if (menuOpen || event.target instanceof HTMLInputElement) return
      if (
        focusedSide === 'left' &&
        withinSide &&
        (event.key === 'Delete' || event.key === 'Backspace') &&
        stackFocusIndex >= 0
      ) {
        const removed = stackedFrames[stackFocusIndex]
        if (!removed) return
        event.preventDefault()
        const nextFrames = stackedFrames.filter((frame) => frame.id !== removed.id)
        setFrames((current) => current.filter((frame) => frame.id !== removed.id))
        if (nextFrames.length) {
          const nextIndex = Math.min(stackFocusIndex, nextFrames.length - 1)
          setStackFocusIndex(nextIndex)
          stackRefs.current[nextFrames[nextIndex]?.id]?.focus()
        } else {
          setStackFocusIndex(-1)
          setWithinSide(false)
          sideRefs.current.left?.focus()
        }
        return
      }
      if (event.altKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        event.preventDefault()
        const sides: Side[] = ['left', 'main', 'right']
        const offset = event.key === 'ArrowLeft' ? -1 : 1
        const next = Math.max(0, Math.min(sides.length - 1, sides.indexOf(focusedSide) + offset))
        const nextSide = sides[next]
        const enteringLeft = nextSide === 'left' && stackedFrames.length > 0
        setFocusedSide(nextSide)
        setWithinSide(enteringLeft)
        setStackFocusIndex(enteringLeft ? 0 : -1)
        if (enteringLeft) stackRefs.current[stackedFrames[0].id]?.focus()
        else sideRefs.current[nextSide]?.focus()
        return
      }
      if (focusedSide === 'left' && withinSide && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
        if (!stackedFrames.length) return
        event.preventDefault()
        const next = event.key === 'ArrowUp'
          ? Math.max(0, stackFocusIndex - 1)
          : Math.min(stackedFrames.length - 1, stackFocusIndex + 1)
        setStackFocusIndex(next)
        stackRefs.current[stackedFrames[next]?.id]?.focus()
        return
      }
      if (focusedSide === 'right' && withinSide && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
        event.preventDefault()
        const count = Object.keys(featureMeta).length + 3
        const delta = event.key === 'ArrowUp' ? -1 : 1
        const next = Math.max(0, Math.min(count - 1, rightFocusIndex + delta))
        setRightFocusIndex(next)
        const id =
          next === 0
            ? 'profile'
            : next === count - 1
              ? 'logout'
              : next === count - 2
                ? 'settings'
                : `feature-${(Object.keys(featureMeta) as Feature[])[next - 1]}`
        rightItemRefs.current[id]?.focus()
        return
      }
      if (event.key !== 'Enter') return
      if (!withinSide) {
        event.preventDefault()
        setWithinSide(true)
        if (focusedSide === 'left' && stackedFrames.length) {
          setStackFocusIndex(0)
          stackRefs.current[stackedFrames[0].id]?.focus()
        }
        if (focusedSide === 'main') {
          frameRefs.current[activeFrameId]?.focus()
        }
        if (focusedSide === 'right') {
          setRightFocusIndex(0)
          profileRef.current?.focus()
        }
        return
      }
      if (focusedSide === 'left' && stackFocusIndex >= 0 && stackedFrames[stackFocusIndex]) {
        event.preventDefault()
        const selectedFrame = stackedFrames[stackFocusIndex]
        const previousMain = activeFrame
        setFrames((current) => [
          selectedFrame,
          previousMain,
          ...current.filter(
            (frame) => frame.id !== selectedFrame.id && frame.id !== previousMain.id,
          ),
        ])
        setActiveFrameId(selectedFrame.id)
        setStackFocusIndex(-1)
        setFocusedSide('main')
      }
      if (focusedSide === 'right' && rightFocusIndex >= 1 && rightFocusIndex <= Object.keys(featureMeta).length) {
        const feature = (Object.keys(featureMeta) as Feature[])[rightFocusIndex - 1]
        if (feature === 'pomodoro') openFeatureDirectly(feature)
        else openFeaturePanel(feature)
      }
    }
    window.addEventListener('keydown', navigate)
    return () => window.removeEventListener('keydown', navigate)
  }, [
    activeFrame,
    activeFrameId,
    featurePanel,
    focusedSide,
    menuOpen,
    openFeatureDirectly,
    rightFocusIndex,
    stackFocusIndex,
    stackedFrames,
    toggleTheme,
    withinSide,
  ])

  return (
    <main className="app">
      <div className="stage" aria-live="polite">
        <div className="canvas">
          <aside
            ref={(node) => {
              sideRefs.current.left = node
            }}
            className={`side-region left-side ${focusedSide === 'left' ? 'side-focused' : ''} ${
              focusedSide === 'left' && withinSide ? 'within-focused' : ''
            }`}
            aria-label="Latest frames"
            tabIndex={0}
          >
            <p className="side-label">Latest frames</p>
            <Stack
              stackedFrames={stackedFrames}
              stackFocusIndex={stackFocusIndex}
              stackRefs={stackRefs.current}
              reduceMotion={reduceMotion}
              onSelect={(index) => {
                setFocusedSide('left')
                setWithinSide(true)
                setStackFocusIndex(index)
              }}
            />
          </aside>

          <section
            ref={(node) => {
              sideRefs.current.main = node
            }}
            onFocusCapture={() => {
              setFocusedSide('main')
              setWithinSide(true)
            }}
            className={`side-region main-side ${focusedSide === 'main' ? 'side-focused' : ''} ${
              focusedSide === 'main' && withinSide ? 'within-focused' : ''
            }`}
            aria-label="Main frame"
            tabIndex={0}
          >
            <div
              className={
                activeFrame.feature === 'notes'
                  ? 'main-frame-position note-position'
                  : 'main-frame-position'
              }
            >
              <Mainframe
                frame={activeFrame}
                active
                noteBody={noteBodies[activeFrame.id]}
                onNoteChange={(value) =>
                  setNoteBodies((current) => ({ ...current, [activeFrame.id]: value }))
                }
                frameRef={(node) => {
                  frameRefs.current[activeFrame.id] = node
                }}
              />
            </div>
          </section>

          <aside
            ref={(node) => {
              sideRefs.current.right = node
            }}
            className={`side-region right-side ${focusedSide === 'right' ? 'side-focused' : ''} ${
              focusedSide === 'right' && withinSide ? 'within-focused' : ''
            }`}
            aria-label="Settings and utilities"
            tabIndex={0}
          >
            <Dock
              rightItemRefs={rightItemRefs.current}
              profileRef={profileRef}
              framesCountByFeature={framesCountByFeature}
              theme={theme}
              onToggleTheme={toggleTheme}
              setRightFocusIndex={setRightFocusIndex}
              onFeaturePress={(feature) => {
                if (feature === 'pomodoro') openFeatureDirectly(feature)
                else openFeaturePanel(feature)
              }}
            />
          </aside>

          {featurePanel && (
            <FeaturePanel
              featurePanel={featurePanel}
              featureEntries={featureEntries}
              featureAnchorY={featureAnchorY}
              entryFocusIndex={entryFocusIndex}
              featureAsideRef={featureAsideRef}
              featureEntryRefs={featureEntryRefs.current}
              onClose={closeFeaturePanel}
              onEntryClick={(frame) => {
                setActiveFrameId(frame.id)
                setFocusedSide('main')
                setWithinSide(true)
                closeFeaturePanel()
              }}
            />
          )}

          <CommandPalette
            menuOpen={menuOpen}
            searchMode={searchMode}
            query={query}
            visibleCommands={visibleCommands}
            searchResults={searchResults.map((frame) => ({
              id: frame.id,
              feature: frame.feature,
              title: frame.title,
            }))}
            menuFocusIndex={menuFocusIndex}
            activeMenuId={activeMenuId}
            actionInputRef={actionInputRef}
            reduceMotion={reduceMotion}
            onQueryChange={(value) => {
              setQuery(value)
              setMenuFocusIndex(0)
              setMenuOpen(true)
            }}
            onFocus={() => {
              setMenuFocusIndex(0)
              setMenuOpen(true)
            }}
            onKeyDown={commandKeyDown}
            onRunCommand={runCommand}
            onSelectResult={(id) => {
              setActiveFrameId(id)
              setFocusedSide('main')
              setWithinSide(true)
              setMenuOpen(false)
              setSearchMode(false)
              setQuery('')
            }}
          />
        </div>
      </div>
    </main>
  )
}

export default App
