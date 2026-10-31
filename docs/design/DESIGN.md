# Keyfocus design system

One workspace has four views, not four feature sets. Every view renders the same active frame, recency-ordered stack, feature data and commands; choosing a view changes presentation only. **Operator Console** (`operator`) is the default.

## Views

| View | ID | Direction |
|---|---|---|
| **Operator Console** | `operator` | Dense, keyboard-first control surface: stack, active frame and dock on a three-side canvas. Preserve the current layout and behaviour. |
| **Calm Workspace** | `calm` | Spacious everyday workspace: feature/stack navigation, active frame and a context area for priorities, next actions and Now Playing. |
| **Immersive Focus** | `immersive` | Minimal session surface: active timer or feature at the centre, with a compressed stack, bottom feature dock and global playback. |
| **Daily Overview** | `overview` | Planning surface: top navigation and a bento grid of read-only feature summaries, each routing into the real feature. |

View-specific structure may compress or reposition the three sides, but must not turn frames into view-local tabs or duplicate feature editing. Overview summaries never invent sample data or own a second timer, todo list or other feature state.

## Colour and tokens

Apply structure and accents with `data-workspace-view="operator|calm|immersive|overview"`; apply appearance independently with `data-theme="dark|light"`. Every view supports both themes.

- **View tokens:** `--accent`, `--accent-text`, `--accent-soft` and `--accent-contrast` express the selected view: cyan for Operator, green for Calm and Immersive, violet for Overview. Use accents for selection, progress, primary actions and focus—not large fills or body copy.
- **Theme tokens:** ground, surface, raised surface, border, shadow, primary text, muted text and faint text are neutral and theme-owned. A view must not redefine them to simulate dark or light mode.
- **Semantic tokens:** success, warning and danger retain their meaning across views and themes. Amber remains reserved for warnings or pending states; do not reuse the view accent as a status colour.
- Components consume tokens rather than raw colours. Check text, controls, focus indicators and meaningful graphics against WCAG AA contrast in every view/theme pair.

## Type

Use Inter for body copy, controls and readable feature content. Operator retains Rajdhani for condensed headings and uppercase labels; monospace is reserved for timers, counts, IDs and shortcuts. Other views use Inter with weight and size rather than additional font families.

Keep labels concise; uppercase and wide tracking are for short eyebrows only. Body text stays left-aligned, timer numerals use tabular figures, and text must remain usable at 200% zoom without clipping or loss of controls.

## Space and shape

Use a 4px base unit, with 8/12/16px control and content gaps and 24/32px section separation. Operator may use tighter 4/8px rhythms; Calm and Immersive favour generous negative space; Overview uses a consistent grid gap. These are density differences, not different component sizes or behaviours.

Interactive targets are at least 40×40px, including icon buttons and compact rows. Use restrained radii and 1px borders to establish hierarchy; decoration, glow and ambient gradients must not reduce legibility or obscure focus.

## Keyboard and accessibility

- The global two-level model is identical everywhere: Alt+Left/Right moves between sides, Enter steps in or promotes a stack frame, and Escape steps back or closes the top overlay.
- ⌘/Ctrl+K opens the same command palette. Arrow navigation, stack deletion and existing feature shortcuts keep their meaning; inputs and overlays retain their established handling and shortcut order.
- Keep a visible focus indicator on every interactive element. DOM order, accessible names and focus order must match the visual task order, including when layout responds or a view changes.
- Restore focus deliberately after promotion, closing an overlay or changing views. Lazy loading or animation must never strand focus on a removed node.
- Use native controls and appropriate ARIA for selected, expanded, pressed and active-descendant states. Icon-only controls need accessible names; status changes must not rely on colour alone.

## Motion

Motion explains promotion, overlay entry and timer progress; it does not delay input or communicate new information by itself. Keep transitions short and consistent, avoid layout-shifting entrances, and never animate the stack in a way that misrepresents its recency order. Honour `prefers-reduced-motion` by removing non-essential movement, parallax, ambient animation and smooth scrolling while preserving immediate state feedback.

## Empty and loading states

Use real zero states: explain what is absent and offer one relevant shared action, such as creating a frame, opening the command palette or choosing a feature. Keep the active frame and stack distinct: an empty stack is not an empty workspace. Overview tiles show genuine zero or unavailable values with a route to the feature, never mock entries. Loading a lazy view preserves the workspace and shows a stable, keyboard-safe fallback rather than a blank screen.

## Responsive behaviour

All views work at desktop, tablet and phone widths without horizontal page scrolling. Preserve the active frame as the primary content; stack and dock controls may collapse into reachable disclosures on narrower screens, but their keyboard meaning and focus order do not change.

- **Operator:** move from three sides to compact rails, then place the main stage first on phones.
- **Calm:** collapse navigation and context before reducing active-frame space; keep command access available.
- **Immersive:** keep the central session, feature dock, latest-opened control and playback reachable without overlap.
- **Overview:** reduce the bento grid to fewer columns and then one column; preserve summary reading order and primary routes.

Content may scroll within its intended region. Controls must remain reachable at zoom, with long titles wrapping or truncating accessibly rather than forcing overflow.

## Notices and announcements

Use the shared `Notice` component for short messages across the workspace. Configure `presentation` as `banner`, `toast` or `inline`; use `durationMs={null}` for a persistent notice and a finite duration with `onDismiss` for a temporary notice that fades away. Set `placement` and `tone` for its position and visual status. Set `announcement` to `polite` or `assertive` when assistive technology should announce it; an assertive announcement maps to the alert role. “Alert” names announcement urgency, while banner, toast and inline name the notice presentation. Dialogs, menus, popovers and disclosures remain separate interaction patterns.

See the [annotated Keyfocus terminology guide](terminology/index.html) for screenshots and the current component vocabulary.
