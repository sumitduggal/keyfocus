# Four workspace views: implementation plan

Status: verified — four production adapters shipped, prototype retired, full build/lint/test suite green

Last reviewed: 2026-10-30

## Goal

Ship the existing design and all three approved mock directions as selectable production views:

| View | Historical origin | Purpose |
|---|---|---|
| **Operator Console** | Original application | The original dense, keyboard-first control surface. This remains the default. |
| **Calm Workspace** | Variant A | A quieter everyday workspace with priorities and next actions beside the active frame. |
| **Immersive Focus** | Variant B | A minimal session view with the timer or active feature at the centre. |
| **Daily Overview** | Variant C | A planning surface that shows focus, task, habit, reminder, note and bookmark summaries together. |

These are **views**, not separate apps. The person chooses a view in Settings; frames, feature data, persistence, keyboard shortcuts and feature behaviour stay identical underneath.

The original prototype implementations remain available for historical comparison on `archive/workspace-design-prototypes`. `DesignPrototype` and its development-only `?variant=` gate were removed from the main branch to prevent prototype global CSS from leaking into the production application. Production now always mounts `App`; query parameters do not select a prototype.

## Implementation status

- **Phases 0–1 complete:** the baseline was stabilised, Operator Console was extracted, the shared interface and keyboard orchestration were established, and the Settings picker and persisted view selection were added.
- **Phase 2 implementation complete:** shared view/theme tokens, configurable command-bar placement, per-view styling and the cross-view browser smoke-test scaffold are in place. Broader stylesheet consolidation remains cleanup work.
- **Phases 3–5 complete:** Calm Workspace, Immersive Focus and Daily Overview are production adapters over real shared workspace data, stores and actions. The three non-default adapters use the shared lazy-loading path; cross-view, responsive and regression checks pass in `e2e/workspace-views.spec.ts`.
- **Phase 6 complete:** the prototype route and its global styles are no longer in the main application, the documentation describes the production adapters, and the full suite (`npm run build`, `npm run lint`, `npm test`) is green.

The rollout has passed its acceptance criteria.

## Assumptions

- Operator Console remains the default for existing users and for first launch.
- View choice persists in `localStorage`; no account or sync is added.
- Dark/light appearance remains a separate setting. Every production view supports both, while keeping the approved mock's accent and structure.
- Production views were rebuilt behind the seam below rather than promoted directly from the mock implementations. The original prototypes live only on `archive/workspace-design-prototypes`; the main application always mounts `App`.
- Feature visibility stays as it is today unless a separate issue changes it. In particular, Notes can exist in the stack but is not currently in the visible dock list.
- Focus Music remains app-wide playback, not something that stops when a frame changes.

## Implemented shape

The seam is a single **WorkspaceView interface**, exported from `src/workspace/view.ts`. Each design is an **adapter** at that seam.

```text
src/workspace/WorkspaceApp.tsx
  state, global keyboard model, commands, persistence
        │
        ▼
WorkspaceView interface + shared WorkspaceParts
        │
        ├── OperatorConsole       (original design, eagerly loaded)
        ├── CalmWorkspace         (Variant A, lazy-loaded)
        ├── ImmersiveFocus        (Variant B, lazy-loaded)
        └── DailyOverview         (Variant C, lazy-loaded)
```

This gives the app locality: feature behaviour changes once in the existing stores and actions, and all four views inherit it. It also gives leverage: tests cross one interface rather than four separate page implementations.

The interface exposes snapshots plus actions, including:

- `frames`, `activeFrame`, `stackedFrames` and per-feature data snapshots.
- `theme` and the selected `workspaceView`.
- Shared actions for promotion, feature/frame opening, commands, Settings and feature data updates.
- The existing two-level focus model, side/item registration callbacks and command-bar host registration.

Adapters render and route input; they do not own feature state or persistence. `src/workspace/WorkspaceParts.tsx` shares the active `Mainframe`, command palette, Settings/feature overlays, reminder banner and transient workspace actions.

## Current file structure

```text
src/
├── workspace/
│   ├── view.ts                 # WorkspaceViewId, metadata and the shared interface
│   ├── WorkspaceApp.tsx        # state assembly, actions, global keyboard handling
│   ├── WorkspaceParts.tsx      # shared active frame, palette and overlays
│   ├── view-setting.ts         # load/save the selected view
│   └── views/
│       ├── OperatorConsole.tsx
│       ├── CalmWorkspace.tsx
│       ├── ImmersiveFocus.tsx
│       └── DailyOverview.tsx
├── components/                 # shared feature frames, previews, palette, popups
└── App.tsx                     # thin re-export of WorkspaceApp
```

The three non-default adapters are code-split with `React.lazy`; Operator Console stays in the initial route. Per-view CSS lives beside the adapters, while shared application and feature styles remain in `App.css` and `components.css` pending further cleanup.

## Phase 0 — Stabilise the baseline

1. Fix the date-sensitive habits browser test that currently clicks the first weekday even when that day is disabled. Choose the first enabled weekday instead.
2. Capture the current prototype state on a throwaway branch so Variants A–C remain inspectable after production work starts.
3. Add `WorkspaceViewId` to the design vocabulary and record the four names above.
4. Decide the exact Settings labels and short descriptions for the four views.

**Verification**

- `npm test` passes.
- The existing app still loads at `/` with no query parameter.
- No visual or behavioural change has landed yet.

## Phase 1 — Extract Operator Console without changing it

1. Move the current canvas layout out of `App.tsx` into `OperatorConsole`.
2. Define the `WorkspaceView` interface with the current app as its first consumer.
3. Move global keyboard handling into `WorkspaceApp`, keeping the current side model and shortcut order.
4. Reuse existing `Mainframe`, `Stack`, `Dock`, `FeaturePanel`, `SettingsPanel`, `CommandPalette`, `FramePreview` and reminder/music stores.
5. Add the persisted `workspaceView` setting with `operator` as the default. The migration must accept missing, unknown and damaged values.
6. Add a view picker to Settings. Keep Appearance separate from Workspace view.
7. Wire view selection so reloading restores the chosen adapter.

**Verification**

- Existing browser tests pass against Operator Console.
- New unit tests cover view load/save and migration.
- The extracted app is pixel-close to the current production design; no copy or layout regressions.

## Phase 2 — Shared design system and view seam

1. Split view-owned palettes from feature-owned colours:
   - `data-workspace-view="operator|calm|immersive|overview"` selects structure and accent tokens.
   - `data-theme="dark|light"` selects neutral, surface and contrast tokens.
   - Raw colours move to token definitions; components reference tokens only.
2. Split `App.css`/`components.css` into scoped files for base, chrome, shared features and each view. Keep the current CSS rules findable while the split happens; delete superseded rules as each view lands.
3. Make the command palette anchor configurable so each adapter can place its command bar without changing palette behaviour.
4. Confirm every adapter exposes the three-side focus model. Immersive Focus may compress the stack and dock visually, but Alt+Left/Right, Enter and Escape still have the same meaning.
5. Add a view smoke-test scaffold, starting with Operator Console. Extend the same test as each adapter lands; it is complete only when it covers all four choices and reload persistence.

**Verification**

- `npm run build` and `npm test` pass.
- Keyboard-only navigation completes a representative path in Operator Console.
- Bundle inspection confirms non-default views are lazy-loaded.

## Phase 3 — Calm Workspace (Variant A)

1. Build the light, spacious three-region layout: left feature/recent navigation, central active frame, right context panel.
2. The left frame list is the real stack. Selecting a row **promotes** its frame; it does not become a local tab.
3. The right panel derives from real data: open todo items, the next reminder, current focus state and Now Playing.
4. Reuse the shared `Mainframe` for the central active frame and `FramePreview` for compact frame rows.
5. Keep ⌘K and the command bar available in the calm footer/header position.
6. Add the dark variant of Calm tokens; it should keep the same hierarchy and spacing rather than simply recolouring the light mock.

**Verification**

- Create/promote a Todo frame from Calm Workspace; the stack and frame data match Operator Console after switching views.
- Run a Pomodoro, switch views, and confirm the same timer state appears everywhere.
- The right context panel reflects open todos, the next reminder and Now Playing without duplicating editing logic.
- Desktop, tablet and mobile layouts have no horizontal overflow.

## Phase 4 — Immersive Focus (Variant B)

1. Build the minimal dark shell: central timer/feature surface, bottom feature dock, latest-opened stack, top-right Now Playing and Settings.
2. The feature dock calls the same `openFeature` action as the current dock. Existing single-frame features open directly; multi-instance features open the feature panel.
3. Latest Opened renders `stackedFrames`. Choosing one promotes that frame; it is not a separate local history.
4. The central feature surface renders the real active `Mainframe` once a frame is active. The Pomodoro timer keeps the approved circular treatment.
5. Keep the global player in the top-right and retain app-wide playback when the person switches frames.
6. Add a light token variant after the dark design is approved; both must preserve the same layout and focus order.

**Verification**

- Keyboard shortcuts retain their existing meaning in the compressed layout.
- Clicking Todo List, Habits, Reminders or Bookmarks opens or promotes real frames exactly as the current dock does.
- Latest Opened promotes Notes and Todo frames correctly.
- Playback continues while switching views and frames.
- Mobile keeps the latest-opened control and feature dock reachable without overlap.

## Phase 5 — Daily Overview (Variant C)

1. Build the top navigation and bento grid.
2. Summaries are read-only projections of real stores: focus totals, open todos, Pomodoro state, habit rhythm, upcoming reminders, recent notes, Now Playing and bookmarks.
3. Each summary has one primary route into the real feature: promote an existing frame, open the feature panel or focus the relevant command.
4. Keep Pomodoro controls on the active Pomodoro frame. If no Pomodoro frame is active, the overview button creates or promotes one through the shared action rather than owning a second timer.
5. Add the dark token variant for Overview.

**Verification**

- Overview tiles update when the underlying store changes (for example, completing a Todo item).
- No editable feature logic lives in a tile; edits happen in the promoted frame.
- Focus metrics come from `focus-log` and distinguish completed from partial time.
- Empty states are clear and do not invent sample data.

## Phase 6 — Production cleanup and documentation

Prototype retirement and the architecture, rollout-plan and feature-guide updates are complete, and the final full-suite verification has passed.

1. **Complete:** remove the development-only `?variant=` gate and `DesignPrototype` from the main application, including the prototype global styles; retain the originals on `archive/workspace-design-prototypes`.
2. **Complete:** replace `docs/design/DESIGN.md` with a four-view design system covering tokens, type, spacing, focus, motion, empty states and responsive rules.
3. **Complete:** update `docs/agents/architecture.md` to describe `WorkspaceApp`, the view seam, the four adapters and the shared lazy-loading path.
4. **Complete:** `docs/adr/0003-four-workspace-views.md` records the decision to use one shared workspace state with four view adapters.
5. **Complete:** update this plan with implementation completion and verification notes.
6. **Complete:** review the feature guide after implementation and remove prototype-route wording.

**Verification — passed**

- `npm run build`, `npm run lint` and `npm test` pass (301 unit tests, 75 browser tests).
- `e2e/workspace-views.spec.ts` covers all four views: adapter render and reload persistence, phone-width overflow, the shared ⌘K palette, cross-view data continuity (create in Calm, promote and edit in Immersive, open in Operator) and phone navigation/overlap checks for the compressed layouts.
- Playwright uses `reuseExistingServer: false` so a stale preview server can never silently serve an old build to the e2e suite.
- The prototype branch remains available for historical comparison.

## Cross-view acceptance criteria

The rollout is complete only when all of these hold:

- Switching views never creates, deletes, duplicates or loses frames or feature data.
- All views preserve the domain model: one active frame, a recency-ordered stack, promotion and shared commands.
- ⌘K, Alt+Left/Right, Enter, Escape, stack deletion and the existing feature shortcuts work in every view.
- Feature behaviour is implemented once; adapters do not fork Todo, Habits, Reminders, Bookmarks, Notes, Pomodoro or Music logic.
- All four views work at desktop, tablet and mobile widths without horizontal scrolling.
- All controls meet the existing 40px minimum target and visible-focus rules.
- View and theme choices persist independently.
- Production code does not contain mock/sample feature data.
- Documentation matches the shipped behaviour.

## Test plan by layer

- **Pure logic:** existing unit tests continue to cover feature stores, parsing, totals, migrations and repeat rules.
- **View setting:** load/save/migration tests for missing, damaged and future values.
- **Shared seam:** render each adapter with a small fixed workspace and assert it calls the same action for the same input.
- **Keyboard:** browser tests for a representative path in each view, including the compressed Immersive layout.
- **Data continuity:** browser tests that switch views mid-timer and after creating todos, habits, reminders and notes.
- **Responsive:** browser checks at desktop, tablet and phone widths for each adapter.
- **Regression:** the full existing suite remains green in Operator Console.

## Risks and decisions

| Risk | Mitigation |
|---|---|
| Four views fork feature behaviour. | Put actions and stores behind the shared seam; forbid feature state inside adapters in review. |
| Immersive dock feels like tabs rather than frames. | Route every dock action through `openFeature`; use tests that compare dock behaviour across views. |
| Overview becomes a second editable app. | Make tiles read-only summaries with one shared route into the real frame. |
| CSS overrides become harder to reason about. | Scope every view with `data-workspace-view`, tokenise colours, and split files as views land. |
| Initial bundle grows. | Lazy-load every non-default view and keep shared feature modules common. |
| Dark/light support drifts by view. | Define shared contrast rules and check both themes in each phase's browser verification. |
| Prototype code is promoted with mock data or global styles. | Keep production adapters on the shared interface and real stores; retain the original mocks only on the archive branch. |

## Immediate next steps

None — the rollout is verified. Ongoing cleanup: further stylesheet consolidation out of `App.css`/`components.css` into scoped view files.
