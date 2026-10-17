import { useCallback, useEffect } from 'react'
import type { Feature, WorkspaceFrame } from '../types'
import { featureMeta } from '../constants'

interface FeaturePanelProps {
  featurePanel: Feature
  featureEntries: WorkspaceFrame[]
  featureAnchorY: number | null
  entryFocusIndex: number
  featureAsideRef: React.RefObject<HTMLElement | null>
  featureEntryRefs: Record<string, HTMLButtonElement | null>
  onClose: () => void
  onEntryClick: (frame: WorkspaceFrame) => void
}

export function FeaturePanel({
  featurePanel,
  featureEntries,
  featureAnchorY,
  entryFocusIndex,
  featureAsideRef,
  featureEntryRefs,
  onClose,
  onEntryClick,
}: FeaturePanelProps) {
  useEffect(() => {
    const closeWhenFocusLeaves = (event: FocusEvent) => {
      if (
        featureAsideRef.current &&
        !featureAsideRef.current.contains(event.target as Node)
      ) {
        onClose()
      }
    }
    document.addEventListener('focusin', closeWhenFocusLeaves)
    return () => document.removeEventListener('focusin', closeWhenFocusLeaves)
  }, [featureAsideRef, onClose])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        if (!featureEntries.length) return
        const delta = event.key === 'ArrowDown' ? 1 : -1
        const next = Math.max(0, Math.min(featureEntries.length - 1, entryFocusIndex + delta))
        requestAnimationFrame(() => featureEntryRefs[featureEntries[next]?.id]?.focus())
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = Array.from(
        event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled])'),
      )
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    },
    [featureEntries, entryFocusIndex, featureEntryRefs, onClose],
  )

  return (
    <aside
      ref={featureAsideRef}
      className="feature-aside"
      style={{ top: featureAnchorY ?? '50%' }}
      aria-label={`${featureMeta[featurePanel].frame.title} entries`}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      <div className="feature-aside-heading">
        <span>{featureMeta[featurePanel].glyph}</span>
        <b>{featureMeta[featurePanel].frame.title}</b>
        <button type="button" aria-label="Close feature entries" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="feature-entry-list">
        {featureEntries.length ? (
          featureEntries.map((frame, index) => (
            <button
              key={frame.id}
              ref={(node) => {
                featureEntryRefs[frame.id] = node
              }}
              type="button"
              className={index === entryFocusIndex ? 'entry-selected' : ''}
              onFocus={() => {}}
              onClick={() => onEntryClick(frame)}
            >
              <b>{frame.title}</b>
              <small>{frame.description}</small>
            </button>
          ))
        ) : (
          featureMeta[featurePanel].frame.details.map((entry) => (
            <button key={entry} type="button">
              <b>{entry}</b>
              <small>New entry</small>
            </button>
          ))
        )}
      </div>
    </aside>
  )
}
