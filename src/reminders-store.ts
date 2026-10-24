import {
  EMPTY_REMINDERS,
  completeReminder,
  REMINDERS_KEY,
  loadReminders,
  saveReminders,
  snoozeReminder,
  tick,
  type Reminder,
  type RemindersData,
} from "./reminders";
import type { Habit } from "./habits";
import { loadSettings, playAlert } from "./settings";
import { NUDGES_KEY, dueNudges, loadNudges, pruneNudges, saveNudges, type Nudge } from "./nudges";

export interface BannerItem {
  frameId: string;
  id: string; // a reminder id, or a habit id for a nudge
  nudge?: boolean;
  day?: string; // for a nudge: the day it was for, since a habit can have more than one open
}

export interface RemindersState {
  lists: Record<string, RemindersData>;
  // Reminders whose alert banner is still showing. Dismissing a banner leaves the reminder overdue.
  banner: BannerItem[];
  // Habit nudges that have fired and are not yet ticked or skipped. They count as overdue.
  nudges: Nudge[];
}

// The app's habits, which the scheduler reads for nudges and writes when a nudge is ticked.
export interface HabitSource {
  get: () => Record<string, Habit[]>;
  tick: (frameId: string, habitId: string, day: string) => void;
}

// One store for the whole app, so alerts fire whichever frame is open.
let state: RemindersState = { lists: {}, banner: [], nudges: [] };
let lastNudged: Record<string, string> = {};
let habitSource: HabitSource | null = null;
const listeners = new Set<() => void>();
let started = false;

function emit(next: Partial<RemindersState>) {
  state = { ...state, ...next };
  if (next.lists) saveReminders(localStorage, state.lists);
  if (next.nudges) saveNudges(localStorage, { lastNudged, open: state.nudges });
  listeners.forEach((listener) => listener());
}

export function subscribeReminders(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getRemindersState(): RemindersState {
  return state;
}

// Plays the sound and volume chosen in Settings. Audio can be blocked until the person has used
// the page; the banner still shows.
function ringAlert() {
  try {
    const { alertSound, alertVolume } = loadSettings();
    playAlert(alertSound, alertVolume);
  } catch {
    // Nothing to do: the banner is the alert.
  }
}

function notify(reminders: Reminder[]) {
  if (!document.hidden || typeof Notification === "undefined" || Notification.permission !== "granted") return;
  for (const reminder of reminders) new Notification("Reminder", { body: reminder.text, tag: reminder.id });
}

// Asked the first time a reminder is saved. A refusal leaves the banner and sound working.
export function requestNotificationPermission(): void {
  if (typeof Notification !== "undefined" && Notification.permission === "default") {
    void Notification.requestPermission();
  }
}

// Fires whatever has come due. At start-up it is silent: reminders missed while the app was closed
// just show as overdue, with no banner, sound or notification.
function checkNudges(silent: boolean, now: Date) {
  if (!habitSource) return;
  const lists = habitSource.get();
  const kept = pruneNudges(state.nudges, lists, now);
  const due = dueNudges(lists, { lastNudged, open: state.nudges }, now);
  if (due.length === 0 && kept.length === state.nudges.length) return;
  for (const nudge of due) lastNudged[nudge.habitId] = nudge.day;
  emit({
    nudges: [...kept, ...due],
    banner: silent
      ? state.banner
      : [...state.banner.filter((item) => !item.nudge || kept.some((nudge) => nudge.habitId === item.id && nudge.day === item.day)), ...due.map((nudge) => ({ frameId: nudge.frameId, id: nudge.habitId, nudge: true, day: nudge.day }))],
  });
  if (!silent && due.length > 0) {
    ringAlert();
    const names = due.flatMap((nudge) => lists[nudge.frameId]?.find((habit) => habit.id === nudge.habitId)?.name ?? []);
    if (document.hidden && typeof Notification !== "undefined" && Notification.permission === "granted") {
      for (const name of names) new Notification("Habit", { body: name, tag: `habit-${name}` });
    }
  }
}

// A banner only makes sense while its reminder is still overdue, or its nudge still open. Deleting
// or editing a reminder, or ticking a habit elsewhere, leaves an entry behind that this clears.
function dropStaleBanner() {
  const banner = state.banner.filter((item) =>
    item.nudge
      ? state.nudges.some((nudge) => nudge.habitId === item.id && nudge.day === item.day)
      : (state.lists[item.frameId]?.reminders.find((reminder) => reminder.id === item.id)?.firedAt ?? null) !== null,
  );
  if (banner.length !== state.banner.length) emit({ banner });
}

function check(silent: boolean) {
  const now = new Date();
  dropStaleBanner();
  checkNudges(silent, now);
  const lists: Record<string, RemindersData> = {};
  const alerts: BannerItem[] = [];
  const fired: Reminder[] = [];
  let changed = false;
  for (const [frameId, data] of Object.entries(state.lists)) {
    const result = tick(data, now);
    lists[frameId] = result.data;
    if (result.data !== data) changed = true;
    for (const reminder of result.fired) {
      alerts.push({ frameId, id: reminder.id });
      fired.push(reminder);
    }
  }
  if (!changed) return;
  if (silent || alerts.length === 0) {
    emit({ lists });
    return;
  }
  emit({ lists, banner: [...state.banner, ...alerts] });
  ringAlert();
  notify(fired);
}

export function initReminders(): void {
  if (started) return;
  started = true;
  const saved = loadNudges(localStorage);
  lastNudged = saved.lastNudged;
  state = { ...state, lists: loadReminders(localStorage), nudges: saved.open };
  check(true);
  emit({});
  window.setInterval(() => check(false), 1000);
  // Another tab saved. Take its data, so this tab does not later save over it with a stale copy.
  window.addEventListener("storage", (event) => {
    if (event.key === REMINDERS_KEY) {
      state = { ...state, lists: loadReminders(localStorage) };
    } else if (event.key === NUDGES_KEY) {
      const nudges = loadNudges(localStorage);
      lastNudged = nudges.lastNudged;
      state = { ...state, nudges: nudges.open };
    } else {
      return;
    }
    listeners.forEach((listener) => listener());
  });
}

const without = (banner: BannerItem[], frameId: string, id: string, nudge = false, day?: string) =>
  banner.filter(
    (item) => !(item.frameId === frameId && item.id === id && Boolean(item.nudge) === nudge && item.day === day),
  );

// Registered by the app once its habits are loaded. Nudges start firing from then on.
export function registerHabitSource(source: HabitSource): void {
  habitSource = source;
  if (started) check(true);
}

export function updateReminders(frameId: string, change: (data: RemindersData) => RemindersData): void {
  const current = state.lists[frameId] ?? EMPTY_REMINDERS;
  emit({ lists: { ...state.lists, [frameId]: change(current) } });
}

export function finishReminder(frameId: string, id: string): void {
  updateReminders(frameId, (data) => completeReminder(data, id, new Date()));
  emit({ banner: without(state.banner, frameId, id) });
}

export function snoozeUntil(frameId: string, id: string, until: string): void {
  updateReminders(frameId, (data) => snoozeReminder(data, id, until));
  emit({ banner: without(state.banner, frameId, id) });
}

export function dismissBanner(frameId: string, id: string, nudge = false, day?: string): void {
  emit({ banner: without(state.banner, frameId, id, nudge, day) });
}

// Ticks the habit for the nudge's day. The nudge then clears itself on the next check.
export function tickNudge(nudge: Nudge): void {
  habitSource?.tick(nudge.frameId, nudge.habitId, nudge.day);
  emit({
    nudges: state.nudges.filter((open) => open.habitId !== nudge.habitId || open.day !== nudge.day),
    banner: without(state.banner, nudge.frameId, nudge.habitId, true, nudge.day),
  });
}

// Drops a missed nudge without ticking the habit.
export function skipNudge(nudge: Nudge): void {
  emit({
    nudges: state.nudges.filter((open) => open.habitId !== nudge.habitId || open.day !== nudge.day),
    banner: without(state.banner, nudge.frameId, nudge.habitId, true, nudge.day),
  });
}

// Deleting a frame removes its reminders; the removed data comes back so the delete can be undone.
export function removeFrameReminders(frameId: string): RemindersData | undefined {
  const removed = state.lists[frameId];
  const lists = Object.fromEntries(Object.entries(state.lists).filter(([id]) => id !== frameId));
  emit({ lists, banner: state.banner.filter((item) => item.frameId !== frameId) });
  return removed;
}

export function restoreFrameReminders(frameId: string, data: RemindersData): void {
  emit({ lists: { ...state.lists, [frameId]: data } });
}
