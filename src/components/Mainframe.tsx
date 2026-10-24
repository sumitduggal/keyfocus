import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, RefCallback } from "react";
import type EditorJS from "@editorjs/editorjs";
import type { OutputData } from "@editorjs/editorjs";
import type { WorkspaceFrame } from "../types";
import type { TodoItem, TodoViewState } from "../todo";
import { TodoFrame } from "./TodoFrame";
import { POMODORO_DURATION_KEY } from "../constants";
import { setStored } from "../storage";
import { loadSettings, playAlert } from "../settings";

// Moves focus to the next focusable element after `current` in page order.
function focusNextElement(current: HTMLElement) {
  const focusables = Array.from(
    document.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  );
  focusables[focusables.indexOf(current) + 1]?.focus();
}

// Notes is hidden for now, so its editor and tools load only when a notes frame opens.
function loadEditor() {
  return Promise.all([
    import("@editorjs/editorjs"),
    import("@editorjs/header"),
    import("@editorjs/list"),
    import("@editorjs/quote"),
    import("@editorjs/checklist"),
    import("@editorjs/image"),
    import("@editorjs/inline-code"),
    import("@editorjs/code"),
    import("@editorjs/link"),
    import("@editorjs/marker"),
  ]).then(([editor, header, list, quote, checklist, image, inlineCode, code, link, marker]) => ({
    EditorJS: editor.default,
    tools: {
      header: header.default,
      list: list.default,
      quote: quote.default,
      checklist: checklist.default,
      image: {
        class: image.default,
        config: {
          uploader: {
            uploadByFile: async (file: File) =>
              ({
                success: 1,
                file: {
                  url: await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(String(reader.result));
                    reader.readAsDataURL(file);
                  }),
                },
              }) as const,
          },
        },
      },
      inlineCode: inlineCode.default,
      code: code.default,
      linkTool: link.default,
      marker: marker.default,
    },
  }));
}

export function Mainframe({
  frame,
  active,
  frameRef,
  noteBody,
  onNoteChange,
  todoItems,
  onTodoChange,
  onTitleChange,
  onDelete,
  todoView,
  onTodoViewChange,
}: {
  frame: WorkspaceFrame;
  active: boolean;
  frameRef: RefCallback<HTMLElement>;
  noteBody?: string;
  onNoteChange?: (value: string) => void;
  todoItems?: TodoItem[];
  onTodoChange?: (items: TodoItem[]) => void;
  onTitleChange?: (title: string) => void;
  onDelete?: () => void;
  todoView?: TodoViewState;
  onTodoViewChange?: (view: TodoViewState) => void;
}) {
  const note = noteBody ?? "";
  const editorHost = useRef<HTMLDivElement | null>(null);
  const editorInstance = useRef<EditorJS | null>(null);
  // Freeze the body for the life of one frame; switching frames loads that frame's saved body.
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  const initialNote = useMemo(() => note, [frame.id]);
  const noteChangeRef = useRef(onNoteChange);
  noteChangeRef.current = onNoteChange;

  useEffect(() => {
    if (frame.feature !== "notes" || !editorHost.current) return;
    let parsed: OutputData | undefined;
    try {
      parsed = JSON.parse(initialNote) as OutputData;
    } catch {
      parsed = undefined;
    }
    const host = editorHost.current;
    host.replaceChildren();
    const container = document.createElement("div");
    container.className = "note-editor-mount";
    host.appendChild(container);
    let editor: EditorJS | undefined;
    let cancelled = false;
    loadEditor().then(({ EditorJS, tools }) => {
      if (cancelled) return;
      try {
        editor = new EditorJS({
          holder: container,
          autofocus: true,
          data: parsed?.blocks
            ? parsed
            : {
                blocks: initialNote
                  .split("\n")
                  .filter(Boolean)
                  .map((text) => ({ type: "paragraph", data: { text } })),
              },
          tools,
          onChange: async () => {
            const instance = editorInstance.current;
            if (!instance) return;
            const output = await instance.save();
            noteChangeRef.current?.(JSON.stringify(output));
          },
        });
        editorInstance.current = editor;
      } catch (error) {
        console.error("KEYFOCUS editor init failed", error);
      }
    });
    return () => {
      cancelled = true;
      const finished = editor;
      finished?.isReady.then(() => finished.destroy()).catch(() => undefined);
      editorInstance.current = null;
      container.remove();
    };
  }, [frame.id, frame.feature, initialNote]);

  const [pomodoroDuration, setPomodoroDuration] = useState(
    () => Number(localStorage.getItem(POMODORO_DURATION_KEY)) || 25,
  );
  const [pomodoroSeconds, setPomodoroSeconds] = useState(
    () => (Number(localStorage.getItem(POMODORO_DURATION_KEY)) || 25) * 60,
  );
  const [pomodoroRunning, setPomodoroRunning] = useState(false);
  const startButton = useRef<HTMLButtonElement | null>(null);

  const playCompletionAlert = () => {
    const { alertSound, alertVolume } = loadSettings();
    playAlert(alertSound, alertVolume);
  };

  useEffect(() => {
    if (frame.feature !== "pomodoro" || !pomodoroRunning) return;
    const timer = window.setInterval(() => {
      setPomodoroSeconds((current) => {
        if (current <= 1) {
          setPomodoroRunning(false);
          playCompletionAlert();
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [frame.feature, pomodoroRunning]);

  useEffect(() => {
    setStored(POMODORO_DURATION_KEY, String(pomodoroDuration));
  }, [pomodoroDuration]);

  const chooseTimer = useCallback((minutes: number) => {
    setPomodoroDuration(minutes);
    setPomodoroRunning(false);
    setPomodoroSeconds(minutes * 60);
    startButton.current?.focus();
  }, []);

  const totalSeconds = Math.max(1, pomodoroDuration * 60);
  const progress = Math.min(1, Math.max(0, 1 - pomodoroSeconds / totalSeconds));

  return (
    <section
      ref={frameRef}
      className={`${active ? "workspace-frame active" : "workspace-frame"} ${
        frame.feature === "notes" ? "note-frame" : ""
      }`}
      aria-label={frame.title}
      aria-current={active ? "page" : undefined}
      tabIndex={-1}
    >
      <span className="frame-corner tl" aria-hidden="true" />
      <span className="frame-corner tr" aria-hidden="true" />
      <span className="frame-corner bl" aria-hidden="true" />
      <span className="frame-corner br" aria-hidden="true" />

      <header className="frame-head">
        <div>
          <p className="frame-eyebrow">
            <span className="eyebrow-mark" aria-hidden="true" />
            {frame.eyebrow}
            <span className="frame-code">// frm-{frame.feature.slice(0, 3).toUpperCase()}</span>
          </p>
          <h1>
            <input
              className="frame-title-input"
              aria-label="List name"
              value={frame.title}
              onChange={(event) => onTitleChange?.(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                focusNextElement(event.currentTarget);
              }}
              onBlur={(event) => {
                if (event.target.value.trim() === "") onTitleChange?.("Untitled");
              }}
            />
          </h1>
        </div>
        <span className="frame-status">
          <span className="frame-status-dot" aria-hidden="true" />
          {active ? "Active" : "Standby"}
        </span>
      </header>

      {frame.feature === "pomodoro" ? (
        <div className="frame-body pomodoro-view">
          <p className="frame-description">
            A focused work interval with a short reset afterward.
          </p>
          <div
            className="pomodoro-dial"
            style={{ "--progress": `${progress * 360}deg` } as CSSProperties}
          >
            <div className="pomodoro-dial-inner">
              <div className="pomodoro-clock" aria-live="polite">
                {String(Math.floor(pomodoroSeconds / 60)).padStart(2, "0")}:
                {String(pomodoroSeconds % 60).padStart(2, "0")}
              </div>
              <span className="pomodoro-dial-label">
                {pomodoroRunning ? "Session live" : pomodoroSeconds === 0 ? "Complete" : "Standby"}
              </span>
            </div>
          </div>
          <p className="pomodoro-status">
            {pomodoroSeconds === 0
              ? "Interval complete"
              : pomodoroRunning
                ? "Focus session running"
                : "Ready when you are"}
          </p>
          <div className="pomodoro-presets" aria-label="Timer duration">
            <button
              type="button"
              className={pomodoroDuration === 15 ? "selected" : ""}
              onClick={() => chooseTimer(15)}
            >
              15 min
            </button>
            <button
              type="button"
              className={pomodoroDuration === 25 ? "selected" : ""}
              onClick={() => chooseTimer(25)}
            >
              25 min
            </button>
            <label className={pomodoroDuration !== 15 && pomodoroDuration !== 25 ? "selected" : ""}>
              Custom
              <input
                type="number"
                min="1"
                max="180"
                value={pomodoroDuration !== 15 && pomodoroDuration !== 25 ? pomodoroDuration : ""}
                placeholder="min"
                onChange={(event) =>
                  chooseTimer(Math.max(1, Math.min(180, Number(event.target.value) || 1)))
                }
              />
            </label>
          </div>
          <div className="pomodoro-actions">
            <button
              ref={startButton}
              type="button"
              onClick={() => setPomodoroRunning((current) => !current)}
            >
              {pomodoroRunning ? "Pause" : "Start focus"}
            </button>
            <button
              type="button"
              onClick={() => {
                setPomodoroRunning(false);
                setPomodoroSeconds(pomodoroDuration * 60);
              }}
            >
              Reset
            </button>
          </div>
          <p className="frame-foot">Take a five-minute break when the interval ends</p>
        </div>
      ) : frame.feature === "focus music" ? (
        <div className="frame-body" />
      ) : frame.feature === "todo list" ? (
        <div className="frame-body">
          <TodoFrame
            key={frame.id}
            items={todoItems ?? []}
            view={todoView ?? { filter: "all", sort: "manual" }}
            onViewChange={onTodoViewChange ?? (() => undefined)}
            onChange={onTodoChange ?? (() => undefined)}
            onDeleteList={onDelete}
          />
        </div>
      ) : frame.feature === "notes" ? (
        <div className="frame-body note-body">
          <div
            ref={editorHost}
            className="note-editor editorjs-note"
            aria-label="Note block editor"
          />
          <small className="markdown-hint">Local autosave // markdown blocks on this device</small>
        </div>
      ) : (
        <div className="frame-body">
          <p className="frame-description">{frame.description}</p>
          <ul className="frame-list">
            {frame.details.map((detail, index) => (
              <li key={detail}>
                <span className="list-index">{String(index + 1).padStart(2, "0")}</span>
                <span className="list-copy">{detail}</span>
                <span className="list-pip" aria-hidden="true" />
              </li>
            ))}
          </ul>
          <p className="frame-foot">Use the frame stack to revisit earlier contexts</p>
        </div>
      )}
    </section>
  );
}
