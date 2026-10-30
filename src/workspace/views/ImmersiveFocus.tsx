import { useState } from "react";
import { NowPlaying } from "../../components/NowPlaying";
import { featureMeta, visibleFeatures } from "../../constants";
import { frameSummary } from "../../frame-summary";
import { formatClock } from "../../pomodoro";
import type { WorkspaceView } from "../view";
import { ActiveFrame, WorkspaceCommandPalette, WorkspaceOverlays } from "../WorkspaceParts";
import "./ImmersiveFocus.css";

export function ImmersiveFocus({ workspace }: { workspace: WorkspaceView }) {
  const {
    activeFrame,
    stackedFrames,
    framesCountByFeature,
    todoOpenCount,
    pomodoro,
    frameData,
    focusedSide,
    withinSide,
    stackFocusIndex,
    barActive,
    registerItem,
    registerStack,
    registerSide,
    setBarHost,
    onStackSelect,
    onPromoteStackFrame,
    onMainFocus,
    onOpenSettings,
    onFeaturePress,
    onRightFocus,
  } = workspace;

  const [recentsOpen, setRecentsOpen] = useState(false);
  const recentsVisible = focusedSide === "left" && (recentsOpen || withinSide);

  const latestLabel = stackedFrames.length === 0
    ? "No stacked frames"
    : `${stackedFrames.length} ${stackedFrames.length === 1 ? "frame" : "frames"}`;

  return (
    <main className="app immersive-shell" data-workspace-view="immersive">
      <div className="immersive-ambient" aria-hidden="true" />

      <header className="immersive-topbar">
        <div className="immersive-brand" aria-label="Keyfocus">
          <span className="immersive-brand-mark" aria-hidden="true">
            <i /><i /><i /><i />
          </span>
          <span>keyfocus</span>
        </div>
        <span className="immersive-mode">
          <i aria-hidden="true" />
          {activeFrame.feature === "pomodoro" ? "Deep focus" : activeFrame.title}
        </span>
      </header>

      <section
        ref={(node) => registerSide("main", node)}
        onFocusCapture={onMainFocus}
        className={`side-region immersive-main ${focusedSide === "main" && !barActive ? "side-focused" : ""} ${focusedSide === "main" && withinSide && !barActive ? "within-focused" : ""}`}
        aria-label="Active frame"
        tabIndex={0}
      >
        <div className={`immersive-active${activeFrame.feature === "pomodoro" ? " is-pomodoro" : ""}`}>
          <ActiveFrame workspace={workspace} />
        </div>
      </section>

      <aside
        ref={(node) => registerSide("left", node)}
        className={`side-region immersive-recents-wrap ${focusedSide === "left" && !barActive ? "side-focused" : ""} ${focusedSide === "left" && withinSide && !barActive ? "within-focused" : ""}`}
        aria-label="Latest opened"
        tabIndex={0}
      >
        <button
          type="button"
          className="immersive-recents"
          aria-expanded={recentsVisible}
          aria-controls="immersive-recent-frames"
          onFocus={() => workspace.onSideSelect("left")}
          onClick={() => setRecentsOpen((current) => !current)}
        >
          <span className="immersive-stack-preview" aria-hidden="true">
            <i /><i />
            <span>{stackedFrames[0] ? featureMeta[stackedFrames[0].feature].glyph : "◇"}</span>
          </span>
          <span className="immersive-recents-copy">
            <small>Latest opened</small>
            <strong>{latestLabel}</strong>
          </span>
          <span className={`immersive-recents-chevron${recentsVisible ? " is-open" : ""}`} aria-hidden="true">›</span>
        </button>

        {recentsVisible && (
          <div className="immersive-recent-popover" id="immersive-recent-frames" role="group" aria-label="Latest opened frames">
            <header>
              <strong>Latest opened</strong>
              <small>{latestLabel}</small>
            </header>
            {stackedFrames.length === 0 ? (
              <div className="immersive-recents-empty">
                <strong>Your active frame is the only one open.</strong>
                <p>Choose another feature below and it will appear here for a quick return.</p>
              </div>
            ) : (
              <ol className="immersive-recent-list">
                {stackedFrames.map((frame, index) => (
                  <li key={frame.id}>
                    <button
                      ref={(node) => registerStack(frame.id, node)}
                      type="button"
                      className={index === stackFocusIndex ? "is-previewed" : undefined}
                      aria-label={`Open frame: ${frame.title}`}
                      title={frameSummary(frame, frameData)}
                      tabIndex={-1}
                      onFocus={() => onStackSelect(index)}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter") return;
                        event.preventDefault();
                        event.stopPropagation();
                        onPromoteStackFrame(index);
                      }}
                      onClick={() => onPromoteStackFrame(index)}
                    >
                      <span className="immersive-recent-icon" aria-hidden="true">{featureMeta[frame.feature].glyph}</span>
                      <span className="immersive-recent-copy">
                        <strong>{frame.title}</strong>
                        <small>{frame.feature} · {frameSummary(frame, frameData)}</small>
                      </span>
                      <span className="immersive-recent-open" aria-hidden="true">›</span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </aside>

      <aside
        ref={(node) => registerSide("right", node)}
        className={`side-region immersive-right ${focusedSide === "right" && !barActive ? "side-focused" : ""} ${focusedSide === "right" && withinSide && !barActive ? "within-focused" : ""}`}
        aria-label="Features, playback and settings"
        tabIndex={0}
      >
        <div className="immersive-header-actions">
          <NowPlaying />
          <button
            ref={(node) => registerItem("settings", node)}
            type="button"
            className="immersive-settings"
            aria-label="Settings"
            title="Settings"
            data-settings-toggle
            onFocus={() => onRightFocus(visibleFeatures.length)}
            onClick={onOpenSettings}
          >
            <span aria-hidden="true">⚙</span>
          </button>
        </div>

        <nav className="immersive-dock" aria-label="Features">
          {visibleFeatures.map((feature, index) => {
            const count = feature === "todo list" ? todoOpenCount : framesCountByFeature[feature];
            return (
              <button
                key={feature}
                ref={(node) => registerItem(`feature-${feature}`, node)}
                type="button"
                className={feature === activeFrame.feature ? "is-active" : undefined}
                aria-pressed={feature === activeFrame.feature}
                title={featureMeta[feature].frame.title}
                onFocus={() => onRightFocus(index)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  event.stopPropagation();
                  onFeaturePress(feature);
                  onRightFocus(index);
                }}
                onClick={() => {
                  onFeaturePress(feature);
                  onRightFocus(index);
                }}
              >
                <span className="immersive-dock-glyph" aria-hidden="true">{featureMeta[feature].glyph}</span>
                <span>{feature === "pomodoro" ? "Focus" : featureMeta[feature].frame.title}</span>
                {feature === "pomodoro" && pomodoro.phase === "running" ? (
                  <small>{formatClock(pomodoro.remainingSec)}</small>
                ) : count > 0 && feature !== "pomodoro" ? (
                  <small aria-label={`${count} ${feature === "todo list" ? "open tasks" : "frames"}`}>{count}</small>
                ) : null}
              </button>
            );
          })}
        </nav>
      </aside>

      <footer className="immersive-footer">
        <div className="immersive-command-slot" ref={setBarHost} />
      </footer>

      <WorkspaceCommandPalette workspace={workspace} />
      <WorkspaceOverlays workspace={workspace} />
    </main>
  );
}
