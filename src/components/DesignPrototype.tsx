import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import "./DesignPrototype.css";

// Three variants of the existing workspace, switchable via ?variant=A, B, or C in development.

type IconName =
  | "timer"
  | "check"
  | "habit"
  | "bell"
  | "bookmark"
  | "music"
  | "settings"
  | "search"
  | "plus"
  | "more"
  | "play"
  | "pause"
  | "note"
  | "clock"
  | "arrow"
  | "chevron";

type VariantKey = "A" | "B" | "C";

const variants: { key: VariantKey; name: string }[] = [
  { key: "A", name: "Calm workspace" },
  { key: "B", name: "Immersive focus" },
  { key: "C", name: "Daily overview" },
];

const features: { icon: IconName; label: string; count?: string }[] = [
  { icon: "timer", label: "Focus timer" },
  { icon: "check", label: "Todo list", count: "3" },
  { icon: "habit", label: "Habits" },
  { icon: "bell", label: "Reminders", count: "2" },
  { icon: "bookmark", label: "Bookmarks" },
];

const today = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
}).format(new Date());

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    timer: <><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 1.5M9 2h6M12 2v3" /></>,
    check: <><rect x="3" y="3" width="18" height="18" rx="5" /><path d="m7.5 12 3 3 6-7" /></>,
    habit: <><path d="M20 7h-5V2" /><path d="M20 7a8.5 8.5 0 1 0 .5 8" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
    bookmark: <path d="M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18l-6-4-6 4Z" />,
    music: <><path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    more: <><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></>,
    play: <path d="m8 5 11 7-11 7Z" fill="currentColor" stroke="none" />,
    pause: <><path d="M8 5v14M16 5v14" strokeWidth="3" /></>,
    note: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M8 13h8M8 17h5" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    arrow: <><path d="M5 12h14M14 7l5 5-5 5" /></>,
    chevron: <path d="m9 5 7 7-7 7" />,
  };

  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

function Brand() {
  return (
    <div className="proto-brand">
      <span className="proto-logo" aria-hidden="true"><i /><i /><i /><i /></span>
      <span>keyfocus</span>
    </div>
  );
}

export function VariantA() {
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);

  return (
    <section className="proto-variant proto-calm" aria-label="Calm workspace design">
      <header className="calm-topbar">
        <Brand />
        <div className="calm-date"><span>Your workspace</span><strong>{today}</strong></div>
        <div className="calm-top-actions">
          <button type="button" className="proto-icon-button" aria-label="Search"><Icon name="search" /></button>
          <button type="button" className="calm-avatar" aria-label="Open profile">KF</button>
        </div>
      </header>

      <div className="calm-layout">
        <aside className="calm-sidebar">
          <p className="proto-label">Workspace</p>
          <nav className="calm-nav" aria-label="Features">
            {features.map((feature, index) => (
              <button type="button" className={index === 0 ? "is-active" : ""} key={feature.label}>
                <Icon name={feature.icon} /><span>{feature.label}</span>{feature.count && <small>{feature.count}</small>}
              </button>
            ))}
          </nav>
          <div className="calm-recent">
            <p className="proto-label">Recent frames <button type="button" aria-label="Add frame"><Icon name="plus" size={15} /></button></p>
            <button type="button"><span className="calm-recent-icon"><Icon name="note" /></span><span><strong>Launch notes</strong><small>Edited 12 min ago</small></span></button>
            <button type="button"><span className="calm-recent-icon"><Icon name="check" /></span><span><strong>Weekly plan</strong><small>3 of 5 complete</small></span></button>
          </div>
          <button type="button" className="calm-settings"><Icon name="settings" /><span>Settings</span><Icon name="chevron" size={15} /></button>
        </aside>

        <main className="calm-main">
          <div className="calm-heading">
            <div><span className="proto-eyebrow">Pomodoro · Session 01</span><h1>One thing at a time.</h1></div>
            <span className="calm-ready"><i />{started ? "Focus in progress" : "Ready when you are"}</span>
          </div>

          <section className="calm-focus-card" aria-label="Focus timer">
            <div className="calm-intention"><span>Current intention</span><strong>Design a calmer focus workspace</strong></div>
            <div className={`calm-ring${started ? " is-running" : ""}`}>
              <div><span className="calm-time">25:00</span><small>25 minute session</small></div>
            </div>
            <div className="calm-durations" aria-label="Timer duration">
              <button type="button">15 min</button><button type="button" className="is-selected" aria-pressed="true">25 min</button><button type="button">50 min</button>
            </div>
            <div className="calm-focus-actions">
              <button type="button" className="calm-primary" aria-pressed={started} onClick={() => setStarted((value) => !value)}><Icon name={started ? "pause" : "play"} size={16} />{started ? "Pause focus" : "Start focus"}</button>
              <button type="button" className="calm-reset" onClick={() => setStarted(false)}>Reset</button>
            </div>
            <p className="calm-shortcut">Press <kbd>Space</kbd> to {started ? "pause" : "start"}</p>
          </section>
        </main>

        <aside className="calm-context">
          <section className="calm-tasks">
            <header><div><span className="proto-eyebrow">Today</span><h2>Your priorities</h2></div><span>2 / 5</span></header>
            <div className="calm-progress"><i /></div>
            <div className="calm-task is-done"><span className="calm-check"><Icon name="check" size={14} /></span><div><strong>Review launch notes</strong><small>Completed this morning</small></div></div>
            <div className="calm-task is-current"><span className="calm-check" /><div><strong>Design workspace mock</strong><small><i /> Current focus</small></div></div>
            <div className="calm-task"><span className="calm-check" /><div><strong>Prepare design review</strong><small><Icon name="clock" size={13} /> 15:30</small></div></div>
            <button type="button" className="calm-add"><Icon name="plus" size={16} /> Add a priority</button>
          </section>

          <section className="calm-upnext">
            <span className="proto-eyebrow">Up next</span>
            <div><span className="calm-calendar"><strong>29</strong><small>OCT</small></span><span><strong>Design review</strong><small>15:30 – 16:00</small></span><Icon name="chevron" size={16} /></div>
          </section>

          <section className="calm-music">
            <span className="calm-album"><Icon name="music" size={22} /></span>
            <div><span>Focus sounds</span><strong>Chill study desk</strong></div>
            <button type="button" aria-label={playing ? "Pause music" : "Play music"} aria-pressed={playing} onClick={() => setPlaying((value) => !value)}><Icon name={playing ? "pause" : "play"} size={15} /></button>
          </section>
        </aside>
      </div>

      <footer className="calm-footer">
        <button type="button" className="calm-command"><Icon name="search" /><span>Search or run a command…</span><kbd>⌘ K</kbd></button>
        <span className="calm-saved"><i /> Everything is saved locally</span>
      </footer>
    </section>
  );
}

function ImmersiveFeatureHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return (
    <header className="immersive-feature-heading">
      <div><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>
      {action}
    </header>
  );
}

function TodoPreview() {
  const tasks = ["Review launch notes", "Design workspace mock", "Prepare design review", "Reply to team feedback", "Book train tickets"];
  const [completed, setCompleted] = useState([true, false, false, true, false]);
  const completedCount = completed.filter(Boolean).length;

  return (
    <section className="immersive-feature" aria-label="Todo list preview">
      <ImmersiveFeatureHeading eyebrow="Todo list · Today" title="A clear next step." description="Keep the list short and the finish line visible." action={<button type="button" className="immersive-feature-icon-button" aria-label="Add task"><Icon name="plus" /></button>} />
      <div className="immersive-feature-summary"><span>{completedCount} of {tasks.length} complete</span><span>Weekly plan</span></div>
      <div className="immersive-feature-progress"><i style={{ width: `${(completedCount / tasks.length) * 100}%` }} /></div>
      <div className="immersive-todo-list">
        {tasks.map((task, index) => (
          <button type="button" className={`immersive-todo-row${completed[index] ? " is-done" : ""}${index === 1 ? " is-current" : ""}`} aria-pressed={completed[index]} onClick={() => setCompleted((current) => current.map((done, itemIndex) => itemIndex === index ? !done : done))} key={task}>
            <span className="immersive-todo-check">{completed[index] && <Icon name="check" size={13} />}</span>
            <span><strong>{task}</strong><small>{index === 1 ? "Focusing now" : index === 2 ? "Today · 45 min" : "Personal · 20 min"}</small></span>
            {index === 1 && <span className="immersive-live-dot" />}
          </button>
        ))}
      </div>
      <button type="button" className="immersive-feature-add"><Icon name="plus" size={15} /> Add a task <kbd>↵</kbd></button>
    </section>
  );
}

function HabitsPreview() {
  const habits = [
    { name: "Morning pages", note: "5 day streak", days: [true, true, true, true, true, false, false] },
    { name: "Move for 30 minutes", note: "3 days this week", days: [true, false, true, false, true, false, false] },
    { name: "Read before bed", note: "4 day streak", days: [false, true, true, true, false, true, false] },
  ];

  return (
    <section className="immersive-feature" aria-label="Habits preview">
      <ImmersiveFeatureHeading eyebrow="Habits · This week" title="Small steps, repeated." description="A gentle view of the routines you are building." action={<button type="button" className="immersive-feature-icon-button" aria-label="Add habit"><Icon name="plus" /></button>} />
      <div className="immersive-feature-summary"><span>Thursday, 29 October</span><span>2 of 3 done today</span></div>
      <div className="immersive-habit-list">
        {habits.map((habit) => (
          <section className="immersive-habit-card" key={habit.name}>
            <header><span><strong>{habit.name}</strong><small>{habit.note}</small></span><button type="button" aria-label={`${habit.name} options`}><Icon name="more" /></button></header>
            <div>{["S", "M", "T", "W", "T", "F", "S"].map((day, index) => <button type="button" className={habit.days[index] ? "is-complete" : ""} aria-label={`${habit.name}, day ${index + 1}`} aria-pressed={habit.days[index]} key={`${day}-${index}`}><small>{day}</small><i>{habit.days[index] && "✓"}</i></button>)}</div>
          </section>
        ))}
      </div>
      <button type="button" className="immersive-feature-add"><Icon name="plus" size={15} /> Add a habit</button>
    </section>
  );
}

function RemindersPreview() {
  const reminders = [
    { time: "09:30", title: "Review launch notes", note: "This morning" },
    { time: "15:30", title: "Design review", note: "In 2 hours · Meet" },
    { time: "17:00", title: "Plan tomorrow", note: "This evening · 15 min" },
  ];
  const [completed, setCompleted] = useState<number[]>([0]);

  return (
    <section className="immersive-feature" aria-label="Reminders preview">
      <ImmersiveFeatureHeading eyebrow="Reminders · Today" title="Right thing, right time." description="Time-aware prompts, without the noise." action={<button type="button" className="immersive-feature-icon-button" aria-label="Add reminder"><Icon name="plus" /></button>} />
      <div className="immersive-feature-summary"><span>3 reminders</span><span>2 remaining</span></div>
      <div className="immersive-reminder-list">
        {reminders.map((reminder, index) => (
          <div className={`immersive-reminder-row${completed.includes(index) ? " is-done" : ""}`} key={reminder.title}>
            <time>{reminder.time}</time><span className="immersive-reminder-bell"><Icon name="bell" size={16} /></span><span><strong>{reminder.title}</strong><small>{reminder.note}</small></span>
            <button type="button" aria-label={`${completed.includes(index) ? "Restore" : "Complete"} ${reminder.title}`} aria-pressed={completed.includes(index)} onClick={() => setCompleted((current) => current.includes(index) ? current.filter((item) => item !== index) : [...current, index])}><Icon name="check" size={14} /></button>
          </div>
        ))}
      </div>
      <button type="button" className="immersive-feature-add"><Icon name="plus" size={15} /> Add a reminder</button>
    </section>
  );
}

function BookmarksPreview() {
  const bookmarks = [
    { mark: "S", title: "The laws of simplicity", domain: "lawsofsimplicity.com", tag: "Design" },
    { mark: "A", title: "A11y Project Checklist", domain: "a11yproject.com", tag: "Reference" },
    { mark: "U", title: "Design better data tables", domain: "uxdesign.cc", tag: "Reading" },
  ];

  return (
    <section className="immersive-feature" aria-label="Bookmarks preview">
      <ImmersiveFeatureHeading eyebrow="Bookmarks · Library" title="Worth coming back to." description="Useful references, close to your working context." action={<button type="button" className="immersive-feature-icon-button" aria-label="Add bookmark"><Icon name="plus" /></button>} />
      <label className="immersive-bookmark-search"><Icon name="search" size={16} /><input aria-label="Search bookmarks" placeholder="Search your library…" /><kbd>⌘ K</kbd></label>
      <div className="immersive-bookmark-filters"><button type="button" className="is-active">All</button><button type="button">Design</button><button type="button">Reading</button><button type="button">Research</button></div>
      <div className="immersive-bookmark-list">
        {bookmarks.map((bookmark) => (
          <button type="button" className="immersive-bookmark-row" key={bookmark.title}><span className="immersive-bookmark-mark">{bookmark.mark}</span><span><strong>{bookmark.title}</strong><small>{bookmark.domain}</small></span><span className="immersive-bookmark-tag">{bookmark.tag}</span><Icon name="chevron" size={14} /></button>
        ))}
      </div>
    </section>
  );
}

function NotesPreview() {
  return (
    <section className="immersive-feature immersive-notes" aria-label="Notes preview">
      <ImmersiveFeatureHeading eyebrow="Notes · Edited 12 min ago" title="Launch notes" description="A quiet place to think, right beside the work." action={<button type="button" className="immersive-feature-icon-button" aria-label="Note options"><Icon name="more" /></button>} />
      <div className="immersive-notes-toolbar"><button type="button"><strong>B</strong></button><button type="button"><em>I</em></button><button type="button">H2</button><span /><button type="button">Checklist</button><button type="button">Quote</button></div>
      <article className="immersive-notes-body">
        <p>Keep the useful structure, lose the noise. The best focus tool should feel quieter as the work gets louder.</p>
        <h2>Design principles</h2>
        <ul><li>Make the current action unmistakable.</li><li>Keep recent context within reach.</li><li>Use the keyboard to move, not to memorise.</li></ul>
        <p className="immersive-notes-quote">One thing at a time, with everything else close by.</p>
      </article>
    </section>
  );
}

export function VariantB() {
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [recentsOpen, setRecentsOpen] = useState(false);
  const [activeFeature, setActiveFeature] = useState("Focus timer");

  const openFeature = (feature: string) => {
    setActiveFeature(feature);
    setRecentsOpen(false);
  };

  return (
    <section className="proto-variant proto-immersive" aria-label="Immersive focus design">
      <div className="immersive-ambient" aria-hidden="true" />
      <header className="immersive-topbar">
        <Brand />
        <span className="immersive-mode"><i />{activeFeature === "Focus timer" ? "Deep focus" : activeFeature}</span>
        <div className="immersive-header-actions">
          <button type="button" className="immersive-sound" aria-label={playing ? "Pause Chill study desk" : "Play Chill study desk"} aria-pressed={playing} onClick={() => setPlaying((value) => !value)}><span><Icon name="music" /></span><div><small>Soundscape</small><strong>Chill study desk</strong></div><span className={`immersive-wave${playing ? " is-playing" : ""}`} aria-hidden="true"><i /><i /><i /><i /></span></button>
          <button type="button" className="proto-icon-button" aria-label="Settings"><Icon name="settings" /></button>
        </div>
      </header>

      <main className={`immersive-main${activeFeature !== "Focus timer" ? " is-feature-view" : ""}`}>
        {activeFeature === "Focus timer" && (
          <>
            <div className="immersive-intention"><span>Your one thing</span><h1>Design a calmer focus workspace</h1><button type="button">Change intention <Icon name="arrow" size={14} /></button></div>
            <div className={`immersive-timer${started ? " is-running" : ""}`}>
              <div className="immersive-orbit" aria-hidden="true"><i /><i /><i /></div>
              <div className="immersive-time-copy"><span className="immersive-status"><i />{started ? "In flow" : "Ready"}</span><strong>25<span>:</span>00</strong><small>Focus · Session 1 of 4</small></div>
            </div>
            <div className="immersive-durations" aria-label="Timer duration"><button type="button">15m</button><button type="button" className="is-selected" aria-pressed="true">25m</button><button type="button">50m</button><span /><button type="button">Custom</button></div>
            <button type="button" className="immersive-start" aria-pressed={started} onClick={() => setStarted((value) => !value)}><span><Icon name={started ? "pause" : "play"} size={18} /></span>{started ? "Pause session" : "Begin focus"}</button>
            <p className="immersive-hint"><kbd>Space</kbd> to {started ? "pause" : "begin"} · <kbd>Esc</kbd> to reset</p>
          </>
        )}
        {activeFeature === "Todo list" && <TodoPreview />}
        {activeFeature === "Habits" && <HabitsPreview />}
        {activeFeature === "Reminders" && <RemindersPreview />}
        {activeFeature === "Bookmarks" && <BookmarksPreview />}
        {activeFeature === "Notes" && <NotesPreview />}
      </main>

      <footer className="immersive-footer">
        <div className="immersive-recents-wrap">
          <button type="button" className="immersive-recents" aria-expanded={recentsOpen} aria-controls="immersive-recent-frames" onClick={() => setRecentsOpen((value) => !value)}>
            <span className="immersive-stack-preview" aria-hidden="true"><i /><i /><Icon name="note" size={16} /></span>
            <span className="immersive-recents-copy"><small>Latest opened</small><strong>2 frames</strong></span>
            <span className={`immersive-recents-chevron${recentsOpen ? " is-open" : ""}`}><Icon name="chevron" size={14} /></span>
          </button>
          {recentsOpen && (
            <div className="immersive-recent-popover" id="immersive-recent-frames" role="group" aria-label="Latest opened frames">
              <header><strong>Latest opened</strong><small>2 frames</small></header>
              <button type="button" onClick={() => openFeature("Notes")}><span className="immersive-recent-icon"><Icon name="note" /></span><span><strong>Launch notes</strong><small>Notes · 12 min ago</small></span><Icon name="chevron" size={14} /></button>
              <button type="button" onClick={() => openFeature("Todo list")}><span className="immersive-recent-icon"><Icon name="check" /></span><span><strong>Weekly plan</strong><small>Todo list · 2 of 5 complete</small></span><Icon name="chevron" size={14} /></button>
            </div>
          )}
        </div>
        <nav className="immersive-dock" aria-label="Features">
          {features.map((feature) => <button type="button" className={feature.label === activeFeature ? "is-active" : ""} aria-pressed={feature.label === activeFeature} onClick={() => openFeature(feature.label)} key={feature.label}><Icon name={feature.icon} /><span>{feature.label === "Focus timer" ? "Focus" : feature.label}</span>{feature.count && <small>{feature.count}</small>}</button>)}
        </nav>
        <button type="button" className="immersive-command"><Icon name="search" /><span>Quick actions</span><kbd>⌘ K</kbd></button>
      </footer>
    </section>
  );
}

export function VariantC() {
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);

  return (
    <section className="proto-variant proto-dashboard" aria-label="Daily overview design">
      <header className="dashboard-topbar">
        <Brand />
        <nav aria-label="Workspace views"><button type="button" className="is-active">Overview</button><button type="button">Tasks</button><button type="button">Habits</button><button type="button">Library</button></nav>
        <div className="dashboard-top-actions"><button type="button" className="proto-icon-button" aria-label="Search"><Icon name="search" /></button><button type="button" className="proto-icon-button has-notification" aria-label="Notifications"><Icon name="bell" /></button><button type="button" className="dashboard-avatar" aria-label="Open profile">KF</button></div>
      </header>

      <main className="dashboard-main">
        <section className="dashboard-welcome">
          <div><span className="proto-eyebrow">{today}</span><h1>Make today count.</h1><p>Three priorities. One clear next step.</p></div>
          <div className="dashboard-stats"><div><span>Focus time</span><strong>2h 45m</strong><small>↑ 25m from yesterday</small></div><div><span>Sessions</span><strong>03</strong><small>Goal: 4 sessions</small></div><div><span>Daily streak</span><strong>07</strong><small>Your best is 12 days</small></div></div>
        </section>

        <div className="dashboard-grid">
          <section className="dashboard-card dashboard-priorities">
            <header><div><span className="proto-eyebrow">Plan</span><h2>Today’s priorities</h2></div><button type="button" className="proto-icon-button" aria-label="Add priority"><Icon name="plus" /></button></header>
            <div className="dashboard-task is-done"><span className="dashboard-task-check"><Icon name="check" size={14} /></span><div><strong>Review launch notes</strong><small>Personal · 20 min</small></div><span className="dashboard-task-number">01</span></div>
            <div className="dashboard-task is-current"><span className="dashboard-task-check" /><div><strong>Design workspace mock</strong><small><i /> Focusing now</small></div><button type="button" aria-label="Open current priority"><Icon name="arrow" /></button></div>
            <div className="dashboard-task"><span className="dashboard-task-check" /><div><strong>Prepare design review</strong><small>Work · 45 min</small></div><span className="dashboard-task-number">03</span></div>
            <button type="button" className="dashboard-add"><Icon name="plus" size={15} /> Add priority</button>
          </section>

          <section className={`dashboard-timer${started ? " is-running" : ""}`}>
            <div className="dashboard-timer-glow" aria-hidden="true" />
            <header><span><i />{started ? "Focus in progress" : "Focus session"}</span><button type="button" aria-label="Timer options"><Icon name="more" /></button></header>
            <div className="dashboard-timer-copy"><small>25 MINUTES</small><strong>25:00</strong><p>Design a calmer focus workspace</p></div>
            <button type="button" className="dashboard-start" aria-pressed={started} onClick={() => setStarted((value) => !value)}><Icon name={started ? "pause" : "play"} size={15} />{started ? "Pause session" : "Start focus"}<kbd>Space</kbd></button>
            <div className="dashboard-rounds"><span><i /><i /><i /><i /></span><small>Session 1 of 4</small></div>
          </section>

          <aside className="dashboard-card dashboard-agenda">
            <header><div><span className="proto-eyebrow">Schedule</span><h2>Coming up</h2></div><button type="button" className="proto-icon-button" aria-label="Open schedule"><Icon name="arrow" /></button></header>
            <div className="dashboard-event"><time>15:30</time><span><strong>Design review</strong><small>30 minutes · Meet</small></span></div>
            <div className="dashboard-event"><time>17:00</time><span><strong>Plan tomorrow</strong><small>15 minutes · Personal</small></span></div>
            <div className="dashboard-agenda-note"><Icon name="bell" size={16} /><span>2 reminders for this afternoon</span></div>
          </aside>

          <section className="dashboard-card dashboard-habits">
            <header><div><span className="proto-eyebrow">Routine</span><h2>Habit rhythm</h2></div><span className="dashboard-trend">4 day streak</span></header>
            <div className="dashboard-habit-row"><span><strong>Morning pages</strong><small>5 days this week</small></span><div>{[1, 2, 3, 4, 5, 6, 7].map((day) => <i className={day < 6 ? "is-complete" : ""} key={day}>{day < 6 && "✓"}</i>)}</div></div>
            <div className="dashboard-habit-row"><span><strong>Move for 30 min</strong><small>3 days this week</small></span><div>{[1, 2, 3, 4, 5, 6, 7].map((day) => <i className={[1, 3, 5].includes(day) ? "is-complete" : ""} key={day}>{[1, 3, 5].includes(day) && "✓"}</i>)}</div></div>
          </section>

          <section className="dashboard-card dashboard-note">
            <header><div><span className="proto-eyebrow">Recently opened</span><h2>Launch notes</h2></div><span className="dashboard-note-icon"><Icon name="note" /></span></header>
            <p>Keep the useful structure, lose the noise. The best focus tool should feel quieter as the work gets louder.</p>
            <footer><span>Edited 12 minutes ago</span><button type="button">Open note <Icon name="arrow" size={14} /></button></footer>
          </section>

          <section className="dashboard-card dashboard-music">
            <span className="dashboard-music-art"><Icon name="music" size={26} /></span>
            <div><span className="proto-eyebrow">Now playing</span><h2>Chill study desk</h2><p>Focus sounds · 12 tracks</p></div>
            <button type="button" aria-label={playing ? "Pause music" : "Play music"} aria-pressed={playing} onClick={() => setPlaying((value) => !value)}><Icon name={playing ? "pause" : "play"} size={16} /></button>
            <div className={`dashboard-equalizer${playing ? " is-playing" : ""}`} aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
          </section>
        </div>
      </main>
    </section>
  );
}

function currentVariant(): VariantKey {
  const value = new URLSearchParams(window.location.search).get("variant")?.toUpperCase();
  return variants.some((variant) => variant.key === value) ? value as VariantKey : "A";
}

export default function DesignPrototype() {
  const [variant, setVariant] = useState<VariantKey>(currentVariant);

  const move = useCallback((direction: number) => {
    setVariant((current) => {
      const index = variants.findIndex((item) => item.key === current);
      const next = variants[(index + direction + variants.length) % variants.length].key;
      const url = new URL(window.location.href);
      url.searchParams.set("variant", next);
      window.history.replaceState({}, "", url);
      return next;
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, [contenteditable='true']")) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        move(-1);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        move(1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [move]);

  const active = variants.find((item) => item.key === variant)!;

  return (
    <div className="design-prototype">
      {variant === "A" && <VariantA />}
      {variant === "B" && <VariantB />}
      {variant === "C" && <VariantC />}
      <nav className="prototype-switcher" aria-label="Design mock variants">
        <button type="button" aria-label="Previous design" onClick={() => move(-1)}><Icon name="chevron" size={17} /></button>
        <div aria-live="polite"><small>Design mock · {active.key} / C</small><strong>{active.key} — {active.name}</strong></div>
        <button type="button" aria-label="Next design" onClick={() => move(1)}><Icon name="chevron" size={17} /></button>
      </nav>
    </div>
  );
}
