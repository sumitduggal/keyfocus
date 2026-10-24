# DESIGN.md: KeyFocus in God's Eye View style

## Direction
Dark operator console. Deep navy-black ground, faint topographic lines, cyan (#3ec8ff) as the single accent, amber only for warnings. Monospace for data, condensed display face (Rajdhani) for labels and headings, Inter for readable body copy.

## Rules
- One accent colour. Amber only for warnings or pending keys.
- Every panel: 1px cyan-tinted border, 6px radius, translucent navy fill.
- Labels are uppercase with wide tracking. Numbers and IDs use monospace.
- Touch targets at least 40px. Visible focus ring on every control.
- The timer is the focal point: a glowing ring with a progress arc.
- Phone width: rails stack, the stage comes first, no horizontal scroll.

## Open items
- Features rail is hidden below 1100px. Consider a tab row on tablets.
- Real app code is not changed yet; this file governs the artifact only.
