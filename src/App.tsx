import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, RefCallback } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import './App.css'

type Feature = 'habits' | 'reminders' | 'focus music' | 'notes' | 'todo list' | 'pomodoro'
type Command = Feature | 'Search'
type WorkspaceFrame = { id: string; feature: Feature; title: string; eyebrow: string; description: string; details: string[] }
type Side = 'left' | 'main' | 'right'

const featureMeta: Record<Feature, { glyph: string; description: string; frame: Omit<WorkspaceFrame, 'id' | 'feature'> }> = {
  habits: { glyph: '↻', description: 'Build a repeatable routine', frame: { eyebrow: 'HABITS', title: 'Habits', description: 'Small practices, made visible and easy to return to.', details: ['Morning stretch', 'Read for 20 minutes', 'Walk after lunch'] } },
  reminders: { glyph: '◷', description: 'Keep time-aware notes', frame: { eyebrow: 'REMINDERS', title: 'Reminders', description: 'Time-aware prompts that stay close to your current context.', details: ['Call Alex · Today', 'Send the proposal · Tomorrow', 'Renew the membership · Friday'] } },
  'focus music': { glyph: '♪', description: 'Open a listening space', frame: { eyebrow: 'FOCUS MUSIC', title: 'Focus Music', description: 'A calm listening space for the work in front of you.', details: ['Deep work mix', 'Ambient room', '25 minute session'] } },
  notes: { glyph: '✎', description: 'Capture a thought', frame: { eyebrow: 'NOTES', title: 'Notes', description: 'A lightweight place for thoughts, references, and ideas.', details: ['Launch idea', 'Research reference', 'Things to explore'] } },
  'todo list': { glyph: '☑', description: 'Track a short list', frame: { eyebrow: 'TODO LIST', title: 'Todo List', description: 'A focused list for the next few things worth finishing.', details: ['Draft the outline', 'Review the numbers', 'Share the update'] } },
  pomodoro: { glyph: '◉', description: 'Start a timed session', frame: { eyebrow: 'POMODORO', title: 'Pomodoro', description: 'A simple work / rest rhythm for making progress.', details: ['25:00 work interval', '05:00 short break', '4 rounds planned'] } },
}

const commandNames = [...Object.keys(featureMeta), 'Search'] as Command[]
const initialFrame: WorkspaceFrame = { id: 'main', feature: 'notes', eyebrow: 'NOTES', title: 'Notes', description: 'A lightweight place for thoughts, references, and ideas.', details: ['Launch idea', 'Research reference', 'Things to explore'] }

function FrameCard({ frame, active, frameRef }: { frame: WorkspaceFrame; active: boolean; frameRef: RefCallback<HTMLElement> }) {
  return (
    <section ref={frameRef} className={active ? 'workspace-frame active' : 'workspace-frame'} aria-label={frame.title} aria-current={active ? 'page' : undefined} tabIndex={-1}>
      <p className="frame-eyebrow">{frame.eyebrow}</p>
      <h1>{frame.title}</h1>
      <p className="frame-description">{frame.description}</p>
      <ul>{frame.details.map((detail) => <li key={detail}><span aria-hidden="true">•</span>{detail}</li>)}</ul>
      <p className="frame-foot">Use the frame stack to revisit earlier contexts</p>
    </section>
  )
}

function StackPreview({ frame }: { frame: WorkspaceFrame }) {
  return <div className="stack-preview" aria-hidden="true"><p>{frame.eyebrow}</p><h2>{frame.title}</h2><span>{frame.description}</span></div>
}

function App() {
  const [frames, setFrames] = useState<WorkspaceFrame[]>(() => {
    const saved = localStorage.getItem('focus-space-frames')
    if (!saved) return [initialFrame]
    return (JSON.parse(saved) as Partial<WorkspaceFrame>[]).map((frame) => ({ ...initialFrame, ...frame, feature: frame.feature ?? 'notes' }))
  })
  const [activeFrameId, setActiveFrameId] = useState('main')
  const [stackFocusIndex, setStackFocusIndex] = useState(-1)
  const [focusedSide, setFocusedSide] = useState<Side>('main')
  const [withinSide, setWithinSide] = useState(false)
  const [compactMode, setCompactMode] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [menuFocusIndex, setMenuFocusIndex] = useState(0)
  const [searchMode, setSearchMode] = useState(false)
  const [rightFocusIndex, setRightFocusIndex] = useState(0)
  const [featurePanel, setFeaturePanel] = useState<Feature | null>(null)
  const [featureAnchorY, setFeatureAnchorY] = useState<number | null>(null)
  const [entryFocusIndex, setEntryFocusIndex] = useState(0)
  const frameRefs = useRef<Record<string, HTMLElement | null>>({})
  const stackRefs = useRef<Record<string, HTMLElement | null>>({})
  const sideRefs = useRef<Record<Side, HTMLElement | null>>({ left: null, main: null, right: null })
  const settingRef = useRef<HTMLButtonElement | null>(null)
  const profileRef = useRef<HTMLButtonElement | null>(null)
  const rightItemRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const actionInputRef = useRef<HTMLInputElement | null>(null)
  const featureAsideRef = useRef<HTMLElement | null>(null)
  const featureEntryRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const reduceMotion = useReducedMotion()
  const activeFrame = frames.find((frame) => frame.id === activeFrameId) ?? frames[0]
  const stackedFrames = frames.filter((frame) => frame.id !== activeFrame.id)
  const visibleCommands = useMemo(() => commandNames.filter((command) => command.toLowerCase().includes(query.toLowerCase())), [query])
  const searchResults = useMemo(() => frames.filter((frame) => `${frame.title} ${frame.feature} ${frame.description}`.toLowerCase().includes(query.toLowerCase())), [frames, query])
  const featureEntries = useMemo(() => featurePanel ? frames.filter((frame) => frame.feature === featurePanel) : [], [featurePanel, frames])
  const activeMenuId = searchMode ? searchResults[menuFocusIndex]?.id : visibleCommands[menuFocusIndex]

  useEffect(() => localStorage.setItem('focus-space-frames', JSON.stringify(frames)), [frames])
  useEffect(() => {
    if (focusedSide !== 'left' || !withinSide || stackFocusIndex < 0) return
    stackRefs.current[stackedFrames[stackFocusIndex]?.id]?.focus()
  }, [focusedSide, stackFocusIndex, stackedFrames, withinSide])
  useEffect(() => {
    if (!withinSide) sideRefs.current[focusedSide]?.focus()
  }, [focusedSide, withinSide])
  useEffect(() => {
    if (focusedSide === 'main' && withinSide && !menuOpen) {
      requestAnimationFrame(() => frameRefs.current[activeFrameId]?.focus())
    }
  }, [activeFrameId, focusedSide, frames, menuOpen, withinSide])
  useEffect(() => {
    if (!featurePanel) return
    setEntryFocusIndex(0)
    requestAnimationFrame(() => featureEntryRefs.current[featureEntries[0]?.id]?.focus() ?? featureAsideRef.current?.focus())
  }, [featureEntries, featurePanel])
  useEffect(() => {
    if (!featurePanel) return
    const closeWhenFocusLeaves = (event: FocusEvent) => {
      if (featureAsideRef.current && !featureAsideRef.current.contains(event.target as Node)) {
        setFeaturePanel(null)
        requestAnimationFrame(() => {
          const features = Object.keys(featureMeta) as Feature[]
          const id = rightFocusIndex === 0 ? 'profile' : rightFocusIndex === features.length + 1 ? 'settings' : rightFocusIndex === features.length + 2 ? 'logout' : `feature-${features[rightFocusIndex - 1]}`
          rightItemRefs.current[id]?.focus()
        })
      }
    }
    document.addEventListener('focusin', closeWhenFocusLeaves)
    return () => document.removeEventListener('focusin', closeWhenFocusLeaves)
  }, [featurePanel, rightFocusIndex])
  useEffect(() => {
    const navigate = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setFocusedSide('main')
        setWithinSide(true)
        setMenuOpen(true)
        setSearchMode(false)
        setMenuFocusIndex(0)
        requestAnimationFrame(() => actionInputRef.current?.focus())
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        setMenuOpen(false)
        setStackFocusIndex(-1)
        setFocusedSide('main')
        setWithinSide(false)
        requestAnimationFrame(() => sideRefs.current.main?.focus())
        return
      }
      if (featurePanel) return
      if (menuOpen || event.target instanceof HTMLInputElement) return
      if (focusedSide === 'left' && withinSide && (event.key === 'Delete' || event.key === 'Backspace') && stackFocusIndex >= 0) {
        const removed = stackedFrames[stackFocusIndex]
        if (!removed) return
        event.preventDefault()
        const nextFrames = stackedFrames.filter((frame) => frame.id !== removed.id)
        setFrames((current) => current.filter((frame) => frame.id !== removed.id))
        if (nextFrames.length) {
          const nextIndex = Math.min(stackFocusIndex, nextFrames.length - 1)
          setStackFocusIndex(nextIndex)
          requestAnimationFrame(() => stackRefs.current[nextFrames[nextIndex]?.id]?.focus())
        } else {
          setStackFocusIndex(-1)
          setWithinSide(false)
          requestAnimationFrame(() => sideRefs.current.left?.focus())
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
        requestAnimationFrame(() => enteringLeft ? stackRefs.current[stackedFrames[0].id]?.focus() : sideRefs.current[nextSide]?.focus())
        return
      }
      if (focusedSide === 'left' && withinSide && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
        if (!stackedFrames.length) return
        event.preventDefault()
        const next = event.key === 'ArrowUp'
          ? Math.max(0, stackFocusIndex - 1)
          : Math.min(stackedFrames.length - 1, stackFocusIndex + 1)
        setStackFocusIndex(next)
        requestAnimationFrame(() => stackRefs.current[stackedFrames[next]?.id]?.focus())
        return
      }
      if (focusedSide === 'right' && withinSide && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
        event.preventDefault()
        const count = Object.keys(featureMeta).length + 3
        const delta = event.key === 'ArrowUp' ? -1 : 1
        const next = Math.max(0, Math.min(count - 1, rightFocusIndex + delta))
        setRightFocusIndex(next)
        const id = next === 0 ? 'profile' : next === count - 1 ? 'logout' : next === count - 2 ? 'settings' : `feature-${(Object.keys(featureMeta) as Feature[])[next - 1]}`
        requestAnimationFrame(() => rightItemRefs.current[id]?.focus())
        return
      }
      if (event.key !== 'Enter') return
      if (!withinSide) {
        event.preventDefault()
        setWithinSide(true)
        if (focusedSide === 'left' && stackedFrames.length) {
          setStackFocusIndex(0)
          requestAnimationFrame(() => stackRefs.current[stackedFrames[0].id]?.focus())
        }
        if (focusedSide === 'main') requestAnimationFrame(() => frameRefs.current[activeFrameId]?.focus())
        if (focusedSide === 'right') {
          setRightFocusIndex(0)
          requestAnimationFrame(() => profileRef.current?.focus())
        }
        return
      }
      if (focusedSide === 'left' && stackFocusIndex >= 0 && stackedFrames[stackFocusIndex]) {
        event.preventDefault()
        const selectedFrame = stackedFrames[stackFocusIndex]
        const previousMain = activeFrame
        setFrames((current) => [selectedFrame, previousMain, ...current.filter((frame) => frame.id !== selectedFrame.id && frame.id !== previousMain.id)])
        setActiveFrameId(selectedFrame.id)
        setStackFocusIndex(-1)
        setFocusedSide('main')
        requestAnimationFrame(() => frameRefs.current[selectedFrame.id]?.focus())
      }
      if (focusedSide === 'right' && rightFocusIndex >= 1 && rightFocusIndex <= Object.keys(featureMeta).length) {
        const feature = (Object.keys(featureMeta) as Feature[])[rightFocusIndex - 1]
        openFeaturePanel(feature)
      }
    }
    window.addEventListener('keydown', navigate)
    return () => window.removeEventListener('keydown', navigate)
  }, [activeFrame, activeFrameId, featurePanel, focusedSide, menuOpen, rightFocusIndex, stackFocusIndex, stackedFrames, withinSide])

  const runCommand = (command: Command) => {
    if (command === 'Search') {
      setSearchMode(true)
      setQuery('')
      setMenuOpen(true)
      setMenuFocusIndex(0)
      requestAnimationFrame(() => actionInputRef.current?.focus())
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
      if (event.key === 'Escape') { setMenuOpen(false); setSearchMode(false) }
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!visibleCommands.length) return
      const delta = event.key === 'ArrowDown' ? 1 : -1
      setMenuFocusIndex((current) => (current + delta + visibleCommands.length) % visibleCommands.length)
    }
    if (event.key === 'Enter' && visibleCommands[menuFocusIndex]) runCommand(visibleCommands[menuFocusIndex])
    if (event.key === 'Escape') setMenuOpen(false)
  }

  const openFeaturePanel = (feature: Feature) => {
    setFeaturePanel(feature)
    requestAnimationFrame(() => {
      const featureButton = rightItemRefs.current[`feature-${feature}`]
      if (featureButton) setFeatureAnchorY(featureButton.getBoundingClientRect().top + featureButton.getBoundingClientRect().height / 2)
    })
  }

  const focusDockItem = () => {
    const features = Object.keys(featureMeta) as Feature[]
    const id = rightFocusIndex === 0 ? 'profile' : rightFocusIndex === features.length + 1 ? 'settings' : rightFocusIndex === features.length + 2 ? 'logout' : `feature-${features[rightFocusIndex - 1]}`
    requestAnimationFrame(() => rightItemRefs.current[id]?.focus())
  }

  const closeFeaturePanel = () => {
    setFeaturePanel(null)
    focusDockItem()
  }

  return (
    <main className="app">
      <div className="stage" aria-live="polite">
        <div className="canvas">
          <aside ref={(node) => { sideRefs.current.left = node }} className={`side-region left-side ${focusedSide === 'left' ? 'side-focused' : ''} ${focusedSide === 'left' && withinSide ? 'within-focused' : ''}`} aria-label="Latest frames" tabIndex={0}>
            <p className="side-label">Latest frames</p>
            <div className="frame-stack">
            {stackedFrames.map((frame, index) => (
              <motion.div className={index === stackFocusIndex ? 'stack-item previewed' : 'stack-item'} key={frame.id} animate={{ y: index * 73, rotateY: index % 2 ? -14 : -8, rotateZ: index % 2 ? 2 : -2, z: -index * 24, scale: index === stackFocusIndex ? (index === 0 || index === stackedFrames.length - 2 ? 1.5 : 3) : 1 }} transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 330, damping: 30 }} style={{ zIndex: index === stackFocusIndex ? stackedFrames.length + 1 : stackedFrames.length - index }}>
                <div ref={(node) => { stackRefs.current[frame.id] = node }} className="stack-frame" aria-label={`Frame: ${frame.title}`} role="button" tabIndex={-1} onFocus={() => { setFocusedSide('left'); setWithinSide(true); setStackFocusIndex(index) }} onClick={() => { setFocusedSide('left'); setWithinSide(true); setStackFocusIndex(index) }}>
                  <StackPreview frame={frame} />
                </div>
              </motion.div>
            ))}
            </div>
          </aside>
          <section ref={(node) => { sideRefs.current.main = node }} className={`side-region main-side ${focusedSide === 'main' ? 'side-focused' : ''} ${focusedSide === 'main' && withinSide ? 'within-focused' : ''}`} aria-label="Main frame" tabIndex={0}>
            <div className="main-frame-position">
              <FrameCard frame={activeFrame} active frameRef={(node) => { frameRefs.current[activeFrame.id] = node }} />
            </div>
          </section>
          <aside ref={(node) => { sideRefs.current.right = node }} className={`side-region right-side ${focusedSide === 'right' ? 'side-focused' : ''} ${focusedSide === 'right' && withinSide ? 'within-focused' : ''}`} aria-label="Settings and utilities" tabIndex={0}>
            <div className="right-group profile-group"><button ref={(node) => { profileRef.current = node; rightItemRefs.current.profile = node }} type="button" className="setting" onFocus={() => { setFocusedSide('right'); setWithinSide(true); setRightFocusIndex(0) }} onClick={() => setRightFocusIndex(0)}><span>◉</span><span><b>Profile</b><small>Personal space</small></span></button></div>
            <div className="right-group feature-group">
              <div className="feature-links">{(Object.keys(featureMeta) as Feature[]).map((feature, index) => <button key={feature} ref={(node) => { rightItemRefs.current[`feature-${feature}`] = node }} type="button" className="setting" onFocus={() => { setFocusedSide('right'); setWithinSide(true); setRightFocusIndex(index + 1) }} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); openFeaturePanel(feature); setRightFocusIndex(index + 1) } }} onClick={() => { openFeaturePanel(feature); setRightFocusIndex(index + 1) }}><span>{featureMeta[feature].glyph}</span><span><b>{featureMeta[feature].frame.title}</b><small>{frames.filter((frame) => frame.feature === feature).length} entries</small></span></button>)}</div>
            </div>
            <div className="right-group settings-group"><button ref={(node) => { settingRef.current = node; rightItemRefs.current.settings = node }} type="button" className="setting" onFocus={() => { setFocusedSide('right'); setWithinSide(true); setRightFocusIndex(Object.keys(featureMeta).length + 1) }} onClick={() => { setCompactMode((current) => !current); setRightFocusIndex(Object.keys(featureMeta).length + 1) }}><span>⚙</span><span><b>Settings</b><small>{compactMode ? 'Compact on' : 'Preferences'}</small></span></button></div>
            <div className="right-group logout-group"><button ref={(node) => { rightItemRefs.current.logout = node }} type="button" className="setting" onFocus={() => { setFocusedSide('right'); setWithinSide(true); setRightFocusIndex(Object.keys(featureMeta).length + 2) }} onClick={() => setRightFocusIndex(Object.keys(featureMeta).length + 2)}><span>↪</span><span><b>Log out</b><small>End session</small></span></button></div>
          </aside>
          {featurePanel && <aside ref={featureAsideRef} className="feature-aside" style={{ top: featureAnchorY ?? '50%' }} aria-label={`${featureMeta[featurePanel].frame.title} entries`} tabIndex={-1} onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault()
              if (!featureEntries.length) return
              const delta = event.key === 'ArrowDown' ? 1 : -1
              const next = Math.max(0, Math.min(featureEntries.length - 1, entryFocusIndex + delta))
              setEntryFocusIndex(next)
              requestAnimationFrame(() => featureEntryRefs.current[featureEntries[next].id]?.focus())
              return
            }
            if (event.key === 'Escape') { event.preventDefault(); closeFeaturePanel(); return }
            if (event.key !== 'Tab') return
            const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled])'))
            if (!focusable.length) return
            const first = focusable[0]
            const last = focusable[focusable.length - 1]
            if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) { event.preventDefault(); last.focus() }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
          }}>
            <div className="feature-aside-heading"><span>{featureMeta[featurePanel].glyph}</span><b>{featureMeta[featurePanel].frame.title}</b><button type="button" aria-label="Close feature entries" onClick={closeFeaturePanel}>×</button></div>
            <div className="feature-entry-list">{featureEntries.length ? featureEntries.map((frame, index) => <button key={frame.id} ref={(node) => { featureEntryRefs.current[frame.id] = node }} type="button" className={index === entryFocusIndex ? 'entry-selected' : ''} onFocus={() => setEntryFocusIndex(index)} onClick={() => { setActiveFrameId(frame.id); setFocusedSide('main'); setWithinSide(true); closeFeaturePanel() }}><b>{frame.title}</b><small>{frame.description}</small></button>) : featureMeta[featurePanel].frame.details.map((entry) => <button key={entry} type="button"><b>{entry}</b><small>New entry</small></button>)}</div>
          </aside>}

          <motion.div className="command-wrap" animate={menuOpen ? { scaleX: 1.2, scaleY: 1.2 } : { scaleX: 1, scaleY: 1 }} transition={reduceMotion ? { duration: 0 } : { duration: 0.18, ease: 'easeOut' }}>
            <input ref={actionInputRef} aria-label="Open actions" aria-controls="action-menu" aria-activedescendant={menuOpen && activeMenuId ? (searchMode ? `result-${activeMenuId}` : `action-${activeMenuId.toLowerCase().replaceAll(' ', '-')}`) : undefined} value={query} onChange={(event) => { setQuery(event.target.value); setMenuFocusIndex(0); setMenuOpen(true) }} onFocus={() => { setMenuFocusIndex(0); setMenuOpen(true) }} onKeyDown={commandKeyDown} placeholder={searchMode ? 'Search created features…' : 'Choose an action…'} />
            <kbd>⌘K</kbd>
          </motion.div>
        </div>

        <AnimatePresence>
          {menuOpen && (
            <motion.div className="menu-layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0 : 0.12 }} onMouseDown={(event) => event.target === event.currentTarget && setMenuOpen(false)}>
              <motion.div className="menu" id="action-menu" role="menu" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }} transition={{ duration: reduceMotion ? 0 : 0.16, ease: 'easeOut' }}>
                <p className="menu-label">{searchMode ? 'Search created features' : query ? 'Matching actions' : 'Create or search'}</p>
                {searchMode ? (searchResults.length ? searchResults.map((frame, index) => <button key={frame.id} id={`result-${frame.id}`} role="menuitem" aria-selected={index === menuFocusIndex} type="button" className={index === menuFocusIndex ? 'selected' : ''} onMouseEnter={() => setMenuFocusIndex(index)} onClick={() => { setActiveFrameId(frame.id); setFocusedSide('main'); setWithinSide(true); setMenuOpen(false); setSearchMode(false); setQuery('') }}><span className="command-glyph">{featureMeta[frame.feature].glyph}</span><span><b>{frame.title}</b><small>{frame.feature}</small></span><kbd>↵</kbd></button>) : <p className="empty-command">No matching features</p>) : (visibleCommands.length ? visibleCommands.map((command, index) => command === 'Search' ? <button key={command} id="action-search" role="menuitem" aria-selected={index === menuFocusIndex} type="button" className={index === menuFocusIndex ? 'selected' : ''} onMouseEnter={() => setMenuFocusIndex(index)} onClick={() => runCommand(command)}><span className="command-glyph">⌕</span><span><b>Search</b><small>Find an existing feature</small></span><kbd>↵</kbd></button> : <button key={command} id={`action-${command.replaceAll(' ', '-')}`} role="menuitem" aria-selected={index === menuFocusIndex} type="button" className={index === menuFocusIndex ? 'selected' : ''} onMouseEnter={() => setMenuFocusIndex(index)} onClick={() => runCommand(command)}><span className="command-glyph">{featureMeta[command].glyph}</span><span><b>{featureMeta[command].frame.title}</b><small>{featureMeta[command].description}</small></span><kbd>↵</kbd></button>) : <p className="empty-command">No matching actions</p>)}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  )
}

export default App
