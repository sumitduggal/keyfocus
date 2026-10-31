# Architecture

Keyfocus is a **keyboard-first focus workspace**: a React + Vite single-page app with one active frame, a recency-ordered stack and shared feature state. Workspace data is stored locally in the browser; there is no account, cloud sync or router. Optional network integrations include bookmark metadata through `/api/og`, weather and radio search. Vocabulary for the domain terms used here is in `CONTEXT.md`.

The workspace-view seam and all four production adapters are in place. `src/App.tsx` is a one-line re-export of `src/workspace/WorkspaceApp.tsx`; the application is split between workspace orchestration, view adapters, shared components and feature modules.

## Entry points and workspace views

`src/main.tsx` runs saved-state migration and always mounts `App` in `StrictMode`; a `?variant=` parameter has no special routing behavior. The original prototype implementations remain available for historical comparison on `archive/workspace-design-prototypes`. `DesignPrototype` and its development-only route were removed from the main branch to prevent the prototype's global CSS from leaking into the production application.

The current production path is:

```text
src/main.tsx
  └── src/App.tsx
        └── src/workspace/WorkspaceApp.tsx
              state, actions, persistence and global keyboard orchestration
              └── WorkspaceView snapshot/actions interface
                    ├── src/workspace/views/OperatorConsole.tsx
                    ├── src/workspace/views/CalmWorkspace.tsx       (lazy)
                    ├── src/workspace/views/ImmersiveFocus.tsx      (lazy)
                    └── src/workspace/views/DailyOverview.tsx       (lazy)
```

- `WorkspaceApp.tsx` owns frames, active-frame selection, focus state, settings, todo and habit state, trash, persistence and commands. It also subscribes to the app-wide Pomodoro, reminders and bookmark stores, assembles the `WorkspaceView` value and installs the global keyboard listener.
- `src/workspace/view.ts` exports the `WorkspaceView` snapshot-and-actions interface. Adapters receive derived data, refs, registration callbacks and event actions rather than owning feature state or persistence.
- `src/workspace/WorkspaceParts.tsx` supplies the shared `ActiveFrame`, `WorkspaceCommandPalette` and `WorkspaceOverlays` compositions. These keep the real `Mainframe`, command palette, Settings, feature panel and workspace Notices consistent across adapters.
- Operator Console renders the original three-side design. Calm Workspace, Immersive Focus and Daily Overview provide their own layouts over the same workspace value; the three non-default adapters load through `React.lazy` and a shared `Suspense` fallback.
- `src/workspace/view.ts` also defines `WorkspaceViewId` (`operator`, `calm`, `immersive`, `overview`), the operator default and picker metadata. `src/workspace/view-setting.ts` loads and saves the selection. Missing, unknown, damaged or inaccessible stored values fall back to `operator`.

Settings presents all four view choices and switches the rendered adapter immediately. The choice persists under **`focus-space-workspace-view`**, independently of appearance, and is restored on reload.

## Operator Console layout

The adapter renders a fixed-viewport `.stage` / `.canvas` with these regions:

| Region | Component or element | Role |
|---|---|---|
| left | `Stack` inside `.left-side` | Promotable previews of non-active, non-parked frames; can collapse to a rail. |
| main | `Mainframe` inside `.main-side` | The active feature editing surface. |
| right | `Dock` inside `.right-side` | Visible feature navigation, Now Playing and Settings; can collapse to a rail. |
| overlays | `FeaturePanel`, `SettingsPanel`, `CommandPalette` | Frame selection/creation, preferences, commands, search and Recently deleted. |
| status | header, footer, `ReminderNotice`, overdue and Undo Notices | Timer/weather/reminder status, keyboard hints and transient actions. |

`visibleFeatures` in `src/constants.ts` controls the dock and command list. Notes and Focus Music remain valid frame types but are not currently visible dock features. Existing Notes frames remain available through the stack and search. Focus Music playback lives in the dock's app-wide `NowPlaying` control.

## Domain and feature modules

`src/types.ts` declares `Feature`, `Command`, `Side`, `Theme` and `WorkspaceFrame`. `src/constants.ts` supplies feature metadata, the initial Pomodoro frame, visible/single-frame feature sets and shared storage keys.

`Mainframe` routes the active frame to real feature implementations:

| Feature | Implementation |
|---|---|
| Pomodoro | Timer controls in `Mainframe`, app-wide state in `pomodoro.ts`, and Focus Log charts in `FocusStats`. |
| Todo List | `TodoFrame`, with parsing, nesting, ordering, filtering and recovery logic in the todo modules. |
| Habits | `HabitsFrame`, backed by per-frame habit state in `WorkspaceApp`. |
| Reminders | `RemindersFrame` and the app-wide scheduler/store in `reminders-store.ts`. |
| Bookmarks | `BookmarksFrame` and `bookmarks-store.ts`; Settings also exposes import/export. |
| Notes | An Editor.js document in `Mainframe`; the editor and its tools load dynamically only for a Notes frame. |
| Focus Music | App-wide `NowPlaying` playback in the dock rather than a second player owned by the active frame. |

`FramePreview` and `frame-summary.ts` derive compact stack previews from the same feature data. Feature behavior is implemented in these shared modules, not in `OperatorConsole`.

## Keyboard and focus model

Focus has two levels. `focusedSide` identifies `left`, `main` or `right`; `withinSide` distinguishes focus on the region from focus inside one of its controls. Enter steps into a region and Escape backs out through the command bar/current interaction. Refs registered by the adapter let `WorkspaceApp` restore focus to stack cards, dock items, feature entries and the active frame after rendering.

The global listener in `WorkspaceApp` owns the shortcut order and behavior:

- **⌘/Ctrl+K** opens the command palette; **⌘/Ctrl+Shift+L** toggles appearance.
- **⌘/Ctrl+Z** invokes the current workspace Undo action outside text inputs and editable editors.
- **Alt+←/→** moves between stack, active frame and dock; **↑/↓** moves within the stack or dock.
- **Enter** steps into a side, promotes a highlighted stack frame or activates a dock item.
- **Alt+1…9** promotes the corresponding visible stack frame.
- **Delete/Backspace** deletes the highlighted stack frame when focus is within the stack.
- **Tab/Shift+Tab** cycles focus within the current side while focus is inside that side.

Feature panels, Settings, text inputs, the command input and editable feature controls have their own handling where appropriate. Global navigation must not steal those interactions.

**Promotion** reorders frames so the selected frame becomes active and the previous active frame follows it in recency order. `stackedFrames` excludes the active frame and frames parked by `stack-expiry.ts`; parking hides a long-stacked frame from the stack without deleting it. Stack deletion routes through the same frame deletion and Undo/trash path as other deletion controls.

## Commands, panels and persistence

`CommandPalette` supports feature commands, frame search and Recently deleted. Single-frame features open or create their one frame directly; multi-instance features use a frame-selection/create menu or `FeaturePanel`. The adapter supplies the command bar host, while `WorkspaceApp` owns query, menu mode, highlighted row and selection actions.

`WorkspaceApp` persists frames, note bodies, todos, habits, todo view preferences, trash, settings, theme, collapsed rails and the selected workspace view. Feature modules own additional stores and migrations, including Pomodoro duration, Focus Log, reminders/nudges, bookmarks and music/radio preferences. Storage reads generally tolerate missing or damaged values. Timer, scheduler and playback coordination are app-wide rather than tied to whichever frame is active.

`src/components/Notice.tsx` is the shared message surface for persistent banners, temporary toasts and inline status messages. `presentation`, `placement`, `tone`, `durationMs` and `announcement` configure its appearance, lifetime and assistive-technology behavior. “Alert” describes an assertive announcement (`announcement="assertive"`), not a separate visual component. Dialogs, menus, popovers and disclosures remain distinct interaction surfaces.

## Styling

- `src/index.css` contains global font/reset basics.
- `src/App.css` contains the application and Operator Console layout styles.
- `src/components.css` contains shared component/feature styles and the shared view/theme tokens selected by `data-workspace-view` and `data-theme`.
- `src/workspace/views/CalmWorkspace.css`, `ImmersiveFocus.css` and `DailyOverview.css` contain their adapter-specific layouts.

View-owned accents and dark/light tokens are in place, and the non-default views have scoped stylesheets. Prototype-only global styles are not part of the main application; the historical prototypes and their styling remain on `archive/workspace-design-prototypes`. The broader split of shared base, chrome and feature styles remains cleanup work.

## Tests and checks

The project has both unit and browser coverage; it is not a no-test prototype. `npm test` runs Vitest (excluding `e2e/`) and then Playwright. Feature tests cover stores, parsing, migrations, timers, habits, reminders, bookmarks, music and other behavior; `src/workspace/view-setting.test.ts` covers workspace-view loading and saving. Browser specifications under `e2e/` exercise the real app, including keyboard and feature flows; `e2e/workspace-views.spec.ts` covers the four-view seam, shared state, commands and view persistence.

Use `npm run build` for the production TypeScript/Vite build and `npm run lint` for Oxlint. `npm run e2e` runs Playwright alone. Final cross-view, responsive and full-suite verification is still pending; adapter presence and a successful build do not establish rollout acceptance.

## Rollout status and approved next steps

Phases 0–1 established the baseline, seam, picker and persistence. Phase 2 added shared tokens, configurable command-bar placement, per-view styles and the cross-view smoke-test scaffold. Phases 3–5 added the Calm Workspace, Immersive Focus and Daily Overview production adapters, all reusing `WorkspaceView`, shared `WorkspaceParts`, real frames, stores and actions. Phase 6 prototype retirement removed the development-only `?variant=` gate, `DesignPrototype` and its global styles from the main application.

The remaining rollout gate is final cross-view, responsive and full-suite verification, including resolution of any failures against the acceptance criteria. Broader shared-stylesheet consolidation remains cleanup work. The original prototypes remain only on `archive/workspace-design-prototypes` and are not production adapters. See `docs/design/design-rollout-plan.md` for acceptance criteria and `docs/design/feature-guide.md` for current feature behavior.
