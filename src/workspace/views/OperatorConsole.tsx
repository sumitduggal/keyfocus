import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Stack } from "../../components/Stack";
import { Dock } from "../../components/Dock";
import { Weather } from "../../components/Weather";
import { HudReminders } from "../../components/ReminderBanner";
import { formatClock } from "../../pomodoro";
import type { Side } from "../../types";
import type { WorkspaceView } from "../view";
import { ActiveFrame, WorkspaceCommandPalette, WorkspaceOverlays } from "../WorkspaceParts";

const pad = (value: number) => String(value).padStart(2, "0");

const sideTabs: { side: Side; label: string }[] = [
  { side: "left", label: "Frames" },
  { side: "main", label: "Active" },
  { side: "right", label: "Features" },
];

function HudClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tick = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  const stamp = now
    .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    .toUpperCase()
    .replaceAll(" ", "-");
  const clock = now.toLocaleTimeString("en-GB", { hour12: false });

  return (
    <div className="hud-status-time">
      {stamp} <span>//</span> {clock}
    </div>
  );
}

export function OperatorConsole({ workspace }: { workspace: WorkspaceView }) {
  const {
    frames,
    activeFrame,
    stackedFrames,
    pomodoro,
    settings,
    frameData,
    framesCountByFeature,
    todoOpenCount,
    todoOverdueCount,
    focusedSide,
    withinSide,
    stackFocusIndex,
    dockCollapsed,
    stackCollapsed,
    barActive,
    reduceMotion,
    registerItem,
    registerStack,
    registerSide,
    setBarHost,
    onToggleStack,
    onToggleDock,
    onStackSelect,
    onPromoteStackFrame,
    onMainFocus,
    onOpenFeatureDirectly,
    onOpenSettings,
    onFeaturePress,
    onSideSelect,
    onRightFocus,
  } = workspace;

  return (
    <main className="app" data-workspace-view="operator">
      <div className="stage">
        <div className="hud-backdrop" aria-hidden="true" />
        <span className="hud-corner tl" aria-hidden="true" />
        <span className="hud-corner tr" aria-hidden="true" />
        <span className="hud-corner bl" aria-hidden="true" />
        <span className="hud-corner br" aria-hidden="true" />

        <header className="hud-top">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              <i />
            </span>
            <span className="brand-copy">
              <span className="brand-title">Keyfocus</span>
              <span className="brand-sub">Focus space // canvas 01</span>
            </span>
          </div>

          <div className="hud-readout">
            {pomodoro.phase === "idle" ? (
              <span aria-hidden="true">
                <i>Mode</i>Deep focus
              </span>
            ) : (
              <button
                type="button"
                className={`hud-pomodoro is-${pomodoro.phase}`}
                aria-label={`Pomodoro ${pomodoro.phase === "complete" ? "complete" : `${pomodoro.phase}, ${formatClock(pomodoro.remainingSec)} left`}. Open timer`}
                onClick={() => onOpenFeatureDirectly("pomodoro")}
                style={{ "--progress": `${(1 - pomodoro.remainingSec / (pomodoro.durationMin * 60)) * 360}deg` } as CSSProperties}
              >
                <div className="hud-pomodoro-ring" aria-hidden="true" />
                <div className="hud-pomodoro-text" aria-hidden="true">
                  <i>{pomodoro.phase === "running" ? "Focus" : pomodoro.phase === "paused" ? "Paused" : "Done"}</i>
                  <b>{pomodoro.phase === "complete" ? "00:00" : formatClock(pomodoro.remainingSec)}</b>
                </div>
              </button>
            )}
            <span aria-hidden="true">
              <i>Frames</i>
              {pad(frames.length)}
            </span>
            <span aria-hidden="true">
              <i>Active</i>
              {activeFrame.feature}
            </span>
          </div>

          <div className="hud-status">
            <Weather unit={settings.temperatureUnit} />
            <HudReminders />
            <HudClock />
          </div>
        </header>

        <div className="canvas">
          <aside
            ref={(node) => registerSide("left", node)}
            className={`side-region left-side${stackCollapsed ? " is-collapsed" : ""} ${focusedSide === "left" && !barActive ? "side-focused" : ""} ${
              focusedSide === "left" && withinSide && !barActive ? "within-focused" : ""
            }`}
            aria-label="Latest frames"
            tabIndex={0}
          >
            <button
              type="button"
              className="stack-toggle"
              aria-label={stackCollapsed ? "Show stack" : "Hide stack"}
              aria-expanded={!stackCollapsed}
              onClick={onToggleStack}
            >
              {stackCollapsed ? "›" : "‹"}
            </button>
            <Stack
              collapsed={stackCollapsed}
              stackedFrames={stackedFrames}
              stackFocusIndex={stackFocusIndex}
              registerStack={registerStack}
              reduceMotion={reduceMotion}
              data={frameData}
              onSelect={onStackSelect}
              onPromote={onPromoteStackFrame}
            />
            <div className="side-readout">
              <div>
                <span>Total frames</span>
                <b>{pad(frames.length)}</b>
              </div>
              <div>
                <span>Active surface</span>
                <b>{activeFrame.feature}</b>
              </div>
            </div>
          </aside>

          <section
            ref={(node) => registerSide("main", node)}
            onFocusCapture={onMainFocus}
            className={`side-region main-side${dockCollapsed ? " dock-collapsed" : ""}${stackCollapsed ? " stack-collapsed" : ""} ${focusedSide === "main" && !barActive ? "side-focused" : ""} ${
              focusedSide === "main" && withinSide && !barActive ? "within-focused" : ""
            }`}
            aria-label="Main frame"
            tabIndex={0}
          >
            <div className="scope" aria-hidden="true">
              <span className="terrain-contours" />
              <span className="terrain-glow terrain-glow-a" />
              <span className="terrain-glow terrain-glow-b" />
            </div>

            <ActiveFrame workspace={workspace} />
          </section>

          <aside
            ref={(node) => registerSide("right", node)}
            className={`side-region right-side${dockCollapsed ? " is-collapsed" : ""} ${focusedSide === "right" && !barActive ? "side-focused" : ""} ${
              focusedSide === "right" && withinSide && !barActive ? "within-focused" : ""
            }`}
            aria-label="Settings and utilities"
            tabIndex={0}
          >
            <button
              type="button"
              className="dock-toggle"
              aria-label={dockCollapsed ? "Show control panel" : "Hide control panel"}
              aria-expanded={!dockCollapsed}
              onClick={onToggleDock}
            >
              {dockCollapsed ? "‹" : "›"}
            </button>
            <Dock
              registerItem={registerItem}
              framesCountByFeature={framesCountByFeature}
              todoOpenCount={todoOpenCount}
              todoOverdueCount={todoOverdueCount}
              activeFeature={activeFrame.feature}
              onOpenSettings={onOpenSettings}
              setRightFocusIndex={onRightFocus}
              onFeaturePress={onFeaturePress}
            />
          </aside>

          <WorkspaceCommandPalette workspace={workspace} />
        </div>

        <nav className="side-tabs" aria-label="Sections">
          {sideTabs.map(({ side, label }) => (
            <button
              key={side}
              type="button"
              aria-current={focusedSide === side}
              onClick={() => onSideSelect(side)}
            >
              {label}
            </button>
          ))}
        </nav>

        <WorkspaceOverlays workspace={workspace} />

        <footer className="hud-bottom">
          <div className="key-hints">
            <span>
              <kbd>⌘K</kbd> Command
            </span>
            <span>
              <kbd>Alt</kbd>
              <kbd>←</kbd>
              <kbd>→</kbd> Side
            </span>
            <span>
              <kbd>↑</kbd>
              <kbd>↓</kbd> Select
            </span>
            <span>
              <kbd>↵</kbd> Promote
            </span>
            <span>
              <kbd>Esc</kbd> Reset
            </span>
          </div>
          <div className="command-slot" ref={setBarHost} />
          <div className="hud-footer-readout">
            <span>{pad(stackedFrames.length)} stacked</span>
            <span className="sep">//</span>
            <span>{activeFrame.feature} live</span>
            <span className="sep">//</span>
            <span>local only</span>
          </div>
        </footer>
      </div>
    </main>
  );
}
