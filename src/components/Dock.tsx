import type { Feature } from '../types'
import { featureMeta } from '../constants'

interface DockProps {
  focusedSide: string
  withinSide: boolean
  rightItemRefs: Record<string, HTMLButtonElement | null>
  profileRef: React.RefObject<HTMLButtonElement | null>
  framesCountByFeature: Record<Feature, number>
  compactMode: boolean
  setCompactMode: (value: boolean) => void
  setRightFocusIndex: (index: number) => void
  onFeaturePress: (feature: Feature) => void
}

export function Dock({
  focusedSide,
  withinSide,
  rightItemRefs,
  profileRef,
  framesCountByFeature,
  compactMode,
  setCompactMode,
  setRightFocusIndex,
  onFeaturePress,
}: DockProps) {
  const features = Object.keys(featureMeta) as Feature[]

  return (
    <aside
      className={`side-region right-side ${focusedSide === 'right' ? 'side-focused' : ''} ${
        focusedSide === 'right' && withinSide ? 'within-focused' : ''
      }`}
      aria-label="Settings and utilities"
      tabIndex={0}
    >
      <div className="right-group profile-group">
        <button
          ref={(node) => {
            profileRef.current = node
            rightItemRefs.profile = node
          }}
          type="button"
          className="setting"
          onFocus={() => setRightFocusIndex(0)}
          onClick={() => setRightFocusIndex(0)}
        >
          <span>◉</span>
          <span>
            <b>Profile</b>
            <small>Personal space</small>
          </span>
        </button>
      </div>
      <div className="right-group feature-group">
        <div className="feature-links">
          {features.map((feature, index) => {
            const dockIndex = index + 1
            return (
              <button
                key={feature}
                ref={(node) => {
                  rightItemRefs[`feature-${feature}`] = node
                }}
                type="button"
                className="setting"
                onFocus={() => setRightFocusIndex(dockIndex)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    event.stopPropagation()
                    onFeaturePress(feature)
                    setRightFocusIndex(dockIndex)
                  }
                }}
                onClick={() => {
                  onFeaturePress(feature)
                  setRightFocusIndex(dockIndex)
                }}
              >
                <span>{featureMeta[feature].glyph}</span>
                <span>
                  <b>{featureMeta[feature].frame.title}</b>
                  <small>
                    {feature === 'pomodoro'
                      ? 'Open timer'
                      : `${framesCountByFeature[feature]} entries`}
                  </small>
                </span>
              </button>
            )
          })}
        </div>
      </div>
      <div className="right-group settings-group">
        <button
          ref={(node) => {
            rightItemRefs.settings = node
          }}
          type="button"
          className="setting"
          onFocus={() => setRightFocusIndex(features.length + 1)}
          onClick={() => {
            setCompactMode(!compactMode)
            setRightFocusIndex(features.length + 1)
          }}
        >
          <span>⚙</span>
          <span>
            <b>Settings</b>
            <small>{compactMode ? 'Compact on' : 'Preferences'}</small>
          </span>
        </button>
      </div>
      <div className="right-group logout-group">
        <button
          ref={(node) => {
            rightItemRefs.logout = node
          }}
          type="button"
          className="setting"
          onFocus={() => setRightFocusIndex(features.length + 2)}
          onClick={() => setRightFocusIndex(features.length + 2)}
        >
          <span>↪</span>
          <span>
            <b>Log out</b>
            <small>End session</small>
          </span>
        </button>
      </div>
    </aside>
  )
}
