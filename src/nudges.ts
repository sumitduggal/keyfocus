// A habit can have a daily nudge time. At that time, if the habit is not yet ticked for the day, the
// person is alerted once. A missed nudge stays in the Overdue list until it is ticked or skipped.
import { canTick, dayKey, type Habit } from "./habits";

export interface Nudge {
  frameId: string;
  habitId: string;
  day: string;
  name: string; // copied when the nudge fires, so the Overdue list needs no habit lookup
  icon?: string;
}

export interface NudgeState {
  lastNudged: Record<string, string>; // habit id to the last day it was nudged
  open: Nudge[];
}

export const NUDGES_KEY = "focus-space-habit-nudges";
export const EMPTY_NUDGES: NudgeState = { lastNudged: {}, open: [] };

const isTime = (value: unknown): value is string => typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
export { isTime };

// Habits whose nudge time has passed today, that are not done today and were not nudged yet today.
export function dueNudges(lists: Record<string, Habit[]>, state: NudgeState, now: Date): Nudge[] {
  const today = dayKey(now);
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const due: Nudge[] = [];
  for (const [frameId, habits] of Object.entries(lists)) {
    for (const habit of habits) {
      if (habit.archived || !habit.nudge || habit.nudge > time) continue;
      if (habit.done.includes(today) || state.lastNudged[habit.id] === today) continue;
      due.push({ frameId, habitId: habit.id, day: today, name: habit.name, icon: habit.icon });
    }
  }
  return due;
}

// Open nudges go away once the habit is ticked for that day, removed or archived, or the day can
// no longer be ticked.
export function pruneNudges(open: Nudge[], lists: Record<string, Habit[]>, now: Date): Nudge[] {
  return open.filter((nudge) => {
    const habit = lists[nudge.frameId]?.find((candidate) => candidate.id === nudge.habitId);
    return habit && !habit.archived && !habit.done.includes(nudge.day) && canTick(nudge.day, now);
  });
}

export function loadNudges(storage: Pick<Storage, "getItem">): NudgeState {
  try {
    const parsed = JSON.parse(storage.getItem(NUDGES_KEY) ?? "null") as Partial<NudgeState> | null;
    const lastNudged: Record<string, string> = {};
    for (const [id, day] of Object.entries(parsed?.lastNudged ?? {})) {
      if (typeof day === "string") lastNudged[id] = day;
    }
    const open = (Array.isArray(parsed?.open) ? parsed.open : []).filter(
      (nudge): nudge is Nudge =>
        typeof nudge?.frameId === "string" &&
        typeof nudge?.habitId === "string" &&
        typeof nudge?.day === "string" &&
        typeof nudge?.name === "string",
    );
    return { lastNudged, open };
  } catch {
    return EMPTY_NUDGES;
  }
}

export function saveNudges(storage: Pick<Storage, "setItem">, state: NudgeState): void {
  try {
    storage.setItem(NUDGES_KEY, JSON.stringify(state));
  } catch {
    // Storage may be unavailable or full; the in-memory state remains authoritative.
  }
}
