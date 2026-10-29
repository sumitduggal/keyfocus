# Architecture

Keyfocus is a **keyboard-first focus workspace**: a React + Vite single-page app with one active frame, a recency-ordered stack and shared feature state. Workspace data is stored locally in the browser; there is no account, cloud sync or router. Optional network integrations include bookmark metadata through `/api/og`, weather and radio search. Vocabulary for the domain terms used here is in `CONTEXT.md`.

The Phase 1 extraction is in place. `src/App.tsx` is now a one-line re-export of `src/workspace/WorkspaceApp.tsx`; the application is split between workspace orchestration, a view adapter, shared components and feature modules.

## Entry points and workspace views

`src/main.tsx` runs saved-state migration and mounts `App` in `StrictMode`. In development only, any URL with a `?variant=` parameter mounts `DesignPrototype` instead. This is still the throwaway prototype route for the approved mock directions, not a production view adapter. Production ignores `?variant=` and mounts the real app.

The current production path is:

```text
src/main.tsx
  └── src/App.tsx
        └── src/workspace/WorkspaceApp.tsx
              state, actions, persistence and global keyboard orchestration
              └── WorkspaceView snapshot/actions interface
                    └── src/workspace/views/OperatorConsole.tsx
```

- `WorkspaceApp.tsx` owns frames, active-frame selection, focus state, settings, todo and habit state, trash, persistence and commands. It also subscribes to the app-wide Pomodoro, reminders and bookmark stores, assembles the `WorkspaceView` value and installs the global keyboard listener.
- The `WorkspaceView` interface is currently exported from `WorkspaceApp.tsx`. It is the snapshot-and-actions seam between orchestration and presentation: adapters receive derived data, refs, registration callbacks and event actions rather than owning feature state or persistence.
- `OperatorConsole.tsx` is the only production adapter. It renders the existing three-side design through `Mainframe`, `Stack`, `Dock`, `FeaturePanel`, `SettingsPanel`, `CommandPalette` and the reminder/music components.
- `src/workspace/view.ts` defines `WorkspaceViewId` (`operator`, `calm`, `immersive`, `overview`), the operator default and picker metadata. `src/workspace/view-setting.ts` loads and saves the selection. Missing, unknown, damaged or inaccessible stored values fall back to `operator`.

Settings presents all four view choices. The choice persists under **`focus-space-workspace-view`**, independently of appearance, and is restored on reload. However, `WorkspaceApp` currently returns `<OperatorConsole workspace={workspace} />` unconditionally: choosing Calm Workspace, Immersive Focus or Daily Overview saves the ID but does not yet change the rendered layout. Those adapters are planned, not shipped.

## Operator Console layout

The adapter renders a fixed-viewport `.stage` / `.canvas` with these regions:

| Region | Component or element | Role |
|---|---|---|
| left | `Stack` inside `.left-side` | Promotable previews of non-active, non-parked frames; can collapse to a rail. |
| main | `Mainframe` inside `.main-side` | The active feature editing surface. |
| right | `Dock` inside `.right-side` | Visible feature navigation, Now Playing and Settings; can collapse to a rail. |
| overlays | `FeaturePanel`, `SettingsPanel`, `CommandPalette` | Frame selection/creation, preferences, commands, search and Recently deleted. |
| status | header, footer, `ReminderBanner`, overdue and Undo banners | Timer/weather/reminder status, keyboard hints and transient actions. |

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

## Styling

- `src/index.css` contains global font/reset basics.
- `src/App.css` contains the current application and Operator Console layout styles.
- `src/components.css` contains shared component and feature styles.
- `src/components/DesignPrototype.css` belongs only to the development prototype.

The planned design-system phase will separate view-owned accents/structure from dark/light neutral tokens and split these styles into scoped base, chrome, feature and view files. That token and file split has not landed yet.

## Tests and checks

The project has both unit and browser coverage; it is not a no-test prototype. `npm test` runs Vitest (excluding `e2e/`) and then Playwright. Feature tests cover stores, parsing, migrations, timers, habits, reminders, bookmarks, music and other behavior; `src/workspace/view-setting.test.ts` covers workspace-view loading and saving. Browser specifications under `e2e/` exercise the real app, including keyboard and feature flows.

Use `npm run build` for the production TypeScript/Vite build and `npm run lint` for Oxlint. `npm run e2e` runs Playwright alone.

## Rollout status and approved next steps

Phase 1 established the seam without replacing the current design. The remaining approved work is:

1. **Phase 2:** add shared view/theme tokens, scoped styles, configurable palette placement and cross-view smoke tests; preserve the existing keyboard semantics.
2. **Phases 3–5:** implement Calm Workspace, Immersive Focus and Daily Overview as real adapters over `WorkspaceView`, reusing shared frames, stores and actions. Non-default adapters are planned to be lazy-loaded.
3. **Phase 6:** after feature parity, remove the development-only `?variant=` gate and `DesignPrototype`, finish design documentation and record the shared-state/four-adapter decision.

Until those phases land, do not describe the picker as a working four-layout switch or the prototype variants as production views. See `docs/design/design-rollout-plan.md` for acceptance criteria and `docs/design/feature-guide.md` for current feature behavior and planned presentation.
