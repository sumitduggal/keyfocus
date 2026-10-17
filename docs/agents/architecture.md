# Architecture

Keyfocus is a **keyboard-first focus workspace**: a single-page React app that renders a three-side canvas of frames and moves focus between them with the keyboard. It is client-only — no backend, no router, no tests — and ships as a static Vite build.

Everything of substance lives in `src/App.tsx` (~440 lines). There is no component split or feature folder; read that one file to understand the app. Vocabulary for the domain terms used here is in `CONTEXT.md`.

## Layout

Three DOM regions over a fixed-viewport canvas (`.stage` / `.canvas`):

| Side | Element | Role |
|---|---|---|
| left | `<aside class="side-region left-side">` (`App.tsx:379`) | The **stack** — an animated 3D card stack of every non-active frame (`.frame-stack`, one `motion.div` per frame at `383`). |
| main | `<section class="side-region main-side">` (`391`) | The **active frame**, rendered by `FrameCard`. |
| right | `<aside class="side-region right-side">` (`396`) | The dock: Profile, feature links, Settings, Log out. |
| overlay | feature flyout aside (`404`) | Lists the frames of one feature. |
| overlay | command palette (`427`–`442`) | The ⌘K command input and menu. |

`src/main.tsx` mounts `App` in `StrictMode`.

## Domain types

Declared at `App.tsx:16-19`:

- `Feature` — the six feature kinds. `Command` adds `'Search'`. `Side` is `'left' | 'main' | 'right'`.
- `WorkspaceFrame` — `{ id, feature, title, eyebrow, description, details }`.
- `featureMeta` (`21-28`) — per-feature glyph, description, and default frame content.

## Rendering a frame

`FrameCard` (`33-110`) branches on `frame.feature`:

- **pomodoro** → timer view (`93`).
- **notes** → Editor.js host (`101`).
- **anything else** → a generic frame: eyebrow, title, description, and the static `details` list (`104`). habits, reminders, focus music, and todo list all land here, so they are placeholders.

## The keyboard and focus model

This is the heart of the app and the part most likely to surprise you.

Focus is a **two-level model**. `focusedSide` (`124`) says which side owns focus; `withinSide` (`125`) says whether focus is on the side itself or has stepped *into* an item inside it. Enter steps down a level; Escape steps back out.

Focus position is held as state, one index per region:

- `stackFocusIndex` (`123`) — highlighted frame in the left stack (-1 = none).
- `rightFocusIndex` (`131`) — dock item; 0 = Profile, 1..6 = features, 7 = Settings, 8 = Log out (mapping at `264-268` and `366`).
- `menuFocusIndex` (`129`) — highlighted command or search result.
- `entryFocusIndex` (`134`) — highlighted row in the feature flyout.

One global `keydown` listener (`199-305`) drives everything, and its order matters:

1. **⌘/Ctrl+K** — open the command palette (`201-210`).
2. **Escape** — close the menu and drop focus back to the main side (`211-219`).
3. If the feature flyout is open it handles its own keys — return (`220`).
4. If the palette is open or the target is an input, return (`221`).
5. **Backspace/Delete** on a highlighted stack frame removes it (`222-238`).
6. **Alt+←/→** moves the focused side, stepping into the stack when entering left (`239-251`).
7. **↑/↓** moves within the stack (`252-261`) or the dock (`262-271`).
8. **Enter** (`272-301`): if not yet `withinSide`, step into the focused side; otherwise, on the left stack, **promote** the highlighted frame into main; on the right dock, open the feature (pomodoro opens directly, the rest open the flyout).

**Promotion** (`287-296`) is the app's central gesture: it reorders `frames` so the chosen frame is first and the previously active frame takes second place, then makes the chosen frame active. The stack is therefore a recency-ordered list, and `stackedFrames` (`149`) is just `frames` minus the active one.

Focus is applied with `requestAnimationFrame` after state updates so the target node exists before `.focus()` is called (e.g. `176`).

## Command palette

`runCommand` (`307-324`) creates a frame from `featureMeta[command]` and prepends it; `Search` flips `searchMode` on. `visibleCommands` (`150`) filters the fixed command list; `searchResults` (`151`) filters existing frames. `commandKeyDown` (`326-354`) handles arrow/enter/escape for both modes. Selection is reflected with ARIA (`aria-activedescendant`, `role="menu"`; `428`, `436`).

## Feature flyout

`openFeaturePanel` (`356-362`) stores the feature and its anchor Y so the flyout sits beside the clicked dock item. A `focusin` listener (`184-198`) closes the flyout when focus leaves it. Arrow keys, Escape, and Tab-wrapping are handled on the aside (`404-422`).

## Notes frame — Editor.js

When `frame.feature === 'notes'`, `FrameCard` (`40-62`) instantiates Editor.js into `editorHost`. It loads `noteBody` as saved `OutputData` JSON, or falls back to one paragraph block per line. Tools: header, list, quote, checklist, image (uploads become base64 data URLs via `FileReader`, `53`), inline code, code, link, marker. `onChange` saves `editor.save()` JSON through `noteChangeRef` (`38`, `59`). The editor is destroyed on cleanup after `isReady` (`62`).

The notes frame previously used CodeMirror and now uses Editor.js; `docs/adr/` records the surrounding decisions.

## Pomodoro frame

State at `64-66`; the tick interval at `79-85`; a Web Audio beep on completion (`68-78`). Presets and the custom field call `chooseTimer` (`88`). Duration persists to `localStorage` (`87`).

## Persistence

Three keys, each read in a `useState` initializer and written from a `useEffect`:

| Key | Holds | Read | Write |
|---|---|---|---|
| `focus-space-frames` | the frame list | `117-121` | `165` |
| `focus-space-note-bodies` | note JSON per frame id | `135-138` | `166` |
| `focus-space-pomodoro-duration` | minutes | `64-65` | `87` |

Frames are migrated on load by merging saved partials over `initialFrame` (`119-120`). There is no server — see `docs/adr/0002`.

## Styling

- `src/index.css` — font and reset basics.
- `src/App.css` — all app styles. It is **minified** (several rules per line) and has grown by appending later rules that override earlier ones: `.right-side` appears at lines 4, 9 and 16; `.feature-links` at 9, 12 and 13; `.note-frame` at 9 and 21. Later wins, so when editing a selector find its **last** definition.

## Known loose ends

- **Placeholder features**: only notes and pomodoro do anything; habits, reminders, focus music, and todo list render the generic frame.
- **Settings is inert**: the Settings button only flips its own label (`compactMode`, `126`); it has no effect on layout or behaviour.
- **Stock template leftovers**: `README.md` is the untouched Vite template.
- `src/editorjs.d.ts` hand-declares three Editor.js modules that ship without types.
- No tests, no CI, and no lint rules beyond `.oxlintrc.json`. Scripts are the standard Vite set — see `package.json`.
- `docs/design/untitled.pen` is a design file (Penpot), not code.
