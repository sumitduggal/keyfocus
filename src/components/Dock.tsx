import { useSyncExternalStore } from "react";
import type { Feature } from "../types";
import { featureMeta, visibleFeatures } from "../constants";
import { NowPlaying } from "./NowPlaying";
import { formatClock, getPomodoroState, subscribePomodoro, type PomodoroState } from "../pomodoro";
import "../components.css";

// The Pomodoro entry shows the timer while one is under way.
function pomodoroLabel({ phase, remainingSec }: PomodoroState): string {
  if (phase === "running") return `${formatClock(remainingSec)} left`;
  if (phase === "paused") return `Paused · ${formatClock(remainingSec)}`;
  return phase === "complete" ? "Complete" : "Open timer";
}

interface DockProps {
  registerItem: (id: string, node: HTMLButtonElement | null) => void;
  framesCountByFeature: Record<Feature, number>;
  todoOpenCount: number;
  todoOverdueCount: number;
  activeFeature: Feature;
  onOpenSettings: () => void;
  setRightFocusIndex: (index: number) => void;
  onFeaturePress: (feature: Feature, trigger?: HTMLElement) => void;
}

export function Dock({
  registerItem,
  framesCountByFeature,
  todoOpenCount,
  todoOverdueCount,
  activeFeature,
  onOpenSettings,
  setRightFocusIndex,
  onFeaturePress,
}: DockProps) {
  const features = visibleFeatures;
  const pomodoro = useSyncExternalStore(subscribePomodoro, getPomodoroState);

  return (
    <div className="dock">
      <p className="dock-section">
        Features <span>{String(features.length).padStart(2, "0")}</span>
      </p>

      <div className="dock-list">
        {features.map((feature, index) => {
          const dockIndex = index;
          return (
            <button
              key={feature}
              ref={(node) => {
                registerItem(`feature-${feature}`, node);
              }}
              type="button"
              title={featureMeta[feature].frame.title}
              className={`dock-item ${feature === activeFeature ? "is-active" : ""}${feature === "pomodoro" && pomodoro.phase === "running" ? " is-timing" : ""}`}
              onFocus={() => setRightFocusIndex(dockIndex)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  event.stopPropagation();
                  onFeaturePress(feature, event.currentTarget);
                  setRightFocusIndex(dockIndex);
                }
              }}
              onClick={(event) => {
                onFeaturePress(feature, event.currentTarget);
                setRightFocusIndex(dockIndex);
              }}
            >
              <span className="dock-index">{String(dockIndex + 1).padStart(2, "0")}</span>
              <span className="dock-glyph" aria-hidden="true">
                {featureMeta[feature].glyph}
              </span>
              <span className="dock-copy">
                <b>{featureMeta[feature].frame.title}</b>
                <small>
                  {feature === "pomodoro"
                    ? pomodoroLabel(pomodoro)
                    : feature === "todo list"
                      ? `${todoOpenCount} open${todoOverdueCount ? ` · ${todoOverdueCount} overdue` : ""}`
                      : `${framesCountByFeature[feature]} entries`}
                </small>
              </span>
              <span className="dock-chevron" aria-hidden="true">
                ›
              </span>
            </button>
          );
        })}
      </div>

      <div className="dock-foot">
        <NowPlaying />

        <button
          ref={(node) => {
            registerItem("settings", node);
          }}
          type="button"
          className="dock-item is-quiet"
          title="Settings"
          data-settings-toggle
          onFocus={() => setRightFocusIndex(features.length)}
          onClick={() => {
            onOpenSettings();
            setRightFocusIndex(features.length);
          }}
        >
          <span className="dock-glyph" aria-hidden="true">
            ⚙
          </span>
          <span className="dock-copy">
            <b>Settings</b>
            <small>Appearance, timer alerts</small>
          </span>
          <span className="dock-chevron" aria-hidden="true">
            ›
          </span>
        </button>
      </div>
    </div>
  );
}
