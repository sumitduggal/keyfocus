# Four workspace views: implementation plan

Status: proposed  
Last reviewed: 2026-10-29

## Goal

Ship the existing design and all three approved mock directions as selectable production views:

| View | Prototype | Purpose |
|---|---|---|
| **Operator Console** | [existing app](http://localhost:5174/) | The current dense, keyboard-first control surface. This remains the default. |
| **Calm Workspace** | [Variant A](http://localhost:5174/?variant=A) | A quieter everyday workspace with priorities and next actions beside the active frame. |
| **Immersive Focus** | [Variant B](http://localhost:5174/?variant=B) | A minimal session view with the timer or active feature at the centre. |
| **Daily Overview** | [Variant C](http://localhost:5174/?variant=C) | A planning surface that shows focus, task, habit, reminder, note and bookmark summaries together. |

These are **views**, not separate apps. The person chooses a view in Settings; frames, feature data, persistence, keyboard shortcuts and feature behaviour stay identical underneath.

## Assumptions

- Operator Console remains the default for existing users and for first launch.
- View choice persists in `localStorage`; no account or sync is added.
- Dark/light appearance remains a separate setting. Every production view supports both, while keeping the approved mock's accent and structure.
- The development-only `DesignPrototype` is not promoted directly. Production views are rebuilt behind the seam below; the prototype is archived on a throwaway branch before the dev-only route is removed.
- Feature visibility stays as it is today unless a separate issue changes it. In particular, Notes can exist in the stack but is not currently in the visible dock list.
- Focus Music remains app-wide playback, not something that stops when a frame changes.

## Target shape

The seam is a single **WorkspaceView interface**. Each design is an **adapter** at that seam.

```text
src/App.tsx
  state, global keyboard model, commands, persistence
        │
        ▼
WorkspaceView interface
        │
        ├── OperatorConsoleView   (current design)
        ├── CalmWorkspaceView     (Variant A)
        ├── ImmersiveFocusView    (Variant B)
        └── DailyOverviewView     (Variant C)
```

This gives the app locality: feature behaviour changes once in the existing stores and actions, and all four views inherit it. It also gives leverage: tests cross one interface rather than four separate page implementations.

The interface should expose snapshots plus actions, not copies of app internals. At minimum it needs:

- `frames`, `activeFrame`, `stackedFrames` and per-feature data snapshots.
- `theme` and the selected `view`.
- Actions such as `promoteFrame`, `openFeature`, `showFrame`, `runCommand` and `openSettings`.
- The existing two-level focus model: side focus and focus within a side.
- A way for the adapter to render the shared command palette in its chosen position.

The exact prop shape is decided in Phase 1. The rule is that adapters render and route input; they do not own feature state or persistence.

## Proposed file structure

```text
src/
├── workspace/
│   ├── view.ts                 # WorkspaceViewId and the shared interface
│   ├── WorkspaceApp.tsx        # state assembly, actions, global keyboard handling
│   ├── view-setting.ts         # load/save/migrate the selected view
│   └── views/
│       ├── OperatorConsole.tsx
│       ├── CalmWorkspace.tsx
│       ├── ImmersiveFocus.tsx
│       └── DailyOverview.tsx
├── components/                 # shared feature frames, previews, palette, popups
├── styles/                     # split from App.css/components.css during cleanup
└── App.tsx                     # thin mount around WorkspaceApp
```

All four view adapters are code-split with `React.lazy`, so choosing one view does not ship the other three in the initial route.

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

1. Remove the development-only `?variant=` gate and the throwaway `DesignPrototype` from main once feature parity is reached.
2. Replace `docs/design/DESIGN.md` with a four-view design system covering tokens, type, spacing, focus, motion, empty states and responsive rules.
3. Update `docs/agents/architecture.md` to describe `WorkspaceApp`, the view seam and the four adapters.
4. Add an ADR recording the decision to use one shared workspace state with four view adapters.
5. Update this plan with completion notes or convert unfinished items into `.scratch/<feature>/spec.md` issues.
6. Review the feature guide after implementation and remove any prototype-only wording.

**Verification**

- `npm run build`, `npm run lint` and `npm test` pass.
- A clean checkout can select every view, reload and keep the choice.
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
| Prototype code is promoted with mock data. | Rebuild production adapters from the interface; remove `DesignPrototype` only after parity. |

## Immediate next step after approval

Start Phase 0, then Phase 1. No new visual view ships until the existing Operator Console renders through the shared interface without regressions.
