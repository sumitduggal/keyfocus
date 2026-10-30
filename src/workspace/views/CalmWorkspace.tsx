import type { KeyboardEvent } from "react";
import { NowPlaying } from "../../components/NowPlaying";
import { FramePreview } from "../../components/FramePreview";
import { featureMeta, visibleFeatures } from "../../constants";
import { formatClock } from "../../pomodoro";
import { nextTrigger, summarise, toDate } from "../../reminders";
import type { TodoItem, TodoPriority } from "../../todo";
import type { WorkspaceFrame } from "../../types";
import type { WorkspaceView } from "../view";
import { ActiveFrame, WorkspaceCommandPalette, WorkspaceOverlays } from "../WorkspaceParts";
import "./CalmWorkspace.css";

const priorityRank: Record<TodoPriority, number> = { high: 0, medium: 1, low: 2 };

const featureNames = Object.fromEntries(
  visibleFeatures.map((feature) => [feature, featureMeta[feature].frame.title]),
);

const keepNativeButtonEnter = (event: KeyboardEvent<HTMLElement>) => {
  if (event.key === "Enter" && (event.target as HTMLElement).closest("button")) {
    event.stopPropagation();
  }
};

function focusStatus(workspace: WorkspaceView) {
  const { phase, remainingSec } = workspace.pomodoro;
  if (phase === "running") return `Focus in progress · ${formatClock(remainingSec)}`;
  if (phase === "paused") return `Focus paused · ${formatClock(remainingSec)}`;
  if (phase === "complete") return "Focus session complete";
  return "Ready when you are";
}

function reminderTime(stamp: string) {
  const date = toDate(stamp);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return date.toLocaleString(undefined, {
    weekday: sameDay ? undefined : "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CalmWorkspace({ workspace }: { workspace: WorkspaceView }) {
  const {
    activeFrame,
    stackedFrames,
    frameData,
    todoLists,
    framesCountByFeature,
    todoOpenCount,
    todoOverdueCount,
    focusedSide,
    withinSide,
    stackFocusIndex,
    stackCollapsed,
    dockCollapsed,
    barActive,
    registerItem,
    registerStack,
    registerSide,
    setBarHost,
    onToggleStack,
    onToggleDock,
    onStackSelect,
    onPromoteStackFrame,
    onMainFocus,
    onOpenSettings,
    onFeaturePress,
    onShowFrame,
    onSideSelect,
    onRightFocus,
  } = workspace;

  const priorities = workspace.frames
    .filter((frame) => frame.feature === "todo list")
    .flatMap((frame) =>
      (todoLists[frame.id] ?? [])
        .filter((item) => !item.done)
        .map((item) => ({ frame, item })),
    )
    .sort(
      (a, b) =>
        priorityRank[a.item.priority] - priorityRank[b.item.priority] ||
        (a.item.due ?? "￿").localeCompare(b.item.due ?? "￿") ||
        a.item.text.localeCompare(b.item.text),
    );

  const reminderSummary = summarise(Object.values(frameData.reminders));
  const nextReminder = reminderSummary.next;
  const nextReminderFrame = nextReminder
    ? workspace.frames.find((frame) =>
        frameData.reminders[frame.id]?.reminders.some((reminder) => reminder.id === nextReminder.id),
      )
    : undefined;
  const nextReminderAt = nextReminder ? nextTrigger(nextReminder) : null;
  const today = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(frameData.today);

  const selectSide = (side: "left" | "right") => {
    if (focusedSide !== side) onSideSelect(side);
  };

  return (
    <main className="calm-workspace" data-workspace-view="calm" aria-label="Calm Workspace">
      <header className="calm-topbar">
        <div className="calm-brand" aria-label="Keyfocus">
          <span className="calm-brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
          <span>keyfocus</span>
        </div>
        <div className="calm-date"><span>Your workspace</span><strong>{today}</strong></div>
        <div className="calm-top-actions">
          <span className="calm-frame-count">{workspace.frames.length} {workspace.frames.length === 1 ? "frame" : "frames"}</span>
          <button type="button" className="calm-theme-button" onClick={workspace.onToggleTheme} aria-label={`Switch to ${workspace.theme === "dark" ? "light" : "dark"} theme`}>
            {workspace.theme === "dark" ? "☼" : "☾"}
          </button>
        </div>
      </header>

      <div className={`calm-layout${stackCollapsed ? " nav-collapsed" : ""}${dockCollapsed ? " context-collapsed" : ""}`}>
        <aside
          ref={(node) => registerSide("left", node)}
          className={`calm-sidebar${focusedSide === "left" && !barActive ? " is-side-focused" : ""}${focusedSide === "left" && withinSide && !barActive ? " is-within-focused" : ""}`}
          aria-label="Workspace navigation and recent frames"
          tabIndex={0}
          onFocusCapture={() => selectSide("left")}
        >
          <div className="calm-region-heading">
            <p className="calm-label">Workspace</p>
            <button type="button" className="calm-region-toggle" onKeyDown={keepNativeButtonEnter} onClick={onToggleStack} aria-label={stackCollapsed ? "Show navigation" : "Hide navigation"} aria-expanded={!stackCollapsed}>
              {stackCollapsed ? "›" : "‹"}
            </button>
          </div>
          <nav className="calm-nav" aria-label="Features" onKeyDownCapture={keepNativeButtonEnter}>
            {visibleFeatures.map((feature, index) => (
              <button
                key={feature}
                ref={(node) => registerItem(`feature-${feature}`, node)}
                type="button"
                className={activeFrame.feature === feature ? "is-active" : undefined}
                aria-current={activeFrame.feature === feature ? "page" : undefined}
                title={featureNames[feature]}
                onFocus={() => onRightFocus(index)}
                onClick={() => onFeaturePress(feature)}
              >
                <span className="calm-nav-glyph" aria-hidden="true">{featureMeta[feature].glyph}</span>
                <span>{featureNames[feature]}</span>
                <small>{feature === "todo list" ? todoOpenCount : framesCountByFeature[feature]}</small>
              </button>
            ))}
          </nav>

          <section className="calm-recent" aria-labelledby="calm-recent-heading">
            <div className="calm-recent-heading">
              <p className="calm-label" id="calm-recent-heading">Recent frames</p>
              <span>{stackedFrames.length}</span>
            </div>
            {stackedFrames.length === 0 ? (
              <div className="calm-empty calm-stack-empty">
                <strong>No recent frames</strong>
                <p>Open another feature and it will appear here when you move on.</p>
              </div>
            ) : (
              <ol className="calm-stack-list">
                {stackedFrames.map((frame, index) => (
                  <li key={frame.id}>
                    <button
                      ref={(node) => registerStack(frame.id, node)}
                      type="button"
                      tabIndex={-1}
                      className={index === stackFocusIndex ? "is-previewed" : undefined}
                      aria-label={`Promote frame: ${frame.title}`}
                      onFocus={() => onStackSelect(index)}
                      onClick={() => onPromoteStackFrame(index)}
                    >
                      <span className="calm-recent-icon" aria-hidden="true">{featureMeta[frame.feature].glyph}</span>
                      <span className="calm-recent-copy"><strong>{frame.title}</strong><small>{frame.feature}</small></span>
                      <span className="calm-stack-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                      <span className="calm-stack-preview" aria-hidden="true"><FramePreview frame={frame} data={frameData} /></span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <button
            ref={(node) => registerItem("settings", node)}
            type="button"
            className="calm-settings"
            data-settings-toggle
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.stopPropagation();
                onOpenSettings();
              }
            }}
            onFocus={() => onRightFocus(visibleFeatures.length)}
            onClick={onOpenSettings}
          >
            <span aria-hidden="true">⚙</span><span>Settings</span><span aria-hidden="true">›</span>
          </button>
        </aside>

        <section
          ref={(node) => registerSide("main", node)}
          className={`calm-main${focusedSide === "main" && !barActive ? " is-side-focused" : ""}${focusedSide === "main" && withinSide && !barActive ? " is-within-focused" : ""}`}
          aria-label="Active frame"
          tabIndex={0}
          onFocusCapture={onMainFocus}
        >
          <div className="calm-heading">
            <div><span className="calm-eyebrow">{activeFrame.feature} · Active frame</span><h1>One thing at a time.</h1></div>
            <span className={`calm-ready is-${workspace.pomodoro.phase}`}><i />{focusStatus(workspace)}</span>
          </div>
          <div className="calm-active-frame"><ActiveFrame workspace={workspace} /></div>
        </section>

        <aside
          ref={(node) => registerSide("right", node)}
          className={`calm-context${focusedSide === "right" && !barActive ? " is-side-focused" : ""}${focusedSide === "right" && withinSide && !barActive ? " is-within-focused" : ""}`}
          aria-label="Priorities, next reminder and music"
          tabIndex={0}
          onFocusCapture={() => selectSide("right")}
          onKeyDownCapture={keepNativeButtonEnter}
        >
          <div className="calm-region-heading calm-context-heading">
            <p className="calm-label">Context</p>
            <button type="button" className="calm-region-toggle" onClick={onToggleDock} aria-label={dockCollapsed ? "Show context" : "Hide context"} aria-expanded={!dockCollapsed}>
              {dockCollapsed ? "‹" : "›"}
            </button>
          </div>
          <div className="calm-context-content">
            <section className="calm-tasks" aria-labelledby="calm-priorities-heading">
              <header><div><span className="calm-eyebrow">Open todos</span><h2 id="calm-priorities-heading">Your priorities</h2></div><span>{todoOpenCount}{todoOverdueCount > 0 ? ` · ${todoOverdueCount} overdue` : ""}</span></header>
              {priorities.length === 0 ? (
                <div className="calm-empty"><strong>Nothing open</strong><p>Your open todo items will appear here.</p></div>
              ) : (
                <ol className="calm-priority-list">
                  {priorities.slice(0, 5).map(({ frame, item }: { frame: WorkspaceFrame; item: TodoItem }) => (
                    <li key={`${frame.id}:${item.id}`}>
                      <button type="button" onClick={() => onShowFrame(frame.id)} title={`Open ${frame.title}`}>
                        <span className={`calm-priority-mark is-${item.priority}`} aria-hidden="true" />
                        <span><strong>{item.text}</strong><small>{frame.title}{item.due ? ` · ${item.due}` : ""}</small></span>
                        <span className={`calm-priority-label is-${item.priority}`}>{item.priority}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
              <button type="button" className="calm-text-action" onClick={() => onFeaturePress("todo list")}>{priorities.length ? "Open todo lists" : "Create a todo list"}<span aria-hidden="true">→</span></button>
            </section>

            <section className="calm-upnext" aria-labelledby="calm-upnext-heading">
              <span className="calm-eyebrow" id="calm-upnext-heading">Up next</span>
              {nextReminder && nextReminderAt ? (
                <button type="button" onClick={() => nextReminderFrame ? onShowFrame(nextReminderFrame.id) : onFeaturePress("reminders")}>
                  <span className="calm-calendar" aria-hidden="true"><strong>{toDate(nextReminderAt).getDate()}</strong><small>{toDate(nextReminderAt).toLocaleDateString("en-GB", { month: "short" })}</small></span>
                  <span><strong>{nextReminder.text}</strong><small>{reminderTime(nextReminderAt)}</small></span>
                  <span aria-hidden="true">›</span>
                </button>
              ) : (
                <div className="calm-empty"><strong>No upcoming reminders</strong><p>Your next scheduled reminder will appear here.</p></div>
              )}
              <button type="button" className="calm-text-action" onClick={() => onFeaturePress("reminders")}>{nextReminder ? "Open reminders" : "Add a reminder"}<span aria-hidden="true">→</span></button>
            </section>

            <section className="calm-music" aria-label="Focus music">
              <span className="calm-eyebrow">Now playing</span>
              <NowPlaying />
            </section>
          </div>
        </aside>
      </div>

      <footer className="calm-footer">
        <div className="calm-key-hints"><span><kbd>Alt</kbd><kbd>←</kbd><kbd>→</kbd> Side</span><span><kbd>↵</kbd> Open</span></div>
        <div className="calm-command-host" ref={setBarHost} />
        <span className="calm-saved"><i /> Everything is saved locally</span>
      </footer>
      <WorkspaceCommandPalette workspace={workspace} />
      <WorkspaceOverlays workspace={workspace} />
    </main>
  );
}
