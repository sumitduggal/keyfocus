import type { TodoItem } from "./todo";
import type { WorkspaceFrame } from "./types";

export const TRASH_KEY = "focus-space-trash";
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

// An item that was removed, with its position in the list it came from.
export interface RemovedTodoItem {
  item: TodoItem;
  index: number;
}

// Items removed from a list (delete, clear completed), or a whole list.
export type TrashEntry =
  | {
      id: string;
      removedAt: string;
      kind: "items";
      frameId: string;
      title: string;
      removed: RemovedTodoItem[];
    }
  | {
      id: string;
      removedAt: string;
      kind: "list";
      frame: WorkspaceFrame;
      position: number;
      items: TodoItem[];
    };

// The items in `previous` that are missing from `next`, with their positions in `previous`.
export function removedItemsBetween(previous: TodoItem[], next: TodoItem[]): RemovedTodoItem[] {
  const kept = new Set(next.map((item) => item.id));
  return previous
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !kept.has(item.id));
}

// Puts removed items back at their old positions. Items already present are left alone.
export function restoreRemovedItems(current: TodoItem[], removed: RemovedTodoItem[]): TodoItem[] {
  const present = new Set(current.map((item) => item.id));
  const result = [...current];
  for (const { item, index } of [...removed].sort((a, b) => a.index - b.index)) {
    if (present.has(item.id)) continue;
    result.splice(Math.min(index, result.length), 0, item);
    present.add(item.id);
  }
  return result;
}

export function addTrashEntry(entries: TrashEntry[], entry: TrashEntry): TrashEntry[] {
  return [entry, ...entries];
}

export function removeTrashEntry(entries: TrashEntry[], id: string): TrashEntry[] {
  return entries.filter((entry) => entry.id !== id);
}

// Keeps entries removed within the last seven days.
export function pruneTrash(entries: TrashEntry[], now: Date): TrashEntry[] {
  const cutoff = now.getTime() - RETENTION_MS;
  return entries.filter((entry) => new Date(entry.removedAt).getTime() >= cutoff);
}

export function loadTrash(storage: Pick<Storage, "getItem">): TrashEntry[] {
  try {
    const raw = storage.getItem(TRASH_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TrashEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveTrash(storage: Pick<Storage, "setItem">, entries: TrashEntry[]): void {
  try {
    storage.setItem(TRASH_KEY, JSON.stringify(entries));
  } catch {
    // Storage can be full or blocked; the in-memory undo still works.
  }
}
