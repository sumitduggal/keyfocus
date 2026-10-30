import type { KeyboardEvent, RefObject } from "react";
import type { Command, Feature, Side, Theme, WorkspaceFrame } from "../types";
import type { Settings } from "../settings";
import type { Habit } from "../habits";
import type { PomodoroState } from "../pomodoro";
import type { FrameData } from "../frame-summary";
import type { TodoItem, TodoViewState } from "../todo";

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

export interface WorkspaceView {
  frames: WorkspaceFrame[];
  activeFrame: WorkspaceFrame;
  stackedFrames: WorkspaceFrame[];
  featureEntries: WorkspaceFrame[];
  featureMenuEntries: WorkspaceFrame[];
  searchResults: WorkspaceFrame[];
  visibleCommands: Command[];
  trashRows: { id: string; title: string; hint: string }[];
  pomodoro: PomodoroState;
  settings: Settings;
  theme: Theme;
  workspaceView: WorkspaceViewId;
  frameData: FrameData;
  noteBodies: Record<string, string>;
  todoLists: Record<string, TodoItem[]>;
  habitLists: Record<string, Habit[]>;
  todoViews: Record<string, TodoViewState>;
  framesCountByFeature: Record<Feature, number>;
  todoOpenCount: number;
  todoOverdueCount: number;
  overdueLists: { frame: WorkspaceFrame; count: number }[];
  overdueBannerOpen: boolean;
  focusedSide: Side;
  withinSide: boolean;
  stackFocusIndex: number;
  rightFocusIndex: number;
  entryFocusIndex: number;
  menuFocusIndex: number;
  activeMenuId: string | undefined;
  settingsOpen: boolean;
  settingsAnchorY: number | null;
  menuOpen: boolean;
  query: string;
  featureMenu: Feature | null;
  trashMenu: boolean;
  searchMode: boolean;
  showTrashRow: boolean;
  dockCollapsed: boolean;
  stackCollapsed: boolean;
  barHost: HTMLElement | null;
  barActive: boolean;
  featurePanel: Feature | null;
  featureAnchorY: number | null;
  undo: { message: string; restore: () => void } | null;
  reduceMotion: boolean;
  actionInputRef: RefObject<HTMLInputElement | null>;
  featureAsideRef: RefObject<HTMLElement | null>;
  frameScope: RefObject<HTMLDivElement | null>;
  registerItem: (id: string, node: HTMLButtonElement | null) => void;
  registerEntry: (id: string, node: HTMLButtonElement | null) => void;
  registerStack: (id: string, node: HTMLElement | null) => void;
  registerSide: (side: Side, node: HTMLElement | null) => void;
  registerFrame: (id: string, node: HTMLElement | null) => void;
  getEntry: (id: string) => HTMLButtonElement | null;
  setBarHost: (node: HTMLElement | null) => void;
  onToggleStack: () => void;
  onToggleDock: () => void;
  onStackSelect: (index: number) => void;
  onPromoteStackFrame: (index: number) => void;
  onMainFocus: () => void;
  onOpenFeatureDirectly: (feature: Feature) => void;
  onOpenSettings: () => void;
  onWorkspaceViewChange: (view: WorkspaceViewId) => void;
  onSettingsChange: (patch: Partial<Settings>) => void;
  onSettingsClose: (restoreFocus: boolean) => void;
  onToggleTheme: () => void;
  onFeaturePress: (feature: Feature) => void;
  onFeaturePanelClose: () => void;
  onFeaturePanelCreate: (feature: Feature) => void;
  onFeaturePanelEntryClick: (frame: WorkspaceFrame) => void;
  onRestoreTrash: (id: string) => void;
  onOpenTrash: () => void;
  onCommandPaletteQueryChange: (value: string) => void;
  onCommandPaletteFocus: () => void;
  onCommandKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onChooseCommand: (command: Command) => void;
  onRunCommand: (feature: Feature) => void;
  onShowFrame: (id: string) => void;
  onSideSelect: (side: Side) => void;
  onUndo: () => void;
  onDismissOverdue: () => void;
  onHabitsChange: (habits: Habit[]) => void;
  onDeleteActiveFrame: () => void;
  onTodoViewChange: (view: TodoViewState) => void;
  onTitleChange: (title: string) => void;
  onTodoChange: (items: TodoItem[]) => void;
  onNoteChange: (value: string) => void;
  onRightFocus: (index: number) => void;
}
