export type Feature = "habits" | "reminders" | "focus music" | "notes" | "todo list" | "pomodoro" | "bookmarks";

export type Command = Feature | "Search";

export type Side = "left" | "main" | "right";

export type Theme = "dark" | "light";

export interface WorkspaceFrame {
  id: string;
  feature: Feature;
  title: string;
  eyebrow: string;
  description: string;
  details: string[];
  stackedAt?: number; // when it went into the stack, in ms; a frame left there for an hour is hidden from it
}

export interface FeatureMeta {
  glyph: string;
  description: string;
  frame: Omit<WorkspaceFrame, "id" | "feature">;
}
