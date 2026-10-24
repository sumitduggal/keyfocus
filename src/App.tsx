import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useAnimate, useReducedMotion } from "motion/react";
import type { Command, Feature, Side, Theme, WorkspaceFrame } from "./types";
import {
  FRAMES_KEY,
  NOTE_BODIES_KEY,
  THEME_KEY,
  commandNames,
  featureMeta,
  initialFrame,
  singleFrameFeatures,
  visibleFeatures,
} from "./constants";
import { setStored } from "./storage";
import { Mainframe } from "./components/Mainframe";
import { Stack } from "./components/Stack";
import { Dock } from "./components/Dock";
import { FeaturePanel } from "./components/FeaturePanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { loadSettings, saveSettings } from "./settings";
import type { Settings } from "./settings";
import { CommandPalette } from "./components/CommandPalette";
import { Weather } from "./components/Weather";
import { loadHabits, saveHabits, toggleDay, type Habit } from "./habits";
import { loadFrames, loadNoteBodies, loadTheme } from "./saved-state";
import { initReminders, registerHabitSource, removeFrameReminders, restoreFrameReminders } from "./reminders-store";
import { HudReminders, ReminderBanner } from "./components/ReminderBanner";
import {
  loadTodoLists,
  loadTodoViews,
  openTodoCount,
  saveTodoLists,
  overdueCount,
  saveTodoViews,
  type TodoItem,
  type TodoViewState,
} from "./todo";
import {
  addTrashEntry,
  loadTrash,
  pruneTrash,
  removeTrashEntry,
  removedItemsBetween,
  restoreRemovedItems,
  saveTrash,
  type TrashEntry,
} from "./todo-trash";
import "./App.css";
import "./components.css";

const pad = (value: number) => String(value).padStart(2, "0");

// Puts a stacked frame first, the previous main frame second, and the rest after them.
const promoteFrames = (
  current: WorkspaceFrame[],
  selectedFrame: WorkspaceFrame,
  previousMain: WorkspaceFrame,
) => [
  selectedFrame,
  previousMain,
  ...current.filter((frame) => frame.id !== selectedFrame.id && frame.id !== previousMain.id),
];

// Mobile tab bar (below 760px). Each tab switches the same side focus that Alt+arrow uses.
const sideTabs: { side: Side; label: string }[] = [
  { side: "left", label: "Frames" },
  { side: "main", label: "Active" },
  { side: "right", label: "Features" },
];
const sideOrder = sideTabs.map((tab) => tab.side);

function HudClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tick = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  const stamp = now
    .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    .toUpperCase()
    .replaceAll(" ", "-");
  const clock = now.toLocaleTimeString("en-GB", { hour12: false });

  return (
    <div className="hud-status-time">
      {stamp} <span>//</span> {clock}
    </div>
  );
}

function App() {
  const [frames, setFrames] = useState<WorkspaceFrame[]>(() => loadFrames(localStorage));
  const [activeFrameId, setActiveFrameId] = useState("main");
  const [stackFocusIndex, setStackFocusIndex] = useState(-1);
  const [focusedSide, setFocusedSide] = useState<Side>("main");
  const [withinSide, setWithinSide] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => loadTheme(localStorage));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsAnchorY, setSettingsAnchorY] = useState<number | null>(null);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menuFocusIndex, setMenuFocusIndex] = useState(0);
  // The last undoable change; the toast clears itself after five seconds.
  const [undo, setUndo] = useState<{ message: string; restore: () => void; trashId?: string } | null>(null);
  // Feature picked in ⌘K: the palette lists its existing frames and a New row.
  const [featureMenu, setFeatureMenu] = useState<Feature | null>(null);
  // Recently deleted entries, shown from the top level of ⌘K.
  const [trashMenu, setTrashMenu] = useState(false);
  const [searchMode, setSearchMode] = useState(false);
  const [rightFocusIndex, setRightFocusIndex] = useState(0);
  const [featurePanel, setFeaturePanel] = useState<Feature | null>(null);
  const [featureAnchorY, setFeatureAnchorY] = useState<number | null>(null);
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
  // Recently deleted items and lists, kept for seven days across reloads.
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
  const profileRef = useRef<HTMLButtonElement | null>(null);
  const rightItemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const actionInputRef = useRef<HTMLInputElement | null>(null);
  // Where Escape came from, so Escape in the command bar can go back; and a flag so that
  // focusing the bar from Escape does not open its menu.
  const returnTo = useRef<{ side: Side; within: boolean }>({ side: "main", within: false });
  const quietBarFocus = useRef(false);
  const keepBarFocus = useRef(false);
  // While the command bar has focus no region should look active.
  const [barActive, setBarActive] = useState(false);
  const featureAsideRef = useRef<HTMLElement | null>(null);
  const featureEntryRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  // Ref callbacks register buttons through these, so no render reads a ref's current value.
  const registerItem = useCallback((id: string, node: HTMLButtonElement | null) => {
    rightItemRefs.current[id] = node;
  }, []);
  const registerEntry = useCallback((id: string, node: HTMLButtonElement | null) => {
    featureEntryRefs.current[id] = node;
  }, []);
  const registerStack = useCallback((id: string, node: HTMLElement | null) => {
    stackRefs.current[id] = node;
  }, []);
  const getEntry = useCallback((id: string) => featureEntryRefs.current[id] ?? null, []);
  const reduceMotion = useReducedMotion() ?? false;
  // The main frame slides in when another frame takes its place. It is animated in place rather than
  // re-created, so a running Pomodoro keeps its state.
  const [frameScope, animateFrame] = useAnimate<HTMLDivElement>();
  const lastFrameId = useRef(activeFrameId);
  useEffect(() => {
    if (lastFrameId.current === activeFrameId) return;
    lastFrameId.current = activeFrameId;
    if (!reduceMotion && frameScope.current) {
      void animateFrame(frameScope.current, { opacity: [0, 1], x: [18, 0] }, { duration: 0.2, ease: "easeOut" });
    }
  }, [activeFrameId, animateFrame, frameScope, reduceMotion]);

  const activeFrame = frames.find((frame) => frame.id === activeFrameId) ?? frames[0];

  // Focus lands on a frame's first item (e.g. a todo row) rather than its container.
  const focusActiveFrame = useCallback(() => {
    const frame = frameRefs.current[activeFrame.id];
    // Keep focus where the person is, e.g. while typing the frame's name.
    if (frame?.contains(document.activeElement)) return;
    (frame?.querySelector<HTMLElement>("[data-autofocus]") ?? frame)?.focus();
  }, [activeFrame.id]);
  const stackedFrames = frames.filter((frame) => frame.id !== activeFrame.id);
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
  // Row count and ids for the list the palette is currently showing.
  // Trash entries that can still be restored: lists always, item changes only while their list exists.
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

  // Lists with overdue items, for the dock badge and the banner.
  const todayForOverdue = new Date();
  const overdueLists = frames
    .filter((frame) => frame.feature === "todo list")
    .map((frame) => ({ frame, count: overdueCount(todoLists[frame.id] ?? [], todayForOverdue) }))
    .filter((entry) => entry.count > 0);
  const todoOverdueCount = overdueLists.reduce((total, entry) => total + entry.count, 0);
  const [overdueBannerOpen, setOverdueBannerOpen] = useState(true);

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

  const openFeaturePanel = (feature: Feature) => {
    setFeaturePanel(feature);
    setEntryFocusIndex(0);
    const featureButton = rightItemRefs.current[`feature-${feature}`];
    if (featureButton) {
      setFeatureAnchorY(
        featureButton.getBoundingClientRect().top +
          featureButton.getBoundingClientRect().height / 2,
      );
    }
  };

  const focusDockItem = () => {
    const features = visibleFeatures;
    const id =
      rightFocusIndex === 0
        ? "profile"
        : rightFocusIndex === features.length + 1
          ? "settings"
          : rightFocusIndex === features.length + 2
            ? "logout"
            : `feature-${features[rightFocusIndex - 1]}`;
    rightItemRefs.current[id]?.focus();
  };

  const closeFeaturePanel = () => {
    setFeaturePanel(null);
    focusDockItem();
  };

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

  // Picking a feature opens its sub-list; creating a frame is a separate row inside it.
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
    // The clicked row unmounts, so keep keyboard focus in the palette input.
    actionInputRef.current?.focus();
  };

  // Moves a stacked frame into the main side and pushes the current main frame onto the stack.
  // Saves a todo list. A change that removes items can be undone for a few seconds.
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
    setTodoLists((current) => ({ ...current, [frameId]: items }));
  };

  // Removes a frame and its todo list. Falls back to the first remaining frame, or a fresh Pomodoro.
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
          restored.splice(Math.min(position, restored.length), 0, removedFrame);
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

  // Puts a removed item back, or a whole list, and drops it from Recently deleted.
  const restoreTrash = (id: string) => {
    const entry = trash.find((candidate) => candidate.id === id);
    if (!entry) return;
    if (entry.kind === "list") {
      const frame = entry.frame;
      setFrames((current) => {
        if (current.some((existing) => existing.id === frame.id)) return current;
        const restored = [...current];
        restored.splice(Math.min(entry.position, restored.length), 0, frame);
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
    // A pending Undo for the same entry is now redundant.
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
        // Back to the command list only; the global Escape would also close the palette.
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
    if (!undo) return;
    const timer = window.setTimeout(() => setUndo(null), 5000);
    return () => window.clearTimeout(timer);
  }, [undo]);
  useEffect(() => {
    setStored(FRAMES_KEY, JSON.stringify(frames));
  }, [frames]);
  useEffect(() => {
    setStored(NOTE_BODIES_KEY, JSON.stringify(noteBodies));
  }, [noteBodies]);
  useEffect(() => saveSettings(settings), [settings]);
  useEffect(() => {
    saveTodoLists(localStorage, todoLists);
  }, [todoLists]);
  // The reminder scheduler reads habits for nudges and ticks one when its nudge is answered.
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
    else sideRefs.current[focusedSide]?.focus();
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
    const track = (event: FocusEvent) => setBarActive(event.target === actionInputRef.current);
    document.addEventListener("focusin", track);
    return () => document.removeEventListener("focusin", track);
  }, []);

  useEffect(() => {
    const rightItemId = (index: number) => {
      const count = visibleFeatures.length + 3;
      if (index === 0) return "profile";
      if (index === count - 1) return "logout";
      if (index === count - 2) return "settings";
      return `feature-${visibleFeatures[index - 1]}`;
    };
    const navigate = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
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
        actionInputRef.current?.focus();
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
        // Popups stop Escape themselves, so reaching here means nothing was left to close.
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
      // Tab stays inside the region being worked in; Alt+arrows and Cmd+K leave it.
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
      // Option+1-9 bring that stacked frame into the main side. Reads the physical key, because
      // Option changes the typed character on macOS.
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
        setFocusedSide(nextSide);
        setWithinSide(enteringLeft);
        setStackFocusIndex(enteringLeft ? 0 : -1);
        if (enteringLeft) stackRefs.current[stackedFrames[0].id]?.focus();
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
        const count = visibleFeatures.length + 3;
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
          profileRef.current?.focus();
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
        rightFocusIndex >= 1 &&
        rightFocusIndex <= visibleFeatures.length
      ) {
        const feature = visibleFeatures[rightFocusIndex - 1];
        if (singleFrameFeatures.includes(feature)) openFeatureDirectly(feature);
        else openFeaturePanel(feature);
      }
    };
    window.addEventListener("keydown", navigate);
    return () => window.removeEventListener("keydown", navigate);
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
    stackFocusIndex,
    stackedFrames,
    toggleTheme,
    settingsOpen,
    undo,
    withinSide,
  ]);

  return (
    <main className="app">
      <div className="stage">
        <div className="hud-backdrop" aria-hidden="true" />
        <span className="hud-corner tl" aria-hidden="true" />
        <span className="hud-corner tr" aria-hidden="true" />
        <span className="hud-corner bl" aria-hidden="true" />
        <span className="hud-corner br" aria-hidden="true" />

        <header className="hud-top">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              <i />
            </span>
            <span className="brand-copy">
              <span className="brand-title">Keyfocus</span>
              <span className="brand-sub">Focus space // canvas 01</span>
            </span>
          </div>

          <div className="hud-readout" aria-hidden="true">
            <span>
              <i>Mode</i>Deep focus
            </span>
            <span>
              <i>Frames</i>
              {pad(frames.length)}
            </span>
            <span>
              <i>Active</i>
              {activeFrame.feature}
            </span>
          </div>

          <div className="hud-status">
            <Weather />
            <HudReminders />
            <HudClock />
          </div>
        </header>

        <div className="canvas">
          <aside
            ref={(node) => {
              sideRefs.current.left = node;
            }}
            className={`side-region left-side ${focusedSide === "left" && !barActive ? "side-focused" : ""} ${
              focusedSide === "left" && withinSide && !barActive ? "within-focused" : ""
            }`}
            aria-label="Latest frames"
            tabIndex={0}
          >
            <Stack
              stackedFrames={stackedFrames}
              stackFocusIndex={stackFocusIndex}
              registerStack={registerStack}
              reduceMotion={reduceMotion}
              onSelect={(index) => {
                setFocusedSide("left");
                setWithinSide(true);
                setStackFocusIndex(index);
              }}
              onPromote={promoteStackFrame}
            />
            <div className="side-readout">
              <div>
                <span>Total frames</span>
                <b>{pad(frames.length)}</b>
              </div>
              <div>
                <span>Active surface</span>
                <b>{activeFrame.feature}</b>
              </div>
            </div>
          </aside>

          <section
            ref={(node) => {
              sideRefs.current.main = node;
            }}
            onFocusCapture={() => {
              setFocusedSide("main");
              setWithinSide(true);
            }}
            className={`side-region main-side ${focusedSide === "main" && !barActive ? "side-focused" : ""} ${
              focusedSide === "main" && withinSide && !barActive ? "within-focused" : ""
            }`}
            aria-label="Main frame"
            tabIndex={0}
          >
            <div className="scope" aria-hidden="true">
              <span className="terrain-contours" />
              <span className="terrain-glow terrain-glow-a" />
              <span className="terrain-glow terrain-glow-b" />
            </div>

            <div
              ref={frameScope}
              className={
                activeFrame.feature === "notes"
                  ? "main-frame-position note-position"
                  : "main-frame-position"
              }
            >
              <Mainframe
                frame={activeFrame}
                active
                noteBody={noteBodies[activeFrame.id]}
                todoItems={todoLists[activeFrame.id]}
                habitItems={habitLists[activeFrame.id]}
                onHabitsChange={(habits) =>
                  setHabitLists((current) => ({ ...current, [activeFrame.id]: habits }))
                }
                onDelete={() => deleteFrame(activeFrame.id)}
                todoView={todoViews[activeFrame.id] ?? { filter: "all", sort: "manual" }}
                onTodoViewChange={(view) =>
                  setTodoViews((current) => ({ ...current, [activeFrame.id]: view }))
                }
                onTitleChange={(title) =>
                  setFrames((current) =>
                    current.map((frame) => (frame.id === activeFrame.id ? { ...frame, title } : frame)),
                  )
                }
                onTodoChange={changeTodoList}
                onNoteChange={(value) =>
                  setNoteBodies((current) => ({ ...current, [activeFrame.id]: value }))
                }
                frameRef={(node) => {
                  frameRefs.current[activeFrame.id] = node;
                }}
              />
            </div>
          </section>

          <aside
            ref={(node) => {
              sideRefs.current.right = node;
            }}
            className={`side-region right-side ${focusedSide === "right" && !barActive ? "side-focused" : ""} ${
              focusedSide === "right" && withinSide && !barActive ? "within-focused" : ""
            }`}
            aria-label="Settings and utilities"
            tabIndex={0}
          >
            <Dock
              registerItem={registerItem}
              profileRef={profileRef}
              framesCountByFeature={framesCountByFeature}
              todoOpenCount={todoOpenCount}
              todoOverdueCount={todoOverdueCount}
              activeFeature={activeFrame.feature}
              onOpenSettings={() => {
                if (settingsOpen) {
                  setSettingsOpen(false);
                  return;
                }
                const rect = rightItemRefs.current.settings?.getBoundingClientRect();
                setSettingsAnchorY(rect ? rect.top + rect.height / 2 : null);
                setFeaturePanel(null);
                setSettingsOpen(true);
              }}
              setRightFocusIndex={setRightFocusIndex}
              onFeaturePress={(feature) => {
                if (singleFrameFeatures.includes(feature)) openFeatureDirectly(feature);
                else openFeaturePanel(feature);
              }}
            />
          </aside>

          {settingsOpen && (
            <SettingsPanel
              theme={theme}
              settings={settings}
              anchorY={settingsAnchorY}
              onToggleTheme={toggleTheme}
              onChange={(patch) => setSettings((current) => ({ ...current, ...patch }))}
              onClose={(restoreFocus) => {
                setSettingsOpen(false);
                if (restoreFocus) rightItemRefs.current.settings?.focus();
              }}
            />
          )}

          {featurePanel && (
            <FeaturePanel
              featurePanel={featurePanel}
              featureEntries={featureEntries}
              featureAnchorY={featureAnchorY}
              entryFocusIndex={entryFocusIndex}
              featureAsideRef={featureAsideRef}
              registerEntry={registerEntry}
              getEntry={getEntry}
              onClose={closeFeaturePanel}
              onCreate={() => {
                runCommand(featurePanel);
                setFeaturePanel(null);
              }}
              onEntryClick={(frame) => {
                setActiveFrameId(frame.id);
                setFocusedSide("main");
                setWithinSide(true);
                closeFeaturePanel();
              }}
            />
          )}

          <CommandPalette
            menuOpen={menuOpen}
            searchMode={searchMode}
            query={query}
            visibleCommands={visibleCommands}
            searchResults={searchResults.map((frame) => ({
              id: frame.id,
              feature: frame.feature,
              title: frame.title,
            }))}
            featureMenu={featureMenu}
            trashMenu={trashMenu}
            trashRows={trashRows}
            showTrashRow={showTrashRow}
            trashCount={trashRows.length}
            onRestoreTrash={restoreTrash}
            onOpenTrash={() => {
              setTrashMenu(true);
              setMenuFocusIndex(0);
              // The clicked row unmounts, so keep keyboard focus in the palette input.
              actionInputRef.current?.focus();
            }}
            featureEntries={featureMenuEntries.map((frame) => ({
              id: frame.id,
              feature: frame.feature,
              title: frame.title,
            }))}
            menuFocusIndex={menuFocusIndex}
            activeMenuId={activeMenuId}
            actionInputRef={actionInputRef}
            reduceMotion={reduceMotion}
            onQueryChange={(value) => {
              setQuery(value);
              setMenuFocusIndex(0);
              setMenuOpen(true);
            }}
            onFocus={() => {
              if (quietBarFocus.current) return;
              setMenuFocusIndex(0);
              setMenuOpen(true);
            }}
            onKeyDown={commandKeyDown}
            onRunCommand={chooseCommand}
            onCreateFeature={runCommand}
            onSelectResult={showFrame}
          />
        </div>

        <ReminderBanner />

        <nav className="side-tabs" aria-label="Sections">
          {sideTabs.map(({ side, label }) => (
            <button
              key={side}
              type="button"
              aria-current={focusedSide === side}
              onClick={() => {
                setFocusedSide(side);
                setWithinSide(false);
              }}
            >
              {label}
            </button>
          ))}
        </nav>

        {undo && (
          <div className="undo-toast" role="status">
            <span>{undo.message}</span>
            <button
              type="button"
              onClick={() => {
                undo.restore();
                setUndo(null);
              }}
            >
              Undo
            </button>
          </div>
        )}

        {overdueBannerOpen && overdueLists.length > 0 && (
          <div className="overdue-banner" role="status">
            <span>Overdue:</span>
            {overdueLists.map(({ frame, count }) => (
              <button key={frame.id} type="button" onClick={() => showFrame(frame.id)}>
                {frame.title} · {count}
              </button>
            ))}
            <button type="button" className="overdue-dismiss" onClick={() => setOverdueBannerOpen(false)}>
              Dismiss
            </button>
          </div>
        )}

        <footer className="hud-bottom">
          <div className="key-hints">
            <span>
              <kbd>⌘K</kbd> Command
            </span>
            <span>
              <kbd>Alt</kbd>
              <kbd>←</kbd>
              <kbd>→</kbd> Side
            </span>
            <span>
              <kbd>↑</kbd>
              <kbd>↓</kbd> Select
            </span>
            <span>
              <kbd>↵</kbd> Promote
            </span>
            <span>
              <kbd>Esc</kbd> Reset
            </span>
          </div>
          <div className="hud-footer-readout">
            <span>{pad(stackedFrames.length)} stacked</span>
            <span className="sep">//</span>
            <span>{activeFrame.feature} live</span>
            <span className="sep">//</span>
            <span>local only</span>
          </div>
        </footer>
      </div>
    </main>
  );
}

export default App;
