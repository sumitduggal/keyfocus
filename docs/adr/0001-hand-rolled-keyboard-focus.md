# Hand-rolled keyboard and focus navigation

Keyfocus is navigated almost entirely by keyboard across three sides, with a two-level focus model: a side holds focus, or focus steps *into* an item inside it. Rather than native tabbing or a focus library (roving-tabindex, focus traps), the behaviour lives in one global `keydown` handler plus a handful of focus-index state variables in `src/App.tsx`.

The navigation is spatial and non-standard — Alt+←/→ crosses sides, Enter steps into a side, and Enter on a stack frame **promotes** it into main. No off-the-shelf focus library models promotion, so bending one to fit costs more than writing the handler directly.

Consequence: keyboard changes are local to that handler, but it carries many branches and their order matters. Extend the existing model rather than dropping in a focus library.
