export type WorkspaceViewId = "operator" | "calm" | "immersive" | "overview";

export const DEFAULT_WORKSPACE_VIEW: WorkspaceViewId = "operator";

export const workspaceViewMeta: Record<WorkspaceViewId, { label: string; description: string }> = {
  operator: {
    label: "Operator Console",
    description: "The current dense, keyboard-first control surface.",
  },
  calm: {
    label: "Calm Workspace",
    description: "A quieter everyday workspace with priorities and next actions beside the active frame.",
  },
  immersive: {
    label: "Immersive Focus",
    description: "A minimal session view with the timer or active feature at the centre.",
  },
  overview: {
    label: "Daily Overview",
    description: "A planning surface that shows focus, task, habit, reminder, note and bookmark summaries together.",
  },
};
