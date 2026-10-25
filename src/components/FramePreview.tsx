import type { CSSProperties, ReactNode } from "react";
import type { FrameData } from "../frame-summary";
import { addDays, dayKey, localFirstDay, weekStart } from "../habits";
import { formatClock } from "../pomodoro";
import { isOverdue, nextTrigger, toDate } from "../reminders";
import type { WorkspaceFrame } from "../types";

// A small version of what a frame looks like right now, for its card in the stack. It is drawn from
// the frame's own data, so a running timer or a ticked habit shows in the stack as it does in the frame.
const ROWS = 3;
const FIRST_DAY = localFirstDay();

interface Row {
  key: string;
  mark?: string;
  text: string;
  right?: ReactNode;
  done?: boolean;
  warn?: boolean;
}

function Rows({ rows, empty }: { rows: Row[]; empty: string }) {
  if (rows.length === 0) return <p className="fp-empty">{empty}</p>;
  return (
    <ul className="fp-rows">
      {rows.slice(0, ROWS).map((row) => (
        <li key={row.key} className={`${row.done ? "is-done" : ""} ${row.warn ? "is-warn" : ""}`}>
          {row.mark && <span className="fp-mark">{row.mark}</span>}
          <span className="fp-text">{row.text}</span>
          {row.right && <span className="fp-right">{row.right}</span>}
        </li>
      ))}
    </ul>
  );
}

const shortTime = (stamp: string) =>
  toDate(stamp).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" });

export function FramePreview({ frame, data }: { frame: WorkspaceFrame; data: FrameData }) {
  switch (frame.feature) {
    case "pomodoro": {
      const { phase, remainingSec, durationMin } = data.pomodoro;
      const progress = phase === "complete" ? 1 : 1 - remainingSec / (durationMin * 60);
      const label = phase === "running" ? "Session live" : phase === "paused" ? "Paused" : phase === "complete" ? "Complete" : "Standby";
      return (
        <div className="fp-timer">
          <span className="fp-ring" style={{ "--progress": `${progress * 360}deg` } as CSSProperties} />
          <span className="fp-time">
            <span className="fp-clock">{formatClock(remainingSec)}</span>
            <span className="fp-label">{label}</span>
          </span>
        </div>
      );
    }
    case "todo list": {
      // Open items first, then done ones, top level only.
      const items = (data.todos[frame.id] ?? []).filter((item) => !item.parentId);
      const ordered = [...items.filter((item) => !item.done), ...items.filter((item) => item.done)];
      return (
        <Rows
          empty="Empty list"
          rows={ordered.map((item) => ({ key: item.id, mark: item.done ? "☑" : "☐", text: item.text, done: item.done }))}
        />
      );
    }
    case "habits": {
      const today = dayKey(data.today);
      const week = Array.from({ length: 7 }, (_, offset) => addDays(weekStart(today, FIRST_DAY), offset));
      return (
        <Rows
          empty="No habits yet"
          rows={(data.habits[frame.id] ?? [])
            .filter((habit) => !habit.archived)
            .map((habit) => ({
              key: habit.id,
              text: habit.name,
              right: (
                <span className="fp-dots">
                  {week.map((day) => (
                    <i key={day} className={`fp-dot${habit.done.includes(day) ? " is-done" : ""}`} />
                  ))}
                </span>
              ),
            }))}
        />
      );
    }
    case "reminders": {
      const list = data.reminders[frame.id]?.reminders ?? [];
      const sorted = [...list].sort((a, b) => (nextTrigger(a) ?? a.firedAt ?? "").localeCompare(nextTrigger(b) ?? b.firedAt ?? ""));
      return (
        <Rows
          empty="No reminders"
          rows={sorted.map((reminder) => ({
            key: reminder.id,
            mark: "◷",
            text: reminder.text,
            warn: isOverdue(reminder),
            right: isOverdue(reminder) ? "overdue" : shortTime(nextTrigger(reminder) ?? reminder.due),
          }))}
        />
      );
    }
    case "bookmarks":
      return (
        <Rows
          empty="No bookmarks yet"
          rows={data.library.bookmarks
            .filter((bookmark) => !bookmark.trashedAt)
            .map((bookmark) => ({ key: bookmark.id, mark: "⚐", text: bookmark.title || bookmark.url }))}
        />
      );
    case "notes":
      return (
        <Rows
          empty="Empty note"
          rows={(data.notes[frame.id] ?? "")
            .split("\n")
            .map((line) => line.replace(/^[#>\-*\s[\]x]+/i, "").trim())
            .filter(Boolean)
            .map((text, index) => ({ key: String(index), text }))}
        />
      );
    default:
      return <p className="fp-empty">{frame.description}</p>;
  }
}
