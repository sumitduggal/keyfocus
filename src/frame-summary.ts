// A one-line look at what is inside a frame, shown on its card in the stack so you can see what you
// were working on without opening it. It reads the frame's own data, not the template description.
import type { Library } from "./bookmarks";
import { dayKey, type Habit } from "./habits";
import { formatClock, type PomodoroState } from "./pomodoro";
import { isOverdue, summarise, type RemindersData } from "./reminders";
import type { TodoItem } from "./todo";
import type { WorkspaceFrame } from "./types";

export interface FrameData {
  todos: Record<string, TodoItem[]>;
  habits: Record<string, Habit[]>;
  reminders: Record<string, RemindersData>;
  notes: Record<string, string>;
  library: Library;
  pomodoro: PomodoroState;
  today: Date;
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

export function frameSummary(frame: WorkspaceFrame, data: FrameData): string {
  switch (frame.feature) {
    case "todo list": {
      const items = data.todos[frame.id] ?? [];
      const open = items.filter((item) => !item.done);
      if (items.length === 0) return "Empty list";
      return open.length === 0 ? "All done" : `${open.length} open · ${open[0].text}`;
    }
    case "habits": {
      const active = (data.habits[frame.id] ?? []).filter((habit) => !habit.archived);
      if (active.length === 0) return "No habits yet";
      const today = dayKey(data.today);
      const ticked = active.filter((habit) => habit.done.includes(today)).length;
      return `${ticked} of ${plural(active.length, "habit")} done today`;
    }
    case "reminders": {
      const list = data.reminders[frame.id] ?? { reminders: [], done: [] };
      if (list.reminders.length === 0) return "No reminders";
      const overdue = list.reminders.filter(isOverdue).length;
      const { next } = summarise([list]);
      const tail = overdue > 0 ? `${overdue} overdue` : next ? `next: ${next.text}` : "";
      return [plural(list.reminders.length, "reminder"), tail].filter(Boolean).join(" · ");
    }
    case "notes": {
      // The first line with words in it, without the markdown marks.
      const line = (data.notes[frame.id] ?? "").split("\n").map((text) => text.replace(/^[#>\-*\s[\]x]+/i, "").trim()).find(Boolean);
      return line ?? "Empty note";
    }
    case "pomodoro": {
      const { phase, remainingSec, durationMin } = data.pomodoro;
      if (phase === "running") return `${formatClock(remainingSec)} left`;
      if (phase === "paused") return `Paused · ${formatClock(remainingSec)}`;
      return phase === "complete" ? "Session complete" : `${durationMin} min timer`;
    }
    case "bookmarks": {
      const count = data.library.bookmarks.filter((bookmark) => !bookmark.trashedAt).length;
      return count === 0 ? "No bookmarks yet" : plural(count, "bookmark");
    }
    default:
      return frame.description;
  }
}
