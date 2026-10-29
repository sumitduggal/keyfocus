# Keyfocus feature guide

Status: living document  
Companion: [Four workspace views: implementation plan](design-rollout-plan.md)

This guide describes what each feature does and how the four workspace views present it. Feature behaviour is shared across views; the visual layout changes, not the underlying data or rules.

## Core concepts

Keyfocus is a **keyboard-first focus workspace**.

- **Frame:** one instance of a feature, such as a Todo List called “Weekly plan”.
- **Active frame:** the one frame currently in the main work surface.
- **Stack:** the other frames, ordered by recency, newest first.
- **Promote:** move a stacked frame into the active position and put the previously active frame into the stack.
- **Dock:** the feature navigation used to open or create frames.
- **Command palette:** the ⌘K overlay used to create frames and search existing ones.

Promotion is deliberately not just a tab switch. It changes the order of the person's recent context.

## The four views

| View | What it is for | How it presents features |
|---|---|---|
| **Operator Console** | Dense control and keyboard navigation | The current three-side canvas: stack, active frame and dock. |
| **Calm Workspace** | Quiet everyday work | A large active frame with feature/recent navigation on the left and useful context on the right. |
| **Immersive Focus** | One thing at a time | A central timer or active frame, compact feature dock, latest-opened stack and top-right music control. |
| **Daily Overview** | Planning and reviewing | Read-only summary tiles for focus, todos, habits, reminders, notes, music and bookmarks; each tile opens the real feature. |

The approved mock layouts are prototypes. The production versions use the real stores and actions described below, not sample data or local preview state.

## Global keyboard behaviour

These shortcuts belong to the workspace and remain consistent across views:

| Key | Behaviour |
|---|---|
| **⌘K / Ctrl+K** | Open the command palette. |
| **Alt+← / Alt+→** | Move focus between the stack, active frame and dock. |
| **↑ / ↓** | Move within the current side or menu. |
| **Enter** | Step into a side; promote a highlighted stack frame; activate a dock item or command. |
| **Escape** | Close the current popup/menu or step focus back out. |
| **Delete / Backspace** | Remove the highlighted stack frame when focus is on the stack, not in a text field. |
| **⌘⇧L** | Toggle dark/light appearance. |

Feature-specific shortcuts are listed below. Compact views may move the controls visually, but they must not change these meanings.

## Pomodoro and Focus Log

### What it does

- Runs a countdown with presets or a custom duration.
- Shows idle, running, paused and complete states.
- Keeps the same timer state visible in the active frame, stack preview, dock and browser tab title.
- Plays the configured alert when a session completes.
- Records completed sessions in the Focus Log.
- Records a reset or abandoned session as **partial** time once at least one minute has run; partial time is shown separately from completed time.
- Provides totals, a 7/30-day chart and a 12-week heat map through Focus Log.

### Persistence and continuity

The selected duration and alert settings persist. The timer store is app-wide, so switching frames or views does not create a second timer.

### View treatment

- **Operator Console:** the active Pomodoro frame contains the dial, controls and Focus Log.
- **Calm Workspace:** the timer sits in a calm central focus card; current intention and priorities sit beside it.
- **Immersive Focus:** the circular timer is the primary visual object.
- **Daily Overview:** a timer tile shows current state and opens or promotes the Pomodoro frame for full controls.

## Todo List

### Creating items

A Todo frame holds one named list; multiple Todo frames can exist. The add field accepts:

- `!high`, `!medium`, `!low` — priority.
- `@today`, `@tomorrow`, `@friday`, `@2026-10-30`, `@12 nov` — due date.
- `~9:30`, `~9am`, `~14:30` — a reminder time. Without a date, an already-passed time rolls to tomorrow.

Example:

```text
Prepare design review !high @tomorrow ~9:30
```

### Working with items

- Toggle done state and see progress as **N of M complete** with a progress bar.
- Edit item text in place; an empty edit reverts on blur.
- Reorder siblings with **Alt+↑ / Alt+↓** in manual order.
- Nest with **[** and move up one level with **]**.
- Drag rows to reorder or change their parent; an item cannot be dropped into its own steps.
- Nest to any depth, but never into a cycle.
- Sort manually, by priority or by due date.
- Filter to all, open or overdue items.
- Progress includes nested steps. Parent and child done states are independent.
- Overdue means not done and due before today; due today is not overdue.
- Add or edit an item's reminder time; todo reminders stay in sync with Reminders.

### Delete and recovery

- Deleting an item, clearing completed items or deleting a list shows a five-second Undo toast.
- Deleted items and lists also enter Recently deleted and are restorable for seven days.
- Recently deleted is available from ⌘K when it contains entries.
- Per-list order, nesting, sort and filter choices persist.

### View treatment

The active Todo frame is the editing surface in Operator Console, Calm Workspace and Immersive Focus. Calm also uses open todos for its priorities context. Daily Overview shows a read-only priority summary and opens the real list for edits.

## Habits

### What it does

- Each habit has a name and a weekly target from 1–7; there are no fixed required weekdays.
- Tick today or backfill up to the previous two days. Older days and future days are not tickable.
- Weekly progress appears as **done / target**.
- Changing a target applies from the current week; past weeks keep the target they had.
- Options include best week, next week's aim and a 12-week or one-year heat map.
- Missed days stay blank rather than turning red; a missed week changes nothing.
- An optional daily nudge alerts only while the habit is not yet done that day.
- Habits can be archived, restored or deleted from the archived section.

### View treatment

The active Habits frame owns editing and history. Immersive Focus uses a compact weekly rhythm; Daily Overview summarizes the same habit data without maintaining a separate streak calculation.

## Reminders

### Creating and editing

Quick add accepts natural language, for example:

```text
call mum tomorrow 9am
stand up every weekday 9:30
pay rent monthly on the 1st
review notes every 2nd tuesday
```

It also accepts `!high`, `!medium`, `!low` and `@` date tokens. The preview shows the interpreted text, due time, repeat rule and priority before saving. The edit panel can correct text, date, time and repeat rules.

### Repeat and alert rules

- Repeat daily, weekly on chosen days, monthly by date or nth weekday, and yearly, with intervals where supported.
- One scheduler handles alerts whichever frame is open.
- A due reminder can show a banner, play a sound and use a browser notification when permission is granted.
- Repeating reminders advance to their next occurrence; missed repeats collapse to the latest missed occurrence.
- Snooze choices are 15 minutes, 30 minutes, 4 hours, tomorrow at 9:00, or a custom time.
- Overdue reminders stay visible until answered; completing one logs it in Done.
- The frame groups items as Overdue, Today, Tomorrow, This week and Later, with Done collapsed.
- Todo reminders follow their item's text, priority and time. Habit nudges appear as overdue prompts when missed.

### View treatment

The active Reminders frame owns editing, snoozing and done history. Calm Workspace and Daily Overview show upcoming reminders as context. Immersive Focus presents a compact reminder list without changing scheduler behaviour.

## Notes

### What it does

- A Notes frame contains one Editor.js document; multiple note frames can exist.
- Supported blocks and tools include paragraphs, headings, lists, quotes, checklists, images, inline code, code, links and markers.
- Changes save automatically as JSON per frame.
- Uploaded images are stored as data URLs in the note body.
- The editor loads only when a Notes frame opens.

Notes are not currently in the visible dock feature list, but existing note frames remain available through search and the stack.

### View treatment

Notes use the active frame as the editing surface. Latest Opened in Immersive Focus can promote a Notes frame. Daily Overview shows a recent excerpt and opens the real editor rather than embedding a second editor in a tile.

## Focus Music and Now Playing

### What it does

- Plays local tracks from the music library.
- Layers one or more built-in sounds under the selected track.
- Supports live radio stations and saved station favourites.
- Provides play/pause, previous/next, loop, sound volume and track volume.
- Short previews start quickly and hand over to the full audio file when it can play.

### Persistence and continuity

Sound choices, track choice, loop and volumes persist. Playback itself starts paused after reload. The player is app-wide, so audio continues when the active frame or workspace view changes.

### View treatment

- **Operator Console:** Now Playing sits in the dock.
- **Calm Workspace:** a compact soundscape control sits in the context area.
- **Immersive Focus:** Now Playing sits in the top-right beside Settings, leaving the bottom-left for Latest Opened.
- **Daily Overview:** a music tile shows the current track and opens playback options.

## Bookmarks

### Saving and organizing

- Save a web address; an address without a scheme is treated as HTTPS.
- Duplicate detection normalizes tracking parameters, scheme, `www`, hashes, trailing slashes and parameter order.
- Metadata such as title, cover and favicon is fetched through `/api/og` when available; the domain remains a fallback title.
- Organize bookmarks into nested collections and tags, mark favourites, add notes and highlights, and set reminder times.
- Collections can be nested, renamed, moved and deleted; deleting a collection moves its bookmarks to Unsorted.

### Finding and maintaining

- Views include list, grid, headlines and masonry.
- Search supports text plus operators such as `#tag`, `type:image`, `domain:example.com`, `created:2026-10`, `created:>2026-01-01` and `is:favorite`.
- Smart scopes include All, Favorites, Unsorted, Reminders, Duplicates and Broken.
- Link checking marks broken bookmarks without deleting them.
- Trash keeps deleted bookmarks for seven days; entries can be restored before purging.
- Settings provides bookmark import/export.

### View treatment

The Bookmarks frame owns the full library. Immersive Focus shows a compact library view; Daily Overview should show a small recent/favourite summary and open the full frame for organization or bulk actions.

## Settings and supporting controls

- **Workspace view:** chooses Operator Console, Calm Workspace, Immersive Focus or Daily Overview; persists independently of appearance.
- **Appearance:** dark/light theme; the four views use their own accent tokens with shared contrast rules.
- **Temperature:** chooses Celsius or Fahrenheit for the weather readout.
- **Timer alert:** chooses sound and volume, with a preview action.
- **Bookmark data:** import and export from Settings.

Weather, bookmark metadata and radio search may make network requests. Feature data itself remains in localStorage; no account or cloud sync is introduced by the view rollout.

## Design and implementation rule

If a control looks different in another view, it should still call the same underlying action. A view may summarize or reposition a feature, but it must not fork its data, timer, scheduler, parser, persistence or keyboard semantics.

For the implementation sequence and acceptance criteria, see [the rollout plan](design-rollout-plan.md).
