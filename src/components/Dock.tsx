import type { Feature, Theme } from "../types";
import { featureMeta } from "../constants";
import "../components.css";

interface DockProps {
  rightItemRefs: Record<string, HTMLButtonElement | null>;
  profileRef: React.RefObject<HTMLButtonElement | null>;
  framesCountByFeature: Record<Feature, number>;
  theme: Theme;
  onToggleTheme: () => void;
  setRightFocusIndex: (index: number) => void;
  onFeaturePress: (feature: Feature) => void;
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
  const features = Object.keys(featureMeta) as Feature[];

  return (
    <>
      <div className="border-0 rounded-lg bg-surface p-2 mt-0">
        <button
          ref={(node) => {
            profileRef.current = node;
            rightItemRefs.profile = node;
          }}
          type="button"
          className="grid grid-cols-[20px_1fr] gap-2 w-full mt-1.25 p-2.5 border-0 rounded-lg min-h-14 text-text bg-transparent text-left cursor-pointer hover:bg-surface-2 focus-visible:bg-accent-soft focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-1"
          onFocus={() => setRightFocusIndex(0)}
          onClick={() => setRightFocusIndex(0)}
        >
          <span>◉</span>
          <span>
            <b className="block text-[13px]">Profile</b>
            <small className="block mt-0.5 text-text-faint">Personal space</small>
          </span>
        </button>
      </div>
      <div className="mt-2.5 bg-surface border border-border rounded-lg p-3 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-1">
          {features.map((feature, index) => {
            const dockIndex = index + 1;
            return (
              <button
                key={feature}
                ref={(node) => {
                  rightItemRefs[`feature-${feature}`] = node;
                }}
                type="button"
                className="grid grid-cols-[20px_1fr] gap-2 w-full mt-1.25 p-2.5 border-0 rounded-lg min-h-14 text-text bg-transparent text-left cursor-pointer hover:bg-surface-2 focus-visible:bg-accent-soft focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-1"
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
                <span>{featureMeta[feature].glyph}</span>
                <span>
                  <b className="block text-[13px]">{featureMeta[feature].frame.title}</b>
                  <small className="block mt-0.5 text-text-faint">
                    {feature === "pomodoro"
                      ? "Open timer"
                      : `${framesCountByFeature[feature]} entries`}
                  </small>
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-2.5 bg-surface rounded-lg border-b border-border">
        <button
          ref={(node) => {
            rightItemRefs.settings = node;
          }}
          type="button"
          className="grid grid-cols-[20px_1fr] gap-2 w-full mt-1.25 p-2.5 border-0 rounded-lg min-h-14 text-text bg-transparent text-left cursor-pointer hover:bg-surface-2 focus-visible:bg-accent-soft focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-1"
          onFocus={() => setRightFocusIndex(features.length + 1)}
          onClick={() => {
            onToggleTheme();
            setRightFocusIndex(features.length + 1);
          }}
        >
          <span aria-hidden="true">{theme === "dark" ? "☾" : "☀"}</span>
          <span>
            <b className="block text-[13px]">Appearance</b>
            <small className="block mt-0.5 text-text-faint">
              {theme === "dark" ? "Dark theme · ⌘⇧L" : "Light theme · ⌘⇧L"}
            </small>
          </span>
        </button>
      </div>
      <div className="mt-2.5 bg-surface rounded-lg border-b border-border pb-0">
        <button
          ref={(node) => {
            rightItemRefs.logout = node;
          }}
          type="button"
          className="grid grid-cols-[20px_1fr] gap-2 w-full mt-1.25 p-2.5 border-0 rounded-lg min-h-14 text-text bg-transparent text-left cursor-pointer hover:bg-surface-2 focus-visible:bg-accent-soft focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-1"
          onFocus={() => setRightFocusIndex(features.length + 2)}
          onClick={() => setRightFocusIndex(features.length + 2)}
        >
          <span>↪</span>
          <span>
            <b className="block text-[13px]">Log out</b>
            <small className="block mt-0.5 text-text-faint">End session</small>
          </span>
        </button>
      </div>
    </>
  );
}
