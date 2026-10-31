import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties, MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { domainOf } from "../../bookmarks";
import { NowPlaying } from "../../components/NowPlaying";
import { Weather } from "../../components/Weather";
import { formatDuration, totals } from "../../focus-log";
import { getFocusLog, subscribeFocusLog } from "../../focus-log-store";
import {
  addDays,
  dayKey,
  heatMap,
  localFirstDay,
  weekProgress,
  type Habit,
} from "../../habits";
import { formatClock } from "../../pomodoro";
import { isOverdue, nextTrigger, toDate, toStamp, type Reminder } from "../../reminders";
import type { TodoItem } from "../../todo";
import type { Feature, WorkspaceFrame } from "../../types";
import { ActiveFrame, WorkspaceCommandPalette, WorkspaceOverlays } from "../WorkspaceParts";
import type { WorkspaceView } from "../view";
import "./DailyOverview.css";

type IconName = "arrow" | "bell" | "bookmark" | "check" | "note" | "search" | "settings" | "timer";

const priorityRank = { high: 0, medium: 1, low: 2 };
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    arrow: <path d="M5 12h14M14 7l5 5-5 5" />,
    bell: <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />,
    bookmark: <path d="M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18l-6-4-6 4Z" />,
    check: <><rect x="3" y="3" width="18" height="18" rx="5" /><path d="m7.5 12 3 3 6-7" /></>,
    note: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M8 13h8M8 17h5" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a8 8 0 0 0-1.7-1L14.5 3h-5L9 6.1a8 8 0 0 0-1.7 1l-2.4-1-2 3.4L5 11a7 7 0 0 0 0 2l-2.1 1.5 2 3.4 2.4-1a8 8 0 0 0 1.7 1l.5 3.1h5l.4-3.1a8 8 0 0 0 1.7-1l2.4 1 2-3.4L19 13a7 7 0 0 0 0-1Z" /></>,
    timer: <><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 1.5M9 2h6M12 2v3" /></>,
  };
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

function TileHeader({ eyebrow, title, aside }: { eyebrow: string; title: string; aside?: ReactNode }) {
  return (
    <header className="overview-tile-header">
      <div><span className="overview-eyebrow">{eyebrow}</span><h2>{title}</h2></div>
      {aside}
    </header>
  );
}

function OpenButton({ children, onClick }: { children: ReactNode; onClick: (event: ReactMouseEvent<HTMLButtonElement>) => void }) {
  return <button type="button" className="overview-open" onClick={onClick}>{children}<Icon name="arrow" size={15} /></button>;
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="overview-empty">{children}</p>;
}

function cleanNoteText(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function editorText(value: unknown): string {
  if (typeof value === "string") return cleanNoteText(value);
  if (Array.isArray(value)) return value.map(editorText).filter(Boolean).join(" ");
  if (typeof value !== "object" || value === null) return "";
  const data = value as Record<string, unknown>;
  return [data.text, data.content, data.items].map(editorText).filter(Boolean).join(" ");
}

function noteExcerpt(raw: string | undefined): string {
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw) as { blocks?: { data?: unknown }[] };
    if (Array.isArray(parsed.blocks)) {
      return parsed.blocks.map((block) => editorText(block.data)).filter(Boolean).join(" ").slice(0, 360);
    }
  } catch {
    // Older notes are plain text.
  }
  return cleanNoteText(raw).slice(0, 360);
}

function reminderLabel(stamp: string, today: Date): string {
  const day = stamp.slice(0, 10);
  const time = stamp.slice(11, 16);
  const todayKey = dayKey(today);
  if (day === todayKey) return `Today · ${time}`;
  if (day === addDays(todayKey, 1)) return `Tomorrow · ${time}`;
  const date = toDate(stamp).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return `${date} · ${time}`;
}

export function DailyOverview({ workspace }: { workspace: WorkspaceView }) {
  const {
    frames,
    activeFrame,
    frameData,
    noteBodies,
    todoLists,
    habitLists,
    pomodoro,
    registerItem,
    registerSide,
    setBarHost,
    actionInputRef,
    onMainFocus,
    onOpenFeatureDirectly,
    onFeaturePress,
    onOpenSettings,
    onShowFrame,
  } = workspace;
  const [frameOpen, setFrameOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const focusLog = useSyncExternalStore(subscribeFocusLog, getFocusLog);
  const today = frameData.today;
  const focusTotals = totals(focusLog, today).today;
  const firstDay = localFirstDay();

  const todoFrames = frames.filter((frame) => frame.feature === "todo list");
  const todoEntries = todoFrames.flatMap((frame) =>
    (todoLists[frame.id] ?? []).map((item) => ({ frame, item })),
  );
  const openTodos = todoEntries
    .filter(({ item }) => !item.done)
    .sort((a, b) =>
      priorityRank[a.item.priority] - priorityRank[b.item.priority] ||
      (a.item.due ?? "￿").localeCompare(b.item.due ?? "￿"),
    );
  const todosDone = todoEntries.length - openTodos.length;
  const todoProgress = todoEntries.length ? Math.round((todosDone / todoEntries.length) * 100) : 0;

  const habits = Object.entries(habitLists).flatMap(([frameId, list]) =>
    list.filter((habit) => !habit.archived).map((habit) => ({ frameId, habit })),
  );
  const habitsDoneToday = habits.filter(({ habit }) => habit.done.includes(dayKey(today))).length;

  const reminderEntries = Object.entries(frameData.reminders).flatMap(([frameId, list]) =>
    list.reminders.map((reminder) => ({ frameId, reminder })),
  );
  const nowStamp = toStamp(today);
  const upcoming = reminderEntries
    .map((entry) => ({ ...entry, trigger: nextTrigger(entry.reminder) }))
    .filter((entry): entry is { frameId: string; reminder: Reminder; trigger: string } =>
      entry.reminder.firedAt === null && entry.trigger !== null && entry.trigger >= nowStamp,
    )
    .sort((a, b) => a.trigger.localeCompare(b.trigger));
  const overdueReminders = reminderEntries.filter(({ reminder }) => isOverdue(reminder)).length;

  const notes = frames.filter((frame) => frame.feature === "notes").slice(0, 2);
  const bookmarks = frameData.library.bookmarks
    .filter((bookmark) => bookmark.trashedAt === null)
    .sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.created.localeCompare(a.created))
    .slice(0, 3);
  const bookmarkCount = frameData.library.bookmarks.filter((bookmark) => bookmark.trashedAt === null).length;

  const openFrame = (action: () => void) => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setFrameOpen(true);
    action();
  };
  const openFeature = (feature: Feature) => openFrame(() => onOpenFeatureDirectly(feature));
  const showFrame = (id: string) => openFrame(() => onShowFrame(id));
  const closeFrame = () => {
    setFrameOpen(false);
    window.requestAnimationFrame(() => returnFocusRef.current?.focus());
  };

  useEffect(() => {
    if (!frameOpen || !dialogRef.current) return;
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [frameOpen]);

  const timerProgress = Math.min(1, Math.max(0, 1 - pomodoro.remainingSec / Math.max(1, pomodoro.durationMin * 60)));
  const timerStatus = {
    idle: "Ready for a focus session",
    running: "Focus in progress",
    paused: "Session paused",
    complete: "Session complete",
  }[pomodoro.phase];
  const dateLabel = today.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

  return (
    <main className="daily-overview" data-workspace-view="overview">
      <header className="overview-topbar">
        <div className="overview-brand" aria-label="Keyfocus">
          <span className="overview-logo" aria-hidden="true"><i /><i /><i /><i /></span>
          <span>keyfocus</span>
        </div>
        <nav ref={(node) => registerSide("left", node)} className="overview-nav" aria-label="Workspace features" tabIndex={0}>
          <button type="button" className="is-active" aria-current="page">Overview</button>
          <button ref={(node) => registerItem("feature-todo list", node)} type="button" onClick={(event) => todoFrames[0] ? showFrame(todoFrames[0].id) : onFeaturePress("todo list", event.currentTarget)}>Tasks</button>
          <button ref={(node) => registerItem("feature-habits", node)} type="button" onClick={() => openFeature("habits")}>Habits</button>
          <button ref={(node) => registerItem("feature-bookmarks", node)} type="button" onClick={() => openFeature("bookmarks")}>Library</button>
        </nav>
        <div ref={(node) => registerSide("right", node)} className="overview-top-actions" tabIndex={0}>
          <Weather unit={workspace.settings.temperatureUnit} />
          <button type="button" className="overview-icon-button" aria-label="Search or run a command" onClick={() => actionInputRef.current?.focus()}><Icon name="search" /></button>
          <button ref={(node) => registerItem("feature-reminders", node)} type="button" className="overview-icon-button" aria-label={`Open reminders${overdueReminders ? `, ${overdueReminders} overdue` : ""}`} onClick={() => openFeature("reminders")}>
            <Icon name="bell" />{overdueReminders > 0 && <span className="overview-notification" aria-hidden="true" />}
          </button>
          <button ref={(node) => registerItem("settings", node)} type="button" className="overview-icon-button" aria-label="Open settings" data-settings-toggle onClick={onOpenSettings}><Icon name="settings" /></button>
        </div>
      </header>

      <div ref={(node) => registerSide("main", node)} className="overview-main" onFocusCapture={onMainFocus} tabIndex={0}>
        <section className="overview-welcome" aria-labelledby="overview-title">
          <div className="overview-welcome-copy">
            <span className="overview-eyebrow">{dateLabel}</span>
            <h1 id="overview-title">Make today count.</h1>
            <p>{openTodos.length || upcoming.length ? `${plural(openTodos.length, "open priority").replace("priority", "priorities")} · ${plural(upcoming.length, "upcoming reminder")}` : "Your workspace, at a glance."}</p>
          </div>
          <button type="button" className="overview-stats" onClick={() => openFeature("pomodoro")} aria-label="Open Pomodoro and Focus Log">
            <span><small>Completed focus</small><strong>{formatDuration(focusTotals.completedSeconds)}</strong><em>Today</em></span>
            <span><small>Sessions</small><strong>{String(focusTotals.sessions).padStart(2, "0")}</strong><em>Completed today</em></span>
            <span><small>Partial focus</small><strong>{formatDuration(focusTotals.partialSeconds)}</strong><em>Recorded separately</em></span>
          </button>
        </section>

        <div className="overview-grid">
          <section className="overview-card overview-priorities" aria-labelledby="overview-priorities-title">
            <TileHeader eyebrow="Plan" title="Open priorities" aside={<span className="overview-count">{openTodos.length}</span>} />
            <span id="overview-priorities-title" className="overview-sr-only">Open priorities</span>
            {todoEntries.length > 0 && (
              <div className="overview-progress" aria-label={`${todosDone} of ${todoEntries.length} tasks complete`}>
                <span><i style={{ width: `${todoProgress}%` }} /></span><small>{todosDone} / {todoEntries.length} complete</small>
              </div>
            )}
            <div className="overview-todo-list">
              {openTodos.slice(0, 4).map(({ frame, item }: { frame: WorkspaceFrame; item: TodoItem }) => (
                <button type="button" className="overview-todo" key={`${frame.id}:${item.id}`} onClick={() => showFrame(frame.id)}>
                  <span className={`overview-priority is-${item.priority}`} aria-label={`${item.priority} priority`} />
                  <span><strong>{item.text}</strong><small>{frame.title}{item.due ? ` · Due ${item.due === dayKey(today) ? "today" : toDate(`${item.due}T00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" })}` : ""}</small></span>
                  <Icon name="arrow" size={15} />
                </button>
              ))}
              {openTodos.length === 0 && <Empty>{todoEntries.length ? "Everything on your lists is complete." : "No tasks yet. Open a list to plan your next step."}</Empty>}
            </div>
            <OpenButton onClick={(event) => onFeaturePress("todo list", event.currentTarget)}>{todoFrames.length ? "Choose a todo list" : "Open todo lists"}</OpenButton>
          </section>

          <section className={`overview-card overview-timer is-${pomodoro.phase}`} aria-label="Pomodoro timer">
            <TileHeader eyebrow="Focus" title={timerStatus} aside={<span className="overview-live-dot" aria-hidden="true" />} />
            <div className="overview-timer-body">
              <div className="overview-timer-ring" style={{ "--timer-progress": `${timerProgress * 360}deg` } as CSSProperties}>
                <div><small>{pomodoro.durationMin} minutes</small><strong>{pomodoro.phase === "complete" ? "00:00" : formatClock(pomodoro.remainingSec)}</strong></div>
              </div>
              <p>{pomodoro.phase === "idle" ? "Your next session starts in the timer frame." : pomodoro.phase === "complete" ? "Recorded in today’s completed focus." : "The same session continues across every view."}</p>
            </div>
            <button type="button" className="overview-timer-open" onClick={() => openFeature("pomodoro")}><Icon name="timer" size={16} />Open timer<Icon name="arrow" size={15} /></button>
          </section>

          <section className="overview-card overview-agenda" aria-label="Upcoming reminders">
            <TileHeader eyebrow="Schedule" title="Coming up" aside={overdueReminders > 0 ? <span className="overview-warning">{overdueReminders} overdue</span> : undefined} />
            <div className="overview-reminder-list">
              {upcoming.slice(0, 4).map(({ frameId, reminder, trigger }) => (
                <button type="button" className="overview-reminder" key={`${frameId}:${reminder.id}`} onClick={() => showFrame(frameId)}>
                  <time>{trigger.slice(11, 16)}</time>
                  <span><strong>{reminder.text}</strong><small>{reminderLabel(trigger, today)}</small></span>
                </button>
              ))}
              {upcoming.length === 0 && <Empty>No upcoming reminders.</Empty>}
            </div>
            <OpenButton onClick={() => openFeature("reminders")}>Open reminders</OpenButton>
          </section>

          <section className="overview-card overview-habits" aria-label="Habit rhythm">
            <TileHeader eyebrow="Routine" title="Habit rhythm" aside={<span className="overview-soft-badge">{habitsDoneToday} / {habits.length} today</span>} />
            <div className="overview-habit-list">
              {habits.slice(0, 3).map(({ frameId, habit }: { frameId: string; habit: Habit }) => {
                const progress = weekProgress(habit, today, firstDay);
                const week = heatMap(habit, today, firstDay, 1)[0];
                return (
                  <div className="overview-habit" key={`${frameId}:${habit.id}`}>
                    <span><strong>{habit.name}</strong><small>{progress.count} / {progress.target} this week</small></span>
                    <div aria-label={`${habit.name}: ${progress.count} of ${progress.target} days this week`}>
                      {week.map((day) => <i className={`${day.done ? "is-complete" : ""}${day.future ? " is-future" : ""}`} title={day.day} key={day.day}>{day.done ? "✓" : ""}</i>)}
                    </div>
                  </div>
                );
              })}
              {habits.length === 0 && <Empty>No active habits yet.</Empty>}
            </div>
            <OpenButton onClick={() => openFeature("habits")}>Open habits</OpenButton>
          </section>

          <section className="overview-card overview-notes" aria-label="Recent notes">
            <TileHeader eyebrow="Recently opened" title="Notes" aside={<span className="overview-note-icon"><Icon name="note" /></span>} />
            <div className="overview-note-list">
              {notes.map((frame) => {
                const excerpt = noteExcerpt(noteBodies[frame.id]);
                return (
                  <button type="button" className="overview-note" key={frame.id} onClick={() => showFrame(frame.id)}>
                    <strong>{frame.title}</strong><p>{excerpt || "Empty note"}</p><span>Open note <Icon name="arrow" size={14} /></span>
                  </button>
                );
              })}
              {notes.length === 0 && <Empty>No notes yet. Create a note to capture a thought.</Empty>}
            </div>
            {notes.length === 0 && <OpenButton onClick={() => onFeaturePress("notes")}>Open notes</OpenButton>}
          </section>

          <section className="overview-card overview-music" aria-label="Focus music">
            <TileHeader eyebrow="Soundscape" title="Now playing" aside={<span className="overview-music-mark" aria-hidden="true">♪</span>} />
            <p className="overview-music-copy">Playback stays with you as you move between frames and views.</p>
            <NowPlaying />
          </section>

          <section className="overview-card overview-bookmarks" aria-label="Bookmarks">
            <TileHeader eyebrow="Library" title="Worth coming back to" aside={<span className="overview-count"><Icon name="bookmark" size={14} />{bookmarkCount}</span>} />
            <div className="overview-bookmark-list">
              {bookmarks.map((bookmark) => (
                <div className="overview-bookmark" key={bookmark.id}>
                  <span className="overview-bookmark-mark" aria-hidden="true">{bookmark.title.trim().charAt(0).toUpperCase() || "↗"}</span>
                  <span><strong>{bookmark.favorite && <span className="overview-favourite" aria-label="Favourite">★</span>}{bookmark.title}</strong><small>{domainOf(bookmark.url)}{bookmark.tags[0] ? ` · #${bookmark.tags[0]}` : ""}</small></span>
                </div>
              ))}
              {bookmarkCount === 0 && <Empty>No bookmarks yet. Save a link in your library.</Empty>}
            </div>
            <OpenButton onClick={() => openFeature("bookmarks")}>Open library</OpenButton>
          </section>
        </div>
      </div>

      <footer className="overview-footer">
        <span>Everything is saved locally</span>
        <div className="overview-command-host" ref={setBarHost} />
      </footer>
      <WorkspaceCommandPalette workspace={workspace} />
      <WorkspaceOverlays workspace={workspace} />

      {frameOpen && (
        <dialog
          ref={dialogRef}
          className="overview-frame-dialog"
          aria-label={`${activeFrame.title} workspace frame`}
          onCancel={(event) => { event.preventDefault(); closeFrame(); }}
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            event.stopPropagation();
            closeFrame();
          }}
          onClick={(event) => { if (event.target === event.currentTarget) closeFrame(); }}
        >
          <div className="overview-frame-dialog-bar"><span>Active frame</span><button type="button" onClick={closeFrame} aria-label="Close active frame">Close <kbd>Esc</kbd></button></div>
          <ActiveFrame workspace={workspace} />
        </dialog>
      )}
    </main>
  );
}
