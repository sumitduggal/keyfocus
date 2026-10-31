import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { KeyboardEvent } from "react";
import { useAnimate, useReducedMotion } from "motion/react";
import type { Command, Feature, Side, Theme, WorkspaceFrame } from "../types";
import {
  FRAMES_KEY,
  NOTE_BODIES_KEY,
  THEME_KEY,
  DOCK_COLLAPSED_KEY,
  STACK_COLLAPSED_KEY,
  commandNames,
  featureMeta,
  initialFrame,
  singleFrameFeatures,
  visibleFeatures,
} from "../constants";
import { setStored } from "../storage";
import { loadSettings, saveSettings } from "../settings";
import type { Settings } from "../settings";
import { loadHabits, saveHabits, toggleDay, type Habit } from "../habits";
import { loadFrames, loadNoteBodies, loadTheme } from "../saved-state";
import { formatClock, getPomodoroState, subscribePomodoro } from "../pomodoro";
import type { FrameData } from "../frame-summary";
import { isParked, markStacked, unstamped } from "../stack-expiry";
import { getLibrary, subscribeLibrary } from "../bookmarks-store";
import {
  getRemindersState,
  initReminders,
  registerHabitSource,
  syncTodoRemindersIn,
  removeFrameReminders,
  restoreFrameReminders,
  subscribeReminders,
} from "../reminders-store";
import {
  loadTodoLists,
  loadTodoViews,
  openTodoCount,
  saveTodoLists,
  overdueCount,
  saveTodoViews,
  type TodoItem,
  type TodoViewState,
} from "../todo";
import {
  addTrashEntry,
  loadTrash,
  pruneTrash,
  removeTrashEntry,
  removedItemsBetween,
  restoreRemovedItems,
  saveTrash,
  type TrashEntry,
} from "../todo-trash";
import type { WorkspaceView, WorkspaceViewId } from "./view";
import { loadWorkspaceView, saveWorkspaceView } from "./view-setting";
import { OperatorConsole } from "./views/OperatorConsole";
import "../App.css";
import "../components.css";

const CalmWorkspace = lazy(() =>
  import("./views/CalmWorkspace").then((module) => ({ default: module.CalmWorkspace })),
);
const ImmersiveFocus = lazy(() =>
  import("./views/ImmersiveFocus").then((module) => ({ default: module.ImmersiveFocus })),
);
const DailyOverview = lazy(() =>
  import("./views/DailyOverview").then((module) => ({ default: module.DailyOverview })),
);

const promoteFrames = (
  current: WorkspaceFrame[],
  selectedFrame: WorkspaceFrame,
  previousMain: WorkspaceFrame,
) => [
  selectedFrame,
  previousMain,
  ...current.filter((frame) => frame.id !== selectedFrame.id && frame.id !== previousMain.id),
];

const sideOrder: Side[] = ["left", "main", "right"];

function WorkspaceApp() {
  const [frames, setFrames] = useState<WorkspaceFrame[]>(() => loadFrames(localStorage));
  const [activeFrameId, setActiveFrameId] = useState("main");
  const [stackFocusIndex, setStackFocusIndex] = useState(-1);
  const [focusedSide, setFocusedSide] = useState<Side>("main");
  const [withinSide, setWithinSide] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => loadTheme(localStorage));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsAnchor, setSettingsAnchor] = useState<HTMLElement | null>(null);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [workspaceView, setWorkspaceView] = useState<WorkspaceViewId>(() =>
    loadWorkspaceView(localStorage),
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menuFocusIndex, setMenuFocusIndex] = useState(0);
  const [undo, setUndo] = useState<{ message: string; restore: () => void; trashId?: string } | null>(null);
  const [featureMenu, setFeatureMenu] = useState<Feature | null>(null);
  const [trashMenu, setTrashMenu] = useState(false);
  const [searchMode, setSearchMode] = useState(false);
  const [rightFocusIndex, setRightFocusIndex] = useState(0);
  const [dockCollapsed, setDockCollapsed] = useState(() => {
    try {
      return localStorage.getItem(DOCK_COLLAPSED_KEY) === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    setStored(DOCK_COLLAPSED_KEY, dockCollapsed ? "1" : "0");
  }, [dockCollapsed]);
  const [barHost, setBarHost] = useState<HTMLElement | null>(null);
  const [stackCollapsed, setStackCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STACK_COLLAPSED_KEY) === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    setStored(STACK_COLLAPSED_KEY, stackCollapsed ? "1" : "0");
  }, [stackCollapsed]);
  const focusStackAfterOpen = useRef(false);
  const [featurePanel, setFeaturePanel] = useState<Feature | null>(null);
  const [featureAnchor, setFeatureAnchor] = useState<HTMLElement | null>(null);
  const [entryFocusIndex, setEntryFocusIndex] = useState(0);
  const [noteBodies, setNoteBodies] = useState<Record<string, string>>(() => loadNoteBodies(localStorage));

  const [todoLists, setTodoLists] = useState<Record<string, TodoItem[]>>(() =>
    loadTodoLists(localStorage),
  );
  const [habitLists, setHabitLists] = useState<Record<string, Habit[]>>(() =>
    loadHabits(localStorage),
  );
  const [todoViews, setTodoViews] = useState<Record<string, TodoViewState>>(() =>
    loadTodoViews(localStorage),
  );
  const [trash, setTrash] = useState<TrashEntry[]>(() =>
    pruneTrash(loadTrash(localStorage), new Date()),
  );

  const frameRefs = useRef<Record<string, HTMLElement | null>>({});
  const stackRefs = useRef<Record<string, HTMLElement | null>>({});
  const sideRefs = useRef<Record<Side, HTMLElement | null>>({
    left: null,
    main: null,
    right: null,
  });
  const rightItemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const focusSettingsAfterViewChange = useRef(false);
  const actionInputRef = useRef<HTMLInputElement | null>(null);
  const returnTo = useRef<{ side: Side; within: boolean }>({ side: "main", within: false });
  const quietBarFocus = useRef(false);
  const keepBarFocus = useRef(false);
  const [barActive, setBarActive] = useState(false);
  const featureAsideRef = useRef<HTMLElement | null>(null);
  const featureEntryRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const registerItem = useCallback((id: string, node: HTMLButtonElement | null) => {
    rightItemRefs.current[id] = node;
    if (id === "settings" && node && focusSettingsAfterViewChange.current) {
      focusSettingsAfterViewChange.current = false;
      window.requestAnimationFrame(() => {
        if (node.isConnected) node.focus({ preventScroll: true });
      });
    }
  }, []);
  const registerEntry = useCallback((id: string, node: HTMLButtonElement | null) => {
    featureEntryRefs.current[id] = node;
  }, []);
  const registerStack = useCallback((id: string, node: HTMLElement | null) => {
    stackRefs.current[id] = node;
  }, []);
  const getEntry = useCallback((id: string) => featureEntryRefs.current[id] ?? null, []);
  const reduceMotion = useReducedMotion() ?? false;
  const pomodoro = useSyncExternalStore(subscribePomodoro, getPomodoroState);
  const baseTitle = useRef(document.title);
  useEffect(() => {
    const { phase, remainingSec } = pomodoro;
    document.title =
      phase === "running" ? `${formatClock(remainingSec)} · ${baseTitle.current}`
      : phase === "paused" ? `Paused ${formatClock(remainingSec)} · ${baseTitle.current}`
      : phase === "complete" ? `Done · ${baseTitle.current}`
      : baseTitle.current;
  }, [pomodoro]);
  const [frameScope, animateFrame] = useAnimate<HTMLDivElement>();
  const lastFrameId = useRef(activeFrameId);
  useEffect(() => {
    if (lastFrameId.current === activeFrameId) return;
    lastFrameId.current = activeFrameId;
    if (!reduceMotion && frameScope.current) {
      void animateFrame(frameScope.current, { opacity: [0, 1], x: [28, 0], scale: [0.985, 1] }, { duration: 0.32, ease: [0.22, 1, 0.36, 1] });
    }
  }, [activeFrameId, animateFrame, frameScope, reduceMotion]);

  const activeFrame = frames.find((frame) => frame.id === activeFrameId) ?? frames[0];

  const focusActiveFrame = useCallback(() => {
    const frame = frameRefs.current[activeFrame.id];
    if (frame?.contains(document.activeElement)) return;
    (frame?.querySelector<HTMLElement>("[data-autofocus]") ?? frame)?.focus({ preventScroll: true });
  }, [activeFrame.id]);
  const [stackNow, setStackNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setStackNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const stackedFrames = frames.filter((frame) => frame.id !== activeFrame.id && !isParked(frame, stackNow));
  const previousActive = useRef<string | null>(null);
  useEffect(() => {
    const previous = previousActive.current === activeFrame.id ? null : previousActive.current;
    previousActive.current = activeFrame.id;
    setFrames((current) => markStacked(current, activeFrame.id, previous, Date.now()));
  }, [activeFrame.id]);
  const library = useSyncExternalStore(subscribeLibrary, getLibrary);
  const reminderLists = useSyncExternalStore(subscribeReminders, getRemindersState).lists;
  const frameData: FrameData = {
    todos: todoLists,
    habits: habitLists,
    reminders: reminderLists,
    notes: noteBodies,
    library,
    pomodoro,
    today: new Date(),
  };
  useEffect(() => {
    if (stackCollapsed || !focusStackAfterOpen.current) return;
    focusStackAfterOpen.current = false;
    stackRefs.current[stackedFrames[0]?.id]?.focus();
  }, [stackCollapsed, stackedFrames]);
  const visibleCommands = useMemo(
    () => commandNames.filter((command) => command.toLowerCase().includes(query.toLowerCase())),
    [query],
  );
  const searchResults = useMemo(
    () =>
      frames.filter((frame) =>
        `${frame.title} ${frame.feature} ${frame.description}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [frames, query],
  );
  const featureEntries = useMemo(
    () => (featurePanel ? frames.filter((frame) => frame.feature === featurePanel) : []),
    [featurePanel, frames],
  );
  const featureMenuEntries = useMemo(
    () =>
      featureMenu
        ? frames.filter(
            (frame) =>
              frame.feature === featureMenu &&
              frame.title.toLowerCase().includes(query.toLowerCase()),
          )
        : [],
    [featureMenu, frames, query],
  );
  const trashRows = trash
    .filter((entry) => entry.kind === "list" || frames.some((frame) => frame.id === entry.frameId))
    .map((entry) =>
      entry.kind === "list"
        ? { id: entry.id, title: entry.frame.title, hint: "Deleted list" }
        : { id: entry.id, title: entry.title, hint: "Removed items" },
    );
  const showTrashRow = !query && trashRows.length > 0;
  const menuRowCount = searchMode
    ? searchResults.length
    : trashMenu
      ? trashRows.length
      : featureMenu
        ? featureMenuEntries.length + 1
        : visibleCommands.length + (showTrashRow ? 1 : 0);
  const activeMenuId = searchMode
    ? searchResults[menuFocusIndex]?.id
    : trashMenu
      ? trashRows[menuFocusIndex]?.id
      : featureMenu
        ? menuFocusIndex === 0
          ? "new"
          : featureMenuEntries[menuFocusIndex - 1]?.id
        : menuFocusIndex === visibleCommands.length && showTrashRow
          ? "trash"
          : visibleCommands[menuFocusIndex];

  const todoOpenCount = frames.reduce(
    (total, frame) =>
      frame.feature === "todo list" ? total + openTodoCount(todoLists[frame.id] ?? []) : total,
    0,
  );

  const todayForOverdue = new Date();
  const overdueLists = frames
    .filter((frame) => frame.feature === "todo list")
    .map((frame) => ({ frame, count: overdueCount(todoLists[frame.id] ?? [], todayForOverdue) }))
    .filter((entry) => entry.count > 0);
  const todoOverdueCount = overdueLists.reduce((total, entry) => total + entry.count, 0);
  const [overdueNoticeOpen, setOverdueNoticeOpen] = useState(true);

  const framesCountByFeature = Object.fromEntries(
    visibleFeatures.map((feature) => [
      feature,
      frames.filter((frame) => frame.feature === feature).length,
    ]),
  ) as Record<Feature, number>;

  const openFeatureDirectly = useCallback(
    (feature: Feature) => {
      const existing = frames.find((frame) => frame.feature === feature);
      if (existing) {
        setActiveFrameId(existing.id);
      } else {
        const created = { ...featureMeta[feature].frame, feature, id: crypto.randomUUID() };
        setFrames((current) => [created, ...current]);
        setActiveFrameId(created.id);
      }
      setFocusedSide("main");
      setWithinSide(true);
    },
    [frames],
  );

  const openFeaturePanel = (feature: Feature, trigger?: HTMLElement) => {
    setFeaturePanel(feature);
    setEntryFocusIndex(0);
    setFeatureAnchor(trigger ?? rightItemRefs.current[`feature-${feature}`] ?? null);
  };

  const focusDockItem = useCallback(() => {
    const features = visibleFeatures;
    const id = rightFocusIndex === features.length ? "settings" : `feature-${features[rightFocusIndex]}`;
    rightItemRefs.current[id]?.focus();
  }, [rightFocusIndex]);

  const closeFeaturePanel = useCallback(() => {
    setFeaturePanel(null);
    focusDockItem();
  }, [focusDockItem]);

  const closeSettings = useCallback((restoreFocus: boolean) => {
    setSettingsOpen(false);
    if (restoreFocus) rightItemRefs.current.settings?.focus();
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }, []);

  const runCommand = (command: Command) => {
    if (command === "Search") {
      setSearchMode(true);
      setQuery("");
      setMenuOpen(true);
      setMenuFocusIndex(0);
      actionInputRef.current?.focus();
      return;
    }
    const newFrame = { ...featureMeta[command].frame, feature: command, id: crypto.randomUUID() };
    setFrames((current) => [newFrame, ...current]);
    showFrame(newFrame.id);
  };

  const chooseCommand = (command: Command) => {
    if (command === "Search") {
      runCommand(command);
      return;
    }
    if (singleFrameFeatures.includes(command)) {
      openFeatureDirectly(command);
      setMenuOpen(false);
      setQuery("");
      return;
    }
    setFeatureMenu(command);
    setQuery("");
    setMenuFocusIndex(0);
    actionInputRef.current?.focus();
  };

  const changeTodoList = (items: TodoItem[]) => {
    const frameId = activeFrame.id;
    const previous = todoLists[frameId] ?? [];
    const removed = removedItemsBetween(previous, items);
    if (removed.length) {
      const trashId = crypto.randomUUID();
      setTrash((current) =>
        addTrashEntry(current, {
          id: trashId,
          removedAt: new Date().toISOString(),
          kind: "items",
          frameId,
          title: activeFrame.title,
          removed,
        }),
      );
      setUndo({
        message: `Removed ${removed.length} item${removed.length === 1 ? "" : "s"}`,
        trashId,
        restore: () => {
          setTodoLists((current) => ({
            ...current,
            [frameId]: restoreRemovedItems(current[frameId] ?? [], removed),
          }));
          setTrash((current) => removeTrashEntry(current, trashId));
        },
      });
    }
    if (items.some((item) => item.remindAt) && !frames.some((frame) => frame.feature === "reminders")) {
      setFrames((current) => [...current, { ...featureMeta.reminders.frame, feature: "reminders", id: crypto.randomUUID() }]);
    }
    setTodoLists((current) => ({ ...current, [frameId]: items }));
  };

  const deleteFrame = useCallback((id: string) => {
    const position = frames.findIndex((frame) => frame.id === id);
    const removedFrame = frames[position];
    const removedList = todoLists[id];
    const removedHabits = habitLists[id];
    const removedReminders = removeFrameReminders(id);
    const trashId = crypto.randomUUID();
    setTrash((current) =>
      addTrashEntry(current, {
        id: trashId,
        removedAt: new Date().toISOString(),
        kind: "list",
        frame: removedFrame,
        position,
        items: removedList ?? [],
      }),
    );
    setUndo({
      message: `Deleted "${removedFrame.title}"`,
      trashId,
      restore: () => {
        setFrames((current) => {
          if (current.some((frame) => frame.id === id)) return current;
          const restored = [...current];
          restored.splice(Math.min(position, restored.length), 0, unstamped(removedFrame));
          return restored;
        });
        if (removedList) setTodoLists((current) => ({ ...current, [id]: removedList }));
        if (removedHabits) setHabitLists((current) => ({ ...current, [id]: removedHabits }));
        if (removedReminders) restoreFrameReminders(id, removedReminders);
        setTrash((current) => removeTrashEntry(current, trashId));
      },
    });
    const remaining = frames.filter((frame) => frame.id !== id);
    const next = remaining[0] ?? { ...initialFrame };
    setFrames(remaining.length ? remaining : [next]);
    setTodoLists((current) =>
      Object.fromEntries(Object.entries(current).filter(([frameId]) => frameId !== id)),
    );
    setHabitLists((current) =>
      Object.fromEntries(Object.entries(current).filter(([frameId]) => frameId !== id)),
    );
    setTodoViews((current) =>
      Object.fromEntries(Object.entries(current).filter(([frameId]) => frameId !== id)),
    );
    if (id === activeFrameId) {
      setActiveFrameId(next.id);
      setFocusedSide("main");
      setWithinSide(true);
    }
  }, [activeFrameId, frames, habitLists, todoLists]);

  const promoteStackFrame = (index: number) => {
    const selectedFrame = stackedFrames[index];
    if (!selectedFrame) return;
    const previousMain = activeFrame;
    setFrames((current) => promoteFrames(current, selectedFrame, previousMain));
    setActiveFrameId(selectedFrame.id);
    setStackFocusIndex(-1);
    setFocusedSide("main");
    setWithinSide(true);
  };

  const showFrame = (id: string) => {
    setActiveFrameId(id);
    setFocusedSide("main");
    setWithinSide(true);
    setMenuOpen(false);
    setSearchMode(false);
    setFeatureMenu(null);
    setQuery("");
  };

  const restoreTrash = (id: string) => {
    const entry = trash.find((candidate) => candidate.id === id);
    if (!entry) return;
    if (entry.kind === "list") {
      const frame = entry.frame;
      setFrames((current) => {
        if (current.some((existing) => existing.id === frame.id)) return current;
        const restored = [...current];
        restored.splice(Math.min(entry.position, restored.length), 0, unstamped(frame));
        return restored;
      });
      setTodoLists((current) => ({ ...current, [frame.id]: entry.items }));
    } else {
      const frameId = entry.frameId;
      setTodoLists((current) => ({
        ...current,
        [frameId]: restoreRemovedItems(current[frameId] ?? [], entry.removed),
      }));
    }
    setTrash((current) => removeTrashEntry(current, id));
    setUndo((current) => (current?.trashId === id ? null : current));
    setTrashMenu(false);
    setMenuFocusIndex(0);
  };

  const commandKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      if (trashMenu) {
        event.stopPropagation();
        setTrashMenu(false);
        setMenuFocusIndex(0);
        return;
      }
      if (featureMenu && !searchMode) {
        event.stopPropagation();
        setFeatureMenu(null);
        setQuery("");
        setMenuFocusIndex(0);
        return;
      }
      setMenuOpen(false);
      setSearchMode(false);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!menuRowCount) return;
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setMenuFocusIndex((current) => (current + delta + menuRowCount) % menuRowCount);
      return;
    }
    if (event.key !== "Enter") return;
    if (searchMode) {
      const result = searchResults[menuFocusIndex];
      if (result) showFrame(result.id);
      return;
    }
    if (trashMenu) {
      const row = trashRows[menuFocusIndex];
      if (row) restoreTrash(row.id);
      return;
    }
    if (featureMenu) {
      if (menuFocusIndex === 0) {
        runCommand(featureMenu);
      } else {
        const entry = featureMenuEntries[menuFocusIndex - 1];
        if (entry) showFrame(entry.id);
      }
      return;
    }
    if (showTrashRow && menuFocusIndex === visibleCommands.length) {
      setTrashMenu(true);
      setMenuFocusIndex(0);
      return;
    }
    if (visibleCommands[menuFocusIndex]) chooseCommand(visibleCommands[menuFocusIndex]);
  };

  useEffect(() => {
    setStored(FRAMES_KEY, JSON.stringify(frames));
  }, [frames]);
  useEffect(() => {
    setStored(NOTE_BODIES_KEY, JSON.stringify(noteBodies));
  }, [noteBodies]);
  useEffect(() => saveSettings(settings), [settings]);
  useEffect(() => {
    saveWorkspaceView(localStorage, workspaceView);
  }, [workspaceView]);
  useEffect(() => {
    saveTodoLists(localStorage, todoLists);
  }, [todoLists]);
  const habitListsRef = useRef(habitLists);
  useEffect(() => {
    habitListsRef.current = habitLists;
  }, [habitLists]);
  useEffect(() => {
    initReminders();
    registerHabitSource({
      get: () => habitListsRef.current,
      tick: (frameId, habitId, day) =>
        setHabitLists((current) => ({
          ...current,
          [frameId]: toggleDay(current[frameId] ?? [], habitId, day, new Date()),
        })),
    });
  }, []);
  const remindersFrameId = frames.find((frame) => frame.feature === "reminders")?.id;
  useEffect(() => {
    if (!remindersFrameId) return;
    syncTodoRemindersIn(
      remindersFrameId,
      frames.flatMap((frame) =>
        (todoLists[frame.id] ?? []).flatMap((item) =>
          !item.done && item.remindAt
            ? [{ todoId: item.id, text: item.text, priority: item.priority, at: item.remindAt }]
            : [],
        ),
      ),
    );
  }, [frames, todoLists, remindersFrameId]);
  useEffect(() => {
    saveHabits(localStorage, habitLists);
  }, [habitLists]);
  useEffect(() => {
    saveTodoViews(localStorage, todoViews);
  }, [todoViews]);
  useEffect(() => {
    saveTrash(localStorage, trash);
  }, [trash]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    setStored(THEME_KEY, theme);
  }, [theme]);
  useEffect(() => {
    if (focusedSide !== "left" || !withinSide || stackFocusIndex < 0) return;
    stackRefs.current[stackedFrames[stackFocusIndex]?.id]?.focus();
  }, [focusedSide, stackFocusIndex, stackedFrames, withinSide]);
  useEffect(() => {
    if (withinSide) return;
    if (focusedSide === "main") focusActiveFrame();
    else sideRefs.current[focusedSide]?.focus({ preventScroll: true });
  }, [focusActiveFrame, focusedSide, withinSide]);
  useEffect(() => {
    if (keepBarFocus.current) {
      keepBarFocus.current = false;
      return;
    }
    if (focusedSide === "main" && withinSide && !menuOpen) focusActiveFrame();
  }, [activeFrameId, focusActiveFrame, focusedSide, frames, menuOpen, withinSide]);
  useEffect(() => {
    if (!featurePanel) return;
    const firstEntry = featureEntries[0] ? featureEntryRefs.current[featureEntries[0].id] : null;
    if (firstEntry) firstEntry.focus();
    else featureAsideRef.current?.focus();
  }, [featureEntries, featurePanel]);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if ((event.target as Element).closest(".command-wrap, .menu")) return;
      keepBarFocus.current = true;
      setMenuOpen(false);
      setSearchMode(false);
      setFeatureMenu(null);
      setTrashMenu(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [menuOpen]);

  useEffect(() => {
    const track = (event: FocusEvent) => setBarActive(event.target === actionInputRef.current);
    document.addEventListener("focusin", track);
    return () => document.removeEventListener("focusin", track);
  }, []);

  useEffect(() => {
    if (!menuOpen && !featurePanel && !settingsOpen) return;
    const selector = menuOpen ? ".command-wrap, .menu" : ".feature-aside";
    let lastOverlayFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    let allowOutsideFocus = false;
    let resetTimer = 0;
    const allowIntentionalFocus = () => {
      allowOutsideFocus = true;
      window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(() => {
        allowOutsideFocus = false;
      }, 0);
    };
    const containFocus = (event: FocusEvent) => {
      const target = event.target as Element;
      if (target.closest(selector)) {
        lastOverlayFocus = target as HTMLElement;
        return;
      }
      if (allowOutsideFocus) {
        allowOutsideFocus = false;
        return;
      }
      event.stopImmediatePropagation();
      const fallback = menuOpen ? actionInputRef.current : featureAsideRef.current;
      (lastOverlayFocus?.isConnected ? lastOverlayFocus : fallback)?.focus();
    };
    document.addEventListener("mousedown", allowIntentionalFocus, true);
    document.addEventListener("keydown", allowIntentionalFocus, true);
    document.addEventListener("focusin", containFocus, true);
    return () => {
      window.clearTimeout(resetTimer);
      document.removeEventListener("mousedown", allowIntentionalFocus, true);
      document.removeEventListener("keydown", allowIntentionalFocus, true);
      document.removeEventListener("focusin", containFocus, true);
    };
  }, [featurePanel, menuOpen, settingsOpen]);

  useEffect(() => {
    let userInteracted = false;
    let allowWeatherFocus = false;
    let lastFocus: HTMLElement | null = null;
    const noteIntentionalInput = (event: MouseEvent | globalThis.KeyboardEvent) => {
      userInteracted = true;
      allowWeatherFocus = event.target instanceof Element && event.target.closest(".hud-weather") !== null;
    };
    const guardWeatherAutofocus = (event: FocusEvent) => {
      if (!(event.target instanceof HTMLElement)) return;
      if (!event.target.matches(".hud-weather-form input")) {
        lastFocus = event.target;
        return;
      }
      if (!userInteracted || allowWeatherFocus) {
        allowWeatherFocus = false;
        return;
      }
      event.stopImmediatePropagation();
      if (lastFocus?.isConnected) lastFocus.focus();
    };
    const clearBackgroundFocus = (event: FocusEvent) => {
      if (event.target === lastFocus && event.relatedTarget === null) lastFocus = null;
    };
    document.addEventListener("mousedown", noteIntentionalInput, true);
    document.addEventListener("keydown", noteIntentionalInput, true);
    document.addEventListener("focusin", guardWeatherAutofocus, true);
    document.addEventListener("focusout", clearBackgroundFocus, true);
    return () => {
      document.removeEventListener("mousedown", noteIntentionalInput, true);
      document.removeEventListener("keydown", noteIntentionalInput, true);
      document.removeEventListener("focusin", guardWeatherAutofocus, true);
      document.removeEventListener("focusout", clearBackgroundFocus, true);
    };
  }, []);

  useEffect(() => {
    if (menuOpen) actionInputRef.current?.focus();
  }, [barHost, menuOpen]);

  useLayoutEffect(() => {
    const rightItemId = (index: number) => {
      if (index === visibleFeatures.length) return "settings";
      return `feature-${visibleFeatures[index]}`;
    };
    const navigate = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        event.stopPropagation();
        if (document.activeElement !== actionInputRef.current) {
          returnTo.current = { side: focusedSide, within: withinSide };
        }
        setFocusedSide("main");
        setWithinSide(true);
        setMenuOpen(true);
        setSearchMode(false);
        setFeatureMenu(null);
        setTrashMenu(false);
        setMenuFocusIndex(0);
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "l") {
        event.preventDefault();
        toggleTheme();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === "z") {
        const target = event.target;
        const inEditor = target instanceof HTMLElement && target.closest("[contenteditable='true'], .codex-editor") !== null;
        if (!undo || target instanceof HTMLInputElement || inEditor) return;
        event.preventDefault();
        undo.restore();
        setUndo(null);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        if (event.target === actionInputRef.current) {
          setMenuOpen(false);
          setSearchMode(false);
          if (menuOpen) {
            keepBarFocus.current = true;
            return;
          }
          const { side, within } = returnTo.current;
          setFocusedSide(side);
          setWithinSide(within);
          if (!within) sideRefs.current[side]?.focus();
          else if (side === "main") focusActiveFrame();
          else if (side === "left") {
            (stackRefs.current[stackedFrames[stackFocusIndex]?.id] ?? sideRefs.current.left)?.focus();
          } else rightItemRefs.current[rightItemId(rightFocusIndex)]?.focus();
          return;
        }
        returnTo.current = { side: focusedSide, within: withinSide };
        setMenuOpen(false);
        quietBarFocus.current = true;
        actionInputRef.current?.focus();
        quietBarFocus.current = false;
        return;
      }
      if (featurePanel || settingsOpen) return;
      if (
        event.key === "Tab" &&
        withinSide &&
        !menuOpen &&
        !event.defaultPrevented &&
        event.target !== actionInputRef.current
      ) {
        const region = sideRefs.current[focusedSide];
        const focusable = Array.from(
          region?.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [contenteditable="true"], [tabindex]:not([tabindex="-1"])',
          ) ?? [],
        ).filter((element) => element.offsetParent !== null);
        event.preventDefault();
        if (!focusable.length) return;
        const target = event.target as Node;
        const index = focusable.findIndex((element) => element === target || element.contains(target));
        const step = event.shiftKey ? -1 : 1;
        focusable[index === -1 ? 0 : (index + step + focusable.length) % focusable.length].focus();
        return;
      }
      if (menuOpen || event.target instanceof HTMLInputElement) return;
      if (event.altKey && /^Digit[1-9]$/.test(event.code) && !event.metaKey && !event.ctrlKey) {
        const selectedFrame = stackedFrames[Number(event.code.slice(-1)) - 1];
        if (!selectedFrame) return;
        event.preventDefault();
        const previousMain = activeFrame;
        setFrames((current) => promoteFrames(current, selectedFrame, previousMain));
        setActiveFrameId(selectedFrame.id);
        setStackFocusIndex(-1);
        setFocusedSide("main");
        setWithinSide(true);
        return;
      }
      if (
        focusedSide === "left" &&
        withinSide &&
        (event.key === "Delete" || event.key === "Backspace") &&
        stackFocusIndex >= 0
      ) {
        const removed = stackedFrames[stackFocusIndex];
        if (!removed) return;
        event.preventDefault();
        const nextFrames = stackedFrames.filter((frame) => frame.id !== removed.id);
        deleteFrame(removed.id);
        if (nextFrames.length) {
          const nextIndex = Math.min(stackFocusIndex, nextFrames.length - 1);
          setStackFocusIndex(nextIndex);
          stackRefs.current[nextFrames[nextIndex]?.id]?.focus();
        } else {
          setStackFocusIndex(-1);
          setWithinSide(false);
          sideRefs.current.left?.focus();
        }
        return;
      }
      if (event.altKey && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
        event.preventDefault();
        const offset = event.key === "ArrowLeft" ? -1 : 1;
        const next = Math.max(0, Math.min(sideOrder.length - 1, sideOrder.indexOf(focusedSide) + offset));
        const nextSide = sideOrder[next];
        const enteringLeft = nextSide === "left" && stackedFrames.length > 0;
        if (nextSide === "right") setDockCollapsed(false);
        if (nextSide === "left" && stackCollapsed) {
          setStackCollapsed(false);
          focusStackAfterOpen.current = enteringLeft;
        }
        setFocusedSide(nextSide);
        setWithinSide(enteringLeft);
        setStackFocusIndex(enteringLeft ? 0 : -1);
        if (enteringLeft && !stackCollapsed) stackRefs.current[stackedFrames[0].id]?.focus();
        else sideRefs.current[nextSide]?.focus();
        return;
      }
      if (
        focusedSide === "left" &&
        withinSide &&
        (event.key === "ArrowUp" || event.key === "ArrowDown")
      ) {
        if (!stackedFrames.length) return;
        event.preventDefault();
        const next =
          event.key === "ArrowUp"
            ? Math.max(0, stackFocusIndex - 1)
            : Math.min(stackedFrames.length - 1, stackFocusIndex + 1);
        setStackFocusIndex(next);
        stackRefs.current[stackedFrames[next]?.id]?.focus();
        return;
      }
      if (
        focusedSide === "right" &&
        withinSide &&
        (event.key === "ArrowUp" || event.key === "ArrowDown")
      ) {
        event.preventDefault();
        const count = visibleFeatures.length + 1;
        const delta = event.key === "ArrowUp" ? -1 : 1;
        const next = Math.max(0, Math.min(count - 1, rightFocusIndex + delta));
        setRightFocusIndex(next);
        rightItemRefs.current[rightItemId(next)]?.focus();
        return;
      }
      if (event.key !== "Enter") return;
      if (!withinSide) {
        event.preventDefault();
        setWithinSide(true);
        if (focusedSide === "left" && stackedFrames.length) {
          setStackFocusIndex(0);
          stackRefs.current[stackedFrames[0].id]?.focus();
        }
        if (focusedSide === "main") {
          frameRefs.current[activeFrameId]?.focus();
        }
        if (focusedSide === "right") {
          setRightFocusIndex(0);
          rightItemRefs.current[rightItemId(0)]?.focus();
        }
        return;
      }
      if (focusedSide === "left" && stackFocusIndex >= 0 && stackedFrames[stackFocusIndex]) {
        event.preventDefault();
        const selectedFrame = stackedFrames[stackFocusIndex];
        const previousMain = activeFrame;
        setFrames((current) => promoteFrames(current, selectedFrame, previousMain));
        setActiveFrameId(selectedFrame.id);
        setStackFocusIndex(-1);
        setFocusedSide("main");
      }
      if (
        focusedSide === "right" &&
        rightFocusIndex < visibleFeatures.length
      ) {
        const feature = visibleFeatures[rightFocusIndex];
        if (singleFrameFeatures.includes(feature)) openFeatureDirectly(feature);
        else openFeaturePanel(feature);
      }
    };
    const captureCommandShortcut = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") navigate(event);
    };
    window.addEventListener("keydown", captureCommandShortcut, true);
    window.addEventListener("keydown", navigate);
    return () => {
      window.removeEventListener("keydown", captureCommandShortcut, true);
      window.removeEventListener("keydown", navigate);
    };
  }, [
    activeFrame,
    activeFrameId,
    deleteFrame,
    focusActiveFrame,
    featurePanel,
    focusedSide,
    menuOpen,
    openFeatureDirectly,
    rightFocusIndex,
    stackCollapsed,
    stackFocusIndex,
    stackedFrames,
    toggleTheme,
    settingsOpen,
    undo,
    withinSide,
  ]);

  const workspace: WorkspaceView = {
    frames,
    activeFrame,
    stackedFrames,
    featureEntries,
    featureMenuEntries,
    searchResults,
    visibleCommands,
    trashRows,
    pomodoro,
    settings,
    theme,
    workspaceView,
    frameData,
    noteBodies,
    todoLists,
    habitLists,
    todoViews,
    framesCountByFeature,
    todoOpenCount,
    todoOverdueCount,
    overdueLists,
    overdueNoticeOpen,
    focusedSide,
    withinSide,
    stackFocusIndex,
    rightFocusIndex,
    entryFocusIndex,
    menuFocusIndex,
    activeMenuId,
    settingsOpen,
    settingsAnchor,
    menuOpen,
    query,
    featureMenu,
    trashMenu,
    searchMode,
    showTrashRow,
    dockCollapsed,
    stackCollapsed,
    barHost,
    barActive,
    featurePanel,
    featureAnchor,
    undo,
    reduceMotion,
    actionInputRef,
    featureAsideRef,
    frameScope,
    registerItem,
    registerEntry,
    registerStack,
    registerSide: (side, node) => {
      sideRefs.current[side] = node;
    },
    registerFrame: (id, node) => {
      frameRefs.current[id] = node;
    },
    getEntry,
    setBarHost,
    onToggleStack: () => setStackCollapsed((current) => !current),
    onToggleDock: () => setDockCollapsed((current) => !current),
    onStackSelect: (index) => {
      setFocusedSide("left");
      setWithinSide(true);
      setStackFocusIndex(index);
    },
    onPromoteStackFrame: promoteStackFrame,
    onMainFocus: () => {
      setFocusedSide("main");
      setWithinSide(true);
    },
    onOpenFeatureDirectly: openFeatureDirectly,
    onOpenSettings: () => {
      if (settingsOpen) {
        closeSettings(true);
        return;
      }
      setSettingsAnchor(rightItemRefs.current.settings);
      setFeaturePanel(null);
      setSettingsOpen(true);
    },
    onWorkspaceViewChange: (view) => {
      if (view === workspaceView) {
        closeSettings(true);
        return;
      }
      focusSettingsAfterViewChange.current = true;
      setSettingsAnchor(null);
      setSettingsOpen(false);
      setWorkspaceView(view);
    },
    onSettingsChange: (patch) => setSettings((current) => ({ ...current, ...patch })),
    onSettingsClose: closeSettings,
    onToggleTheme: toggleTheme,
    onFeaturePress: (feature, trigger) => {
      if (singleFrameFeatures.includes(feature)) openFeatureDirectly(feature);
      else openFeaturePanel(feature, trigger);
    },
    onFeaturePanelClose: closeFeaturePanel,
    onFeaturePanelCreate: (feature) => {
      runCommand(feature);
      setFeaturePanel(null);
    },
    onFeaturePanelEntryClick: (frame) => {
      setActiveFrameId(frame.id);
      setFocusedSide("main");
      setWithinSide(true);
      closeFeaturePanel();
    },
    onRestoreTrash: restoreTrash,
    onOpenTrash: () => {
      setTrashMenu(true);
      setMenuFocusIndex(0);
      actionInputRef.current?.focus();
    },
    onCommandPaletteQueryChange: (value) => {
      setQuery(value);
      setMenuFocusIndex(0);
      setMenuOpen(true);
    },
    onCommandPaletteFocus: () => {
      if (quietBarFocus.current) return;
      setMenuFocusIndex(0);
      setMenuOpen(true);
    },
    onCommandKeyDown: commandKeyDown,
    onChooseCommand: chooseCommand,
    onRunCommand: runCommand,
    onShowFrame: showFrame,
    onSideSelect: (side) => {
      setFocusedSide(side);
      setWithinSide(false);
    },
    onUndo: () => {
      undo?.restore();
      setUndo(null);
    },
    onUndoDismiss: () => setUndo(null),
    onDismissOverdueNotice: () => setOverdueNoticeOpen(false),
    onHabitsChange: (habits) =>
      setHabitLists((current) => ({ ...current, [activeFrame.id]: habits })),
    onDeleteActiveFrame: () => deleteFrame(activeFrame.id),
    onTodoViewChange: (view) =>
      setTodoViews((current) => ({ ...current, [activeFrame.id]: view })),
    onTitleChange: (title) =>
      setFrames((current) =>
        current.map((frame) => (frame.id === activeFrame.id ? { ...frame, title } : frame)),
      ),
    onTodoChange: changeTodoList,
    onNoteChange: (value) =>
      setNoteBodies((current) => ({ ...current, [activeFrame.id]: value })),
    onRightFocus: setRightFocusIndex,
  };

  if (workspaceView === "operator") return <OperatorConsole workspace={workspace} />;

  return (
    <Suspense
      fallback={
        <main className="app" data-workspace-view={workspaceView} aria-busy="true">
          <p role="status">Loading workspace…</p>
        </main>
      }
    >
      {workspaceView === "calm" ? (
        <CalmWorkspace workspace={workspace} />
      ) : workspaceView === "immersive" ? (
        <ImmersiveFocus workspace={workspace} />
      ) : (
        <DailyOverview workspace={workspace} />
      )}
    </Suspense>
  );
}

export default WorkspaceApp;
