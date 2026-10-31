# Keyfocus feature guide

Status: living document  
Companion: [Four workspace views: implementation plan](design-rollout-plan.md)

This guide describes current feature behaviour and the production presentation of the four workspace views. All four adapters use the shared `WorkspaceView` snapshot-and-actions interface and shared `WorkspaceParts`; final cross-view acceptance verification is still in progress.

## Core concepts

Keyfocus is a **keyboard-first focus workspace**.

- **Frame:** one instance of a feature, such as a Todo List called “Weekly plan”.
- **Active frame:** the one frame currently in the main work surface.
- **Stack:** the other frames, ordered by recency, newest first.
- **Promote:** move a stacked frame into the active position and put the previously active frame into the stack.
- **Dock:** the feature navigation used to open or create frames.
- **Command palette:** the ⌘K overlay used to create frames and search existing ones.

Promotion is deliberately not just a tab switch. It changes the order of the person's recent context.

## The four production views

| View | Purpose and presentation |
|---|---|
| **Operator Console** | Dense keyboard navigation on the original three-side canvas: stack, active frame and dock. |
| **Calm Workspace** | A quieter everyday workspace: a large active frame with feature/recent navigation on the left and priorities, the next reminder and Now Playing on the right. |
| **Immersive Focus** | One thing at a time: a central active frame, compact feature dock, latest-opened stack and top-right music control. |
| **Daily Overview** | Planning and reviewing through summary tiles for focus, todos, habits, reminders, notes, music and bookmarks. Feature actions open the real active frame in a dialog. |

Operator Console loads eagerly; the three non-default adapters use `React.lazy` and the shared `Suspense` fallback. All four render real frames, stores and actions rather than sample data or local preview state.

The original prototype implementations remain available for historical comparison on `archive/workspace-design-prototypes`. The development-only `?variant=` route and `DesignPrototype` were removed from the main branch to prevent prototype global CSS from leaking into production. The application now always mounts `App`, including when a URL contains `variant`.

The **Presentation** sections below describe the production adapters. Cross-view keyboard, data-continuity, responsive and full-suite acceptance checks remain part of final rollout verification.

## Global keyboard behaviour

These shortcuts belong to the shared workspace keyboard and focus model. Preserving their meanings in every adapter is a cross-view acceptance requirement:

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

### Presentation by view

- **Operator Console:** the active Pomodoro frame contains the dial, controls and Focus Log.
- **Calm Workspace:** the active Pomodoro frame sits in the central surface, with session status above it and priorities beside it.
- **Immersive Focus:** the active Pomodoro frame and its circular timer are the primary visual object.
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

- Deleting an item, clearing completed items or deleting a list shows a temporary Undo Notice for five seconds.
- Deleted items and lists also enter Recently deleted and are restorable for seven days.
- Recently deleted is available from ⌘K when it contains entries.
- Per-list order, nesting, sort and filter choices persist.

### Presentation by view

- **Operator Console:** the active Todo frame is the editing surface.
- **Calm Workspace:** the active Todo frame remains the editing surface, with open todos also feeding the priorities context.
- **Immersive Focus:** the active Todo frame remains the editing surface.
- **Daily Overview:** a read-only priority summary opens the real list for edits.

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

### Presentation by view

- **Operator Console, Calm Workspace and Immersive Focus:** the shared active Habits frame owns editing and history.
- **Daily Overview:** a read-only weekly rhythm summary uses the same habit data and opens the real frame for edits.

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
- A due reminder shows a persistent Reminder Notice with Done and snooze actions, can play a sound and can use a browser notification when permission is granted. Its screen-reader announcement uses the assertive Notice setting.
- Repeating reminders advance to their next occurrence; missed repeats collapse to the latest missed occurrence.
- Snooze choices are 15 minutes, 30 minutes, 4 hours, tomorrow at 9:00, or a custom time.
- Overdue reminders stay visible until answered; completing one logs it in Done.
- The frame groups items as Overdue, Today, Tomorrow, This week and Later, with Done collapsed.
- Todo reminders follow their item's text, priority and time. Habit nudges appear as overdue prompts when missed.

### Presentation by view

- **Operator Console and Immersive Focus:** the shared active Reminders frame owns editing, snoozing and done history.
- **Calm Workspace:** the next upcoming reminder appears as context and opens its real frame; the active Reminders frame provides full editing.
- **Daily Overview:** upcoming reminders appear as read-only summary context and open their real frame.

## Notes

### What it does

- A Notes frame contains one Editor.js document; multiple note frames can exist.
- Supported blocks and tools include paragraphs, headings, lists, quotes, checklists, images, inline code, code, links and markers.
- Changes save automatically as JSON per frame.
- Uploaded images are stored as data URLs in the note body.
- The editor loads only when a Notes frame opens.

Notes are not currently in the visible dock feature list, but existing note frames remain available through search and the stack.

### Presentation by view

- **Operator Console:** the active Notes frame is the editing surface.
- **Immersive Focus:** Latest Opened can promote a Notes frame into the same editing role.
- **Daily Overview:** a recent excerpt opens the real editor rather than embedding a second editor in a tile.

## Focus Music and Now Playing

### What it does

- Plays local tracks from the music library.
- Layers one or more built-in sounds under the selected track.
- Supports live radio stations and saved station favourites.
- Provides play/pause, previous/next, loop, sound volume and track volume.
- Short previews start quickly and hand over to the full audio file when it can play.

### Persistence and continuity

Track choice, loop and volumes persist. Playback itself starts paused after reload. The player is app-wide and shared by every adapter, so audio continues when the active frame or workspace view changes.

### Presentation by view

- **Operator Console:** Now Playing sits in the dock.
- **Calm Workspace:** Now Playing sits in the context area.
- **Immersive Focus:** Now Playing sits in the top-right beside Settings, leaving the bottom-left for Latest Opened.
- **Daily Overview:** the music tile embeds the same Now Playing control.

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

### Presentation by view

- **Operator Console, Calm Workspace and Immersive Focus:** the shared active Bookmarks frame owns the full library.
- **Daily Overview:** a read-only recent/favourite summary opens the full frame for organization or bulk actions.

## Settings and supporting controls

- **Workspace view:** Settings shows a four-choice picker that switches immediately among all four production adapters. The selection persists under `focus-space-workspace-view`, independently of appearance, with Operator Console as the default; reload restores the selected adapter.
- **Appearance:** dark/light theme is a separate setting. View accents use the shared view/theme token structure.
- **Temperature:** chooses Celsius or Fahrenheit for the weather readout.
- **Timer alert:** chooses sound and volume, with a preview action.
- **Bookmark data:** import and export from Settings.

Weather, bookmark metadata and radio search may make network requests. Feature data itself remains in localStorage; no account or cloud sync is introduced by the view rollout.

## Design and implementation rule

The production adapters share one rule: if a control looks different in another view, it must still call the same underlying action. A view may summarize or reposition a feature, but it must not fork its data, timer, scheduler, parser, persistence or keyboard semantics.

For the implementation sequence and acceptance criteria, see [the rollout plan](design-rollout-plan.md).
