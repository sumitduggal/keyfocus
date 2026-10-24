// The bookmarks library as one shared store, so the frame and the Settings panel (import and
// export) work on the same data.
import { loadLibrary, pruneTrash, saveLibrary, type Library } from "./bookmarks";

let library: Library = pruneTrash(loadLibrary(localStorage), new Date());
const listeners = new Set<() => void>();

export const subscribeLibrary = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getLibrary = () => library;

export function updateLibrary(next: Library | ((current: Library) => Library)): void {
  library = typeof next === "function" ? next(library) : next;
  saveLibrary(localStorage, library);
  listeners.forEach((listener) => listener());
}
