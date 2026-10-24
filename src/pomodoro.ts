// The Pomodoro timer for the whole app, so it keeps counting whichever frame is open and the
// header, dock and tab title can all show it. It counts down to a fixed end time instead of
// subtracting a second per tick, so a throttled background tab does not make it run slow.
import { POMODORO_DURATION_KEY } from "./constants";
import { requestNotificationPermission } from "./reminders-store";
import { loadSettings, playAlert } from "./settings";
import { setStored } from "./storage";

export type PomodoroPhase = "idle" | "running" | "paused" | "complete";

export interface PomodoroState {
  durationMin: number;
  remainingSec: number;
  phase: PomodoroPhase;
}

export const DEFAULT_MINUTES = 25;
export const MAX_MINUTES = 180;

// A length that is not a number falls back to the default; any number is kept within 1 to 180.
const clampMinutes = (value: number) =>
  Number.isFinite(value) ? Math.min(MAX_MINUTES, Math.max(1, Math.round(value))) : DEFAULT_MINUTES;

// "18:42", from a number of seconds.
export const formatClock = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

function savedMinutes(): number {
  try {
    return clampMinutes(Number(localStorage.getItem(POMODORO_DURATION_KEY)) || DEFAULT_MINUTES);
  } catch {
    return DEFAULT_MINUTES;
  }
}

let state: PomodoroState | null = null;
let endsAt = 0; // while running: when the timer finishes, in ms
let pausedMs = 0; // while paused: how much time is left, in ms
let timer: number | undefined;
const listeners = new Set<() => void>();

function current(): PomodoroState {
  if (!state) {
    const durationMin = savedMinutes();
    state = { durationMin, remainingSec: durationMin * 60, phase: "idle" };
  }
  return state;
}

function emit(next: Partial<PomodoroState>) {
  const before = current();
  const after = { ...before, ...next };
  if (after.durationMin === before.durationMin && after.remainingSec === before.remainingSec && after.phase === before.phase) return;
  state = after;
  listeners.forEach((listener) => listener());
}

export function subscribePomodoro(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPomodoroState(): PomodoroState {
  return current();
}

function ring() {
  try {
    const { alertSound, alertVolume } = loadSettings();
    playAlert(alertSound, alertVolume);
  } catch {
    // Audio can be blocked until the page has been used; the header still shows the timer is done.
  }
  if (document.hidden && typeof Notification !== "undefined" && Notification.permission === "granted") {
    new Notification("Focus session complete", { body: "Take a five-minute break.", tag: "pomodoro" });
  }
}

function stopTicking() {
  window.clearInterval(timer);
  timer = undefined;
}

function tick() {
  const left = endsAt - Date.now();
  if (left <= 0) {
    stopTicking();
    emit({ remainingSec: 0, phase: "complete" });
    ring();
    return;
  }
  emit({ remainingSec: Math.ceil(left / 1000) });
}

export function startPomodoro(): void {
  const { phase, durationMin, remainingSec } = current();
  if (phase === "running") return;
  requestNotificationPermission();
  // A finished timer starts again from the full length.
  const ms = phase === "paused" ? pausedMs : phase === "complete" ? durationMin * 60_000 : remainingSec * 1000;
  endsAt = Date.now() + ms;
  stopTicking();
  timer = window.setInterval(tick, 250);
  emit({ phase: "running", remainingSec: Math.ceil(ms / 1000) });
}

export function pausePomodoro(): void {
  if (current().phase !== "running") return;
  stopTicking();
  pausedMs = Math.max(0, endsAt - Date.now());
  emit({ phase: "paused", remainingSec: Math.ceil(pausedMs / 1000) });
}

export function togglePomodoro(): void {
  if (current().phase === "running") pausePomodoro();
  else startPomodoro();
}

export function resetPomodoro(): void {
  stopTicking();
  emit({ phase: "idle", remainingSec: current().durationMin * 60 });
}

// Choosing a length stops the timer and starts that length fresh.
export function setPomodoroMinutes(minutes: number): void {
  const durationMin = clampMinutes(minutes);
  stopTicking();
  setStored(POMODORO_DURATION_KEY, String(durationMin));
  emit({ durationMin, phase: "idle", remainingSec: durationMin * 60 });
}
