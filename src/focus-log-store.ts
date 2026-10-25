import { addEntry, loadFocusLog, saveFocusLog, FOCUS_LOG_KEY, type FocusEntry } from "./focus-log";

let log: FocusEntry[] | null = null;
let watching = false;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((listener) => listener());

export function getFocusLog(): FocusEntry[] {
  log ??= loadFocusLog(localStorage);
  return log;
}

export function subscribeFocusLog(listener: () => void): () => void {
  if (!watching) {
    watching = true;
    // Another tab recorded a session; take its log.
    window.addEventListener("storage", (event) => {
      if (event.key !== FOCUS_LOG_KEY) return;
      log = loadFocusLog(localStorage);
      notify();
    });
  }
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Adds a session. The saved log is read again first, so a session another tab recorded is not lost.
export function recordSession(seconds: number, completed: boolean): void {
  if (seconds <= 0) return;
  log = addEntry(loadFocusLog(localStorage), { at: Date.now(), seconds: Math.round(seconds), completed });
  saveFocusLog(localStorage, log);
  notify();
}
