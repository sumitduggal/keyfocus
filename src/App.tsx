import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useReducedMotion } from "motion/react";
import type { Command, Feature, Side, Theme, WorkspaceFrame } from "./types";
import { featureMeta, commandNames, initialFrame, visibleFeatures } from "./constants";
import { Mainframe } from "./components/Mainframe";
import { Stack } from "./components/Stack";
import { Dock } from "./components/Dock";
import { FeaturePanel } from "./components/FeaturePanel";
import { CommandPalette } from "./components/CommandPalette";
import { loadTodoLists, openTodoCount, restoreTodoItems, saveTodoLists, type TodoItem } from "./todo";
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
  const [frames, setFrames] = useState<WorkspaceFrame[]>(() => {
    const saved = localStorage.getItem("focus-space-frames");
    if (!saved) return [initialFrame];
    return (JSON.parse(saved) as Partial<WorkspaceFrame>[]).map((frame) => ({
      ...initialFrame,
      ...frame,
      feature: frame.feature ?? "notes",
    }));
  });
  const [activeFrameId, setActiveFrameId] = useState("main");
  const [stackFocusIndex, setStackFocusIndex] = useState(-1);
  const [focusedSide, setFocusedSide] = useState<Side>("main");
  const [withinSide, setWithinSide] = useState(false);
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem("focus-space-theme") as Theme | null) ?? "dark",
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menuFocusIndex, setMenuFocusIndex] = useState(0);
  // The last undoable change; the toast clears itself after five seconds.
  const [undo, setUndo] = useState<{ message: string; restore: () => void } | null>(null);
  // Feature picked in ⌘K: the palette lists its existing frames and a New row.
  const [featureMenu, setFeatureMenu] = useState<Feature | null>(null);
  const [searchMode, setSearchMode] = useState(false);
  const [rightFocusIndex, setRightFocusIndex] = useState(0);
  const [featurePanel, setFeaturePanel] = useState<Feature | null>(null);
  const [featureAnchorY, setFeatureAnchorY] = useState<number | null>(null);
  const [entryFocusIndex, setEntryFocusIndex] = useState(0);
  const [noteBodies, setNoteBodies] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem("focus-space-note-bodies");
    return saved
      ? (JSON.parse(saved) as Record<string, string>)
      : { main: "# Notes\n\nStart writing in Markdown…\n\n- [ ] Capture the next idea" };
  });

  const [todoLists, setTodoLists] = useState<Record<string, TodoItem[]>>(() =>
    loadTodoLists(localStorage),
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
  const featureAsideRef = useRef<HTMLElement | null>(null);
  const featureEntryRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const reduceMotion = useReducedMotion() ?? false;

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
  const menuRowCount = searchMode
    ? searchResults.length
    : featureMenu
      ? featureMenuEntries.length + 1
      : visibleCommands.length;
  const activeMenuId = searchMode
    ? searchResults[menuFocusIndex]?.id
    : featureMenu
      ? menuFocusIndex === 0
        ? "new"
        : featureMenuEntries[menuFocusIndex - 1]?.id
      : visibleCommands[menuFocusIndex];

  const todoOpenCount = frames.reduce(
    (total, frame) =>
      frame.feature === "todo list" ? total + openTodoCount(todoLists[frame.id] ?? []) : total,
    0,
  );

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
    if (items.length < previous.length) {
      const removed = previous.length - items.length;
      setUndo({
        message: `Removed ${removed} item${removed === 1 ? "" : "s"}`,
        restore: () =>
          setTodoLists((current) => ({
            ...current,
            [frameId]: restoreTodoItems(current[frameId] ?? [], previous),
          })),
      });
    }
    setTodoLists((current) => ({ ...current, [frameId]: items }));
  };

  // Removes a frame and its todo list. Falls back to the first remaining frame, or a fresh Pomodoro.
  const deleteFrame = (id: string) => {
    const position = frames.findIndex((frame) => frame.id === id);
    const removedFrame = frames[position];
    const removedList = todoLists[id];
    setUndo({
      message: `Deleted "${removedFrame.title}"`,
      restore: () => {
        setFrames((current) => {
          const restored = [...current];
          restored.splice(Math.min(position, restored.length), 0, removedFrame);
          return restored;
        });
        if (removedList) setTodoLists((current) => ({ ...current, [id]: removedList }));
      },
    });
    const remaining = frames.filter((frame) => frame.id !== id);
    const next = remaining[0] ?? { ...initialFrame };
    setFrames(remaining.length ? remaining : [next]);
    setTodoLists((current) =>
      Object.fromEntries(Object.entries(current).filter(([frameId]) => frameId !== id)),
    );
    if (id === activeFrameId) {
      setActiveFrameId(next.id);
      setFocusedSide("main");
      setWithinSide(true);
    }
  };

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

  const commandKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
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
    if (featureMenu) {
      if (menuFocusIndex === 0) {
        runCommand(featureMenu);
      } else {
        const entry = featureMenuEntries[menuFocusIndex - 1];
        if (entry) showFrame(entry.id);
      }
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
    localStorage.setItem("focus-space-frames", JSON.stringify(frames));
  }, [frames]);
  useEffect(() => {
    localStorage.setItem("focus-space-note-bodies", JSON.stringify(noteBodies));
  }, [noteBodies]);
  useEffect(() => {
    saveTodoLists(localStorage, todoLists);
  }, [todoLists]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("focus-space-theme", theme);
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
    if (focusedSide === "main" && withinSide && !menuOpen) focusActiveFrame();
  }, [activeFrameId, focusActiveFrame, focusedSide, frames, menuOpen, withinSide]);
  useEffect(() => {
    if (!featurePanel) return;
    setEntryFocusIndex(0);
    const firstEntry = featureEntries[0] ? featureEntryRefs.current[featureEntries[0].id] : null;
    if (firstEntry) firstEntry.focus();
    else featureAsideRef.current?.focus();
  }, [featureEntries, featurePanel]);

  useEffect(() => {
    const navigate = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setFocusedSide("main");
        setWithinSide(true);
        setMenuOpen(true);
        setSearchMode(false);
        setFeatureMenu(null);
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
        event.preventDefault();
        setMenuOpen(false);
        setStackFocusIndex(-1);
        setFocusedSide("main");
        setWithinSide(false);
        sideRefs.current.main?.focus();
        return;
      }
      if (featurePanel) return;
      if (menuOpen || event.target instanceof HTMLInputElement) return;
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
        setFrames((current) => current.filter((frame) => frame.id !== removed.id));
        setTodoLists((current) =>
          Object.fromEntries(Object.entries(current).filter(([id]) => id !== removed.id)),
        );
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
        const id =
          next === 0
            ? "profile"
            : next === count - 1
              ? "logout"
              : next === count - 2
                ? "settings"
                : `feature-${visibleFeatures[next - 1]}`;
        rightItemRefs.current[id]?.focus();
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
        if (feature === "pomodoro") openFeatureDirectly(feature);
        else openFeaturePanel(feature);
      }
    };
    window.addEventListener("keydown", navigate);
    return () => window.removeEventListener("keydown", navigate);
  }, [
    activeFrame,
    activeFrameId,
    featurePanel,
    focusedSide,
    menuOpen,
    openFeatureDirectly,
    rightFocusIndex,
    stackFocusIndex,
    stackedFrames,
    toggleTheme,
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
            <div className="hud-status-line">
              <span>System status</span>
              <b>Normal</b>
            </div>
            <HudClock />
          </div>
        </header>

        <div className="canvas">
          <aside
            ref={(node) => {
              sideRefs.current.left = node;
            }}
            className={`side-region left-side ${focusedSide === "left" ? "side-focused" : ""} ${
              focusedSide === "left" && withinSide ? "within-focused" : ""
            }`}
            aria-label="Latest frames"
            tabIndex={0}
          >
            <div className="side-head">
              <p className="side-label">Frame stack</p>
              <span className="side-count">{pad(stackedFrames.length)}</span>
            </div>
            <p className="side-sub">Recent context // newest first</p>
            <Stack
              stackedFrames={stackedFrames}
              stackFocusIndex={stackFocusIndex}
              stackRefs={stackRefs.current}
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
              <div>
                <span>Channel</span>
                <b>Local</b>
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
            className={`side-region main-side ${focusedSide === "main" ? "side-focused" : ""} ${
              focusedSide === "main" && withinSide ? "within-focused" : ""
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
                onDelete={() => deleteFrame(activeFrame.id)}
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
            className={`side-region right-side ${focusedSide === "right" ? "side-focused" : ""} ${
              focusedSide === "right" && withinSide ? "within-focused" : ""
            }`}
            aria-label="Settings and utilities"
            tabIndex={0}
          >
            <Dock
              rightItemRefs={rightItemRefs.current}
              profileRef={profileRef}
              framesCountByFeature={framesCountByFeature}
              todoOpenCount={todoOpenCount}
              activeFeature={activeFrame.feature}
              theme={theme}
              onToggleTheme={toggleTheme}
              setRightFocusIndex={setRightFocusIndex}
              onFeaturePress={(feature) => {
                if (feature === "pomodoro") openFeatureDirectly(feature);
                else openFeaturePanel(feature);
              }}
            />
          </aside>

          {featurePanel && (
            <FeaturePanel
              featurePanel={featurePanel}
              featureEntries={featureEntries}
              featureAnchorY={featureAnchorY}
              entryFocusIndex={entryFocusIndex}
              featureAsideRef={featureAsideRef}
              featureEntryRefs={featureEntryRefs.current}
              onClose={closeFeaturePanel}
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
              setMenuFocusIndex(0);
              setMenuOpen(true);
            }}
            onKeyDown={commandKeyDown}
            onRunCommand={chooseCommand}
            onCreateFeature={runCommand}
            onSelectResult={showFrame}
          />
        </div>

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
