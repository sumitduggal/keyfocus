import type { Command, Feature, FeatureMeta, WorkspaceFrame } from "./types";

export const featureMeta: Record<Feature, FeatureMeta> = {
  habits: {
    glyph: "↻",
    description: "Build a repeatable routine",
    frame: {
      eyebrow: "HABITS",
      title: "Habits",
      description: "Small practices, made visible and easy to return to.",
      details: [],
    },
  },
  reminders: {
    glyph: "◷",
    description: "Keep time-aware notes",
    frame: {
      eyebrow: "REMINDERS",
      title: "Reminders",
      description: "Time-aware prompts that stay close to your current context.",
      details: [],
    },
  },
  "focus music": {
    glyph: "♪",
    description: "Open a listening space",
    frame: {
      eyebrow: "FOCUS MUSIC",
      title: "Focus Music",
      description: "A calm listening space for the work in front of you.",
      details: ["Deep work mix", "Ambient room", "25 minute session"],
    },
  },
  notes: {
    glyph: "✎",
    description: "Capture a thought",
    frame: {
      eyebrow: "NOTES",
      title: "Notes",
      description: "A lightweight place for thoughts, references, and ideas.",
      details: ["Launch idea", "Research reference", "Things to explore"],
    },
  },
  "todo list": {
    glyph: "☑",
    description: "Track a short list",
    frame: {
      eyebrow: "TODO LIST",
      title: "Todo List",
      description: "A focused list for the next few things worth finishing.",
      details: [],
    },
  },
  bookmarks: {
    glyph: "⚐",
    description: "Save and organize links",
    frame: {
      eyebrow: "BOOKMARKS",
      title: "Bookmarks",
      description: "Links worth keeping, in collections you can search.",
      details: [],
    },
  },
  pomodoro: {
    glyph: "◉",
    description: "Start a timed session",
    frame: {
      eyebrow: "POMODORO",
      title: "Pomodoro",
      description: "A simple work / rest rhythm for making progress.",
      details: ["25:00 work interval", "05:00 short break", "4 rounds planned"],
    },
  },
};

// Features shown in the dock, ⌘K and the flyout. Hidden features keep their metadata so they can return.
export const visibleFeatures: Feature[] = ["pomodoro", "todo list", "habits", "reminders", "bookmarks"];

// These open their one frame instead of listing frames to pick from or create.
export const singleFrameFeatures: Feature[] = ["pomodoro", "habits", "reminders", "bookmarks"];

export const commandNames: Command[] = [...visibleFeatures, "Search"];

export const initialFrame: WorkspaceFrame = {
  ...featureMeta.pomodoro.frame,
  id: "main",
  feature: "pomodoro",
};

// Keys for the app's own saved state. Feature modules keep theirs next to their code.
export const FRAMES_KEY = "focus-space-frames";
export const NOTE_BODIES_KEY = "focus-space-note-bodies";
export const THEME_KEY = "focus-space-theme";
export const POMODORO_DURATION_KEY = "focus-space-pomodoro-duration";
