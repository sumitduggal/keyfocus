// Simple text glyphs that match the rest of the interface. The trailing selector keeps them
// monochrome instead of colour emoji.
const text = (glyph: string) => `${glyph}︎`;

export const ICONS = [
  "↻", "◷", "★", "♥", "♪", "☀", "☾", "✎", "✓", "⚑", "⚡", "❄", "☂", "✿", "⌂", "✉", "☎", "⚙", "✂", "◆", "●", "▲", "✦", "☕",
].map(text);

export const DEFAULT_HABIT_ICON = text("↻");
export const DEFAULT_REMINDER_ICON = text("◷");

// Saved icons are short text; anything else is ignored.
export const isIcon = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 4;
