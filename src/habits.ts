import { isIcon } from "./icons";

// Habits: a weekly target per habit and the days it was done. A missed week changes nothing.
// Days are local dates written as YYYY-MM-DD, so they sort and compare as plain strings.

export interface Habit {
  id: string;
  name: string;
  // Each entry applies from the start of the week it was set in, so past weeks keep the target they had.
  targets: { since: string; target: number }[];
  done: string[];
  archived: boolean;
  icon?: string; // chosen by the person; a default shows until then
  nudge?: string; // HH:MM; a daily alert while the habit is not yet ticked
}

export const HABITS_KEY = "focus-space-habits";
// A habit can be ticked for today and this many days back.
export const BACKFILL_DAYS = 2;
export const MAX_TARGET = 7;

export function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function parseDay(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(key: string, days: number): string {
  const date = parseDay(key);
  date.setDate(date.getDate() + days);
  return dayKey(date);
}

// First day of the week from the browser's locale, as 0 (Sunday) to 6. Falls back to Monday.
export function localFirstDay(): number {
  try {
    const locale = new Intl.Locale(navigator.language) as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number };
      weekInfo?: { firstDay: number };
    };
    const firstDay = (locale.getWeekInfo?.() ?? locale.weekInfo)?.firstDay;
    return firstDay === undefined ? 1 : firstDay % 7;
  } catch {
    return 1;
  }
}

export function weekStart(key: string, firstDay: number): string {
  const offset = (parseDay(key).getDay() - firstDay + 7) % 7;
  return addDays(key, -offset);
}

export function createHabit(name: string, target: number, id: string, today: Date, firstDay: number): Habit {
  return {
    id,
    name: name.trim(),
    targets: [{ since: weekStart(dayKey(today), firstDay), target: clampTarget(target) }],
    done: [],
    archived: false,
  };
}

function clampTarget(target: number): number {
  return Math.min(MAX_TARGET, Math.max(1, Math.round(target) || 1));
}

export function targetForWeek(habit: Habit, week: string): number {
  let target = habit.targets[0]?.target ?? 1;
  for (const entry of habit.targets) {
    if (entry.since <= week) target = entry.target;
  }
  return target;
}

export function currentTarget(habit: Habit): number {
  return habit.targets[habit.targets.length - 1]?.target ?? 1;
}

// Changing the target applies from this week onward. Earlier weeks keep theirs.
export function setHabitTarget(habits: Habit[], id: string, target: number, today: Date, firstDay: number): Habit[] {
  const since = weekStart(dayKey(today), firstDay);
  return habits.map((habit) => {
    if (habit.id !== id) return habit;
    const kept = habit.targets.filter((entry) => entry.since < since);
    return { ...habit, targets: [...kept, { since, target: clampTarget(target) }] };
  });
}

export function renameHabit(habits: Habit[], id: string, name: string): Habit[] {
  const trimmed = name.trim();
  if (!trimmed) return habits;
  return habits.map((habit) => (habit.id === id ? { ...habit, name: trimmed } : habit));
}

export function setHabitIcon(habits: Habit[], id: string, icon: string): Habit[] {
  return habits.map((habit) => (habit.id === id ? { ...habit, icon } : habit));
}

// An empty time clears the nudge.
export function setHabitNudge(habits: Habit[], id: string, time: string): Habit[] {
  return habits.map((habit) => {
    if (habit.id !== id) return habit;
    const { nudge: _removed, ...rest } = habit;
    return time ? { ...rest, nudge: time } : rest;
  });
}

export function archiveHabit(habits: Habit[], id: string, archived: boolean): Habit[] {
  return habits.map((habit) => (habit.id === id ? { ...habit, archived } : habit));
}

export function deleteHabit(habits: Habit[], id: string): Habit[] {
  return habits.filter((habit) => habit.id !== id);
}

export function canTick(day: string, today: Date): boolean {
  const todayKey = dayKey(today);
  return day <= todayKey && day >= addDays(todayKey, -BACKFILL_DAYS);
}

// Ticks or unticks one day. Days outside the backfill window are left alone.
export function toggleDay(habits: Habit[], id: string, day: string, today: Date): Habit[] {
  if (!canTick(day, today)) return habits;
  return habits.map((habit) => {
    if (habit.id !== id) return habit;
    const done = habit.done.includes(day)
      ? habit.done.filter((entry) => entry !== day)
      : [...habit.done, day].sort();
    return { ...habit, done };
  });
}

export function weekCount(habit: Habit, week: string): number {
  const end = addDays(week, 6);
  return habit.done.filter((day) => day >= week && day <= end).length;
}

export function weekProgress(habit: Habit, today: Date, firstDay: number): { count: number; target: number } {
  const week = weekStart(dayKey(today), firstDay);
  return { count: weekCount(habit, week), target: targetForWeek(habit, week) };
}

// The most days done in any one week so far. Zero until something is ticked.
export function bestWeek(habit: Habit, firstDay: number): number {
  const counts = new Map<string, number>();
  for (const day of habit.done) {
    const week = weekStart(day, firstDay);
    counts.set(week, (counts.get(week) ?? 0) + 1);
  }
  return Math.max(0, ...counts.values());
}

export function nextWeekTarget(habit: Habit): number {
  return currentTarget(habit);
}

export interface HeatDay {
  day: string;
  done: boolean;
  future: boolean;
}

// Whole weeks ending with the current one, oldest first. Missed days are just not done.
export function heatMap(habit: Habit, today: Date, firstDay: number, weeks: number): HeatDay[][] {
  const todayKey = dayKey(today);
  const first = addDays(weekStart(todayKey, firstDay), -7 * (weeks - 1));
  const done = new Set(habit.done);
  return Array.from({ length: weeks }, (_, week) =>
    Array.from({ length: 7 }, (_, offset) => {
      const day = addDays(first, week * 7 + offset);
      return { day, done: done.has(day), future: day > todayKey };
    }),
  );
}

function isHabit(value: unknown): value is Habit {
  if (typeof value !== "object" || value === null) return false;
  const habit = value as Partial<Habit>;
  return (
    typeof habit.id === "string" &&
    typeof habit.name === "string" &&
    typeof habit.archived === "boolean" &&
    (habit.icon === undefined || isIcon(habit.icon)) &&
    (habit.nudge === undefined || /^([01]\d|2[0-3]):[0-5]\d$/.test(habit.nudge)) &&
    Array.isArray(habit.done) &&
    habit.done.every((day) => typeof day === "string") &&
    Array.isArray(habit.targets) &&
    habit.targets.length > 0 &&
    habit.targets.every(
      (entry) => typeof entry?.since === "string" && Number.isFinite(entry.target),
    )
  );
}

export function loadHabits(storage: Pick<Storage, "getItem">): Record<string, Habit[]> {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(HABITS_KEY) ?? "null");
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    const lists: Record<string, Habit[]> = {};
    for (const [frameId, habits] of Object.entries(parsed)) {
      if (Array.isArray(habits)) lists[frameId] = habits.filter(isHabit);
    }
    return lists;
  } catch {
    return {};
  }
}

export function saveHabits(storage: Pick<Storage, "setItem">, lists: Record<string, Habit[]>): void {
  try {
    storage.setItem(HABITS_KEY, JSON.stringify(lists));
  } catch {
    // Storage may be unavailable or full; the in-memory state remains authoritative.
  }
}
