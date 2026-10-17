import type { Feature, Theme } from '../types'
import { featureMeta } from '../constants'

interface DockProps {
  rightItemRefs: Record<string, HTMLButtonElement | null>
  profileRef: React.RefObject<HTMLButtonElement | null>
  framesCountByFeature: Record<Feature, number>
  theme: Theme
  onToggleTheme: () => void
  setRightFocusIndex: (index: number) => void
  onFeaturePress: (feature: Feature) => void
}

export function Dock({
  rightItemRefs,
  profileRef,
  framesCountByFeature,
  theme,
  onToggleTheme,
  setRightFocusIndex,
  onFeaturePress,
}: DockProps) {
  const features = Object.keys(featureMeta) as Feature[]

  return (
    <>
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
            onToggleTheme()
            setRightFocusIndex(features.length + 1)
          }}
        >
          <span aria-hidden="true">{theme === 'dark' ? '☾' : '☀'}</span>
          <span>
            <b>Appearance</b>
            <small>{theme === 'dark' ? 'Dark theme · ⌘⇧L' : 'Light theme · ⌘⇧L'}</small>
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
    </>
  )
}
