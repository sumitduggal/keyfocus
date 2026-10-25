// A log of focus time. A session that runs to the end is recorded as completed. Time from a session
// that is reset or abandoned after at least a minute is recorded too, as partial, and kept apart so
// completed time stays the headline number.
import { addDays, dayKey, localFirstDay, weekStart } from "./habits";

export interface FocusEntry {
  at: number; // when the session ended, in ms since 1970
  seconds: number; // time actually focused
  completed: boolean;
}

export const FOCUS_LOG_KEY = "focus-space-focus-log";
// A reset or abandoned session needs at least this much run time to be recorded.
export const MIN_PARTIAL_SECONDS = 60;
// The oldest entries are dropped past this many, which is years of daily use.
const MAX_ENTRIES = 5000;

export function addEntry(log: FocusEntry[], entry: FocusEntry): FocusEntry[] {
  return [...log, entry].slice(-MAX_ENTRIES);
}

export interface FocusTotals {
  completedSeconds: number;
  partialSeconds: number;
  sessions: number; // completed sessions
}

const dayOf = (entry: FocusEntry) => dayKey(new Date(entry.at));

function sum(entries: FocusEntry[]): FocusTotals {
  const totals = { completedSeconds: 0, partialSeconds: 0, sessions: 0 };
  for (const entry of entries) {
    if (entry.completed) {
      totals.completedSeconds += entry.seconds;
      totals.sessions++;
    } else {
      totals.partialSeconds += entry.seconds;
    }
  }
  return totals;
}

// Today, the last seven days including today, and everything.
export function totals(log: FocusEntry[], now: Date): { today: FocusTotals; week: FocusTotals; all: FocusTotals } {
  const today = dayKey(now);
  const weekStartDay = addDays(today, -6);
  return {
    today: sum(log.filter((entry) => dayOf(entry) === today)),
    week: sum(log.filter((entry) => dayOf(entry) >= weekStartDay && dayOf(entry) <= today)),
    all: sum(log),
  };
}

export interface FocusDay extends FocusTotals {
  day: string;
}

// One row per day for the last `days` days, oldest first, including days with nothing.
export function dailySeries(log: FocusEntry[], now: Date, days: number): FocusDay[] {
  const today = dayKey(now);
  return Array.from({ length: days }, (_, index) => {
    const day = addDays(today, index - (days - 1));
    return { day, ...sum(log.filter((entry) => dayOf(entry) === day)) };
  });
}

// The day with the most focus time (completed and partial together), and the daily average over the
// days given.
export function bestDay(series: FocusDay[]): FocusDay | null {
  let best: FocusDay | null = null;
  for (const day of series) {
    const time = day.completedSeconds + day.partialSeconds;
    if (time > 0 && (best === null || time > best.completedSeconds + best.partialSeconds)) best = day;
  }
  return best;
}

export function averageSeconds(series: FocusDay[]): number {
  const total = series.reduce((all, day) => all + day.completedSeconds + day.partialSeconds, 0);
  return series.length ? Math.round(total / series.length) : 0;
}

export interface FocusCell {
  day: string;
  seconds: number;
  future: boolean;
}

// Whole weeks ending with the current one, oldest first, for a heat map.
export function focusHeatMap(log: FocusEntry[], now: Date, weeks: number, firstDay = localFirstDay()): FocusCell[][] {
  const today = dayKey(now);
  const first = addDays(weekStart(today, firstDay), -7 * (weeks - 1));
  const perDay = new Map<string, number>();
  for (const entry of log) perDay.set(dayOf(entry), (perDay.get(dayOf(entry)) ?? 0) + entry.seconds);
  return Array.from({ length: weeks }, (_, week) =>
    Array.from({ length: 7 }, (_, offset) => {
      const day = addDays(first, week * 7 + offset);
      return { day, seconds: perDay.get(day) ?? 0, future: day > today };
    }),
  );
}

// "2 h 25 min", "45 min", or "0 min". Seconds are dropped, not rounded up.
export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours === 0) return `${minutes} min`;
  return minutes % 60 === 0 ? `${hours} h` : `${hours} h ${minutes % 60} min`;
}

function isEntry(value: unknown): value is FocusEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Partial<FocusEntry>;
  return (
    Number.isFinite(entry.at) &&
    Number.isFinite(entry.seconds) &&
    (entry.seconds as number) > 0 &&
    typeof entry.completed === "boolean"
  );
}

export function loadFocusLog(storage: Pick<Storage, "getItem">): FocusEntry[] {
  try {
    const saved: unknown = JSON.parse(storage.getItem(FOCUS_LOG_KEY) ?? "null");
    return Array.isArray(saved) ? saved.filter(isEntry).slice(-MAX_ENTRIES) : [];
  } catch {
    return [];
  }
}

export function saveFocusLog(storage: Pick<Storage, "setItem">, log: FocusEntry[]): void {
  try {
    storage.setItem(FOCUS_LOG_KEY, JSON.stringify(log));
  } catch {
    // Storage may be unavailable or full; the log stays in memory until the page reloads.
  }
}
