import { useCallback, useEffect, useRef, useState } from "react";
import type { RefCallback } from "react";
import EditorJS, { type OutputData } from "@editorjs/editorjs";
import Header from "@editorjs/header";
import List from "@editorjs/list";
import Quote from "@editorjs/quote";
import Checklist from "@editorjs/checklist";
import ImageTool from "@editorjs/image";
import InlineCode from "@editorjs/inline-code";
import CodeTool from "@editorjs/code";
import LinkTool from "@editorjs/link";
import Marker from "@editorjs/marker";
import type { WorkspaceFrame } from "../types";

export function Mainframe({
  frame,
  active,
  frameRef,
  noteBody,
  onNoteChange,
}: {
  frame: WorkspaceFrame;
  active: boolean;
  frameRef: RefCallback<HTMLElement>;
  noteBody?: string;
  onNoteChange?: (value: string) => void;
}) {
  const note = noteBody ?? "";
  const editorHost = useRef<HTMLDivElement | null>(null);
  const editorInstance = useRef<EditorJS | null>(null);
  const initialNote = useRef(note).current;
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
    const editor = new EditorJS({
      holder: editorHost.current,
      autofocus: true,
      data: parsed?.blocks
        ? parsed
        : {
            blocks: initialNote
              .split("\n")
              .filter(Boolean)
              .map((text) => ({ type: "paragraph", data: { text } })),
          },
      tools: {
        header: Header,
        list: List,
        quote: Quote,
        checklist: Checklist,
        image: {
          class: ImageTool,
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
        inlineCode: InlineCode,
        code: CodeTool,
        linkTool: LinkTool,
        marker: Marker,
      },
      onChange: async () => {
        const output = await editor.save();
        noteChangeRef.current?.(JSON.stringify(output));
      },
    });
    editorInstance.current = editor;
    return () => {
      editor.isReady.then(() => editor.destroy()).catch(() => undefined);
      editorInstance.current = null;
    };
  }, [frame.id, frame.feature, initialNote]);

  const [pomodoroDuration, setPomodoroDuration] = useState(
    () => Number(localStorage.getItem("focus-space-pomodoro-duration")) || 25,
  );
  const [pomodoroSeconds, setPomodoroSeconds] = useState(
    () => (Number(localStorage.getItem("focus-space-pomodoro-duration")) || 25) * 60,
  );
  const [pomodoroRunning, setPomodoroRunning] = useState(false);
  const startButton = useRef<HTMLButtonElement | null>(null);

  const playCompletionAlert = () => {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.setValueAtTime(660, context.currentTime);
    oscillator.frequency.setValueAtTime(880, context.currentTime + 0.16);
    gain.gain.setValueAtTime(0.18, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.5);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.5);
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
    localStorage.setItem("focus-space-pomodoro-duration", String(pomodoroDuration));
  }, [pomodoroDuration]);

  const chooseTimer = useCallback((minutes: number) => {
    setPomodoroDuration(minutes);
    setPomodoroRunning(false);
    setPomodoroSeconds(minutes * 60);
    startButton.current?.focus();
  }, []);

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
      <p className="frame-eyebrow">{frame.eyebrow}</p>
      <h1>{frame.title}</h1>
      {frame.feature === "pomodoro" ? (
        <div className="pomodoro-view">
          <p className="frame-description">
            A focused 25-minute work interval with a short reset afterward.
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
          <div className="pomodoro-clock" aria-live="polite">
            {String(Math.floor(pomodoroSeconds / 60)).padStart(2, "0")}:
            {String(pomodoroSeconds % 60).padStart(2, "0")}
          </div>
          <p className="pomodoro-status">
            {pomodoroSeconds === 0
              ? "Interval complete"
              : pomodoroRunning
                ? "Focus session running"
                : "Ready when you are"}
          </p>
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
      ) : frame.feature === "notes" ? (
        <>
          <div
            ref={editorHost}
            className="note-editor editorjs-note"
            aria-label="Note block editor"
          />
          <small className="markdown-hint">Markdown is saved automatically on this device.</small>
        </>
      ) : (
        <>
          <p className="frame-description">{frame.description}</p>
          <ul>
            {frame.details.map((detail) => (
              <li key={detail}>
                <span aria-hidden="true">•</span>
                {detail}
              </li>
            ))}
          </ul>
          <p className="frame-foot">Use the frame stack to revisit earlier contexts</p>
        </>
      )}
    </section>
  );
}

export function StackPreview({ frame }: { frame: WorkspaceFrame }) {
  return (
    <div className="stack-preview" aria-hidden="true">
      <p>{frame.eyebrow}</p>
      <h2>{frame.title}</h2>
      <span>{frame.description}</span>
    </div>
  );
}
