import type { Feature } from "../types";
import { featureMeta, visibleFeatures } from "../constants";
import { NowPlaying } from "./NowPlaying";
import "../components.css";

interface DockProps {
  registerItem: (id: string, node: HTMLButtonElement | null) => void;
  profileRef: React.RefObject<HTMLButtonElement | null>;
  framesCountByFeature: Record<Feature, number>;
  todoOpenCount: number;
  todoOverdueCount: number;
  activeFeature: Feature;
  onOpenSettings: () => void;
  setRightFocusIndex: (index: number) => void;
  onFeaturePress: (feature: Feature) => void;
}

export function Dock({
  registerItem,
  profileRef,
  framesCountByFeature,
  todoOpenCount,
  todoOverdueCount,
  activeFeature,
  onOpenSettings,
  setRightFocusIndex,
  onFeaturePress,
}: DockProps) {
  const features = visibleFeatures;

  return (
    <div className="dock">
      <button
        ref={(node) => {
          profileRef.current = node;
          registerItem("profile", node);
        }}
        type="button"
        className="dock-profile"
        title="Operator"
        onFocus={() => setRightFocusIndex(0)}
        onClick={() => setRightFocusIndex(0)}
      >
        <span className="dock-avatar" aria-hidden="true">
          OP
        </span>
        <span className="dock-copy">
          <b>Operator</b>
          <small>Local session</small>
        </span>
        <span className="dock-pip" aria-hidden="true" />
      </button>

      <p className="dock-section">
        Features <span>{String(features.length).padStart(2, "0")}</span>
      </p>

      <div className="dock-list">
        {features.map((feature, index) => {
          const dockIndex = index + 1;
          return (
            <button
              key={feature}
              ref={(node) => {
                registerItem(`feature-${feature}`, node);
              }}
              type="button"
              title={featureMeta[feature].frame.title}
              className={`dock-item ${feature === activeFeature ? "is-active" : ""}`}
              onFocus={() => setRightFocusIndex(dockIndex)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  event.stopPropagation();
                  onFeaturePress(feature);
                  setRightFocusIndex(dockIndex);
                }
              }}
              onClick={() => {
                onFeaturePress(feature);
                setRightFocusIndex(dockIndex);
              }}
            >
              <span className="dock-index">{String(dockIndex).padStart(2, "0")}</span>
              <span className="dock-glyph" aria-hidden="true">
                {featureMeta[feature].glyph}
              </span>
              <span className="dock-copy">
                <b>{featureMeta[feature].frame.title}</b>
                <small>
                  {feature === "pomodoro"
                    ? "Open timer"
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
          onFocus={() => setRightFocusIndex(features.length + 1)}
          onClick={() => {
            onOpenSettings();
            setRightFocusIndex(features.length + 1);
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

        <button
          ref={(node) => {
            registerItem("logout", node);
          }}
          type="button"
          className="dock-item is-quiet"
          title="Log out"
          onFocus={() => setRightFocusIndex(features.length + 2)}
          onClick={() => setRightFocusIndex(features.length + 2)}
        >
          <span className="dock-glyph" aria-hidden="true">
            ↪
          </span>
          <span className="dock-copy">
            <b>Log out</b>
            <small>End session</small>
          </span>
          <span className="dock-chevron" aria-hidden="true">
            ›
          </span>
        </button>
      </div>
    </div>
  );
}
