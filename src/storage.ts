// Storage can be full or blocked. The in-memory state still works, so a failed save must not stop the app.
export function setStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // The value stays in memory until the page reloads.
  }
}
