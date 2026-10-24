import { describe, expect, it } from "vitest";
import { moveTodoItemTo, loadTodoViews, saveTodoViews, nestTodoItem, TODO_VIEWS_KEY, type TodoItem } from "./todo";
import {
  addTrashEntry,
  loadTrash,
  pruneTrash,
  removeTrashEntry,
  saveTrash,
  TRASH_KEY,
  type TrashEntry,
} from "./todo-trash";

const item = (overrides: Partial<TodoItem> & { id: string }): TodoItem => ({
  text: "Task",
  done: false,
  priority: "medium",
  due: null,
  parentId: null,
  ...overrides,
});

const fakeStorage = (initial: Record<string, string> = {}) => {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    read: (key: string) => data.get(key),
  };
};

describe("moveTodoItemTo", () => {
  it("moves an item before a target and takes the target's parent", () => {
    const items = [item({ id: "a" }), item({ id: "p" }), item({ id: "s", parentId: "p" }), item({ id: "b" })];
    const next = moveTodoItemTo(items, "b", "s", "before");
    expect(next.map((i) => i.id)).toEqual(["a", "p", "b", "s"]);
    expect(next.find((i) => i.id === "b")!.parentId).toBe("p");
  });

  it("moves an item after a target", () => {
    const items = [item({ id: "a" }), item({ id: "b" }), item({ id: "c" })];
    expect(moveTodoItemTo(items, "a", "c", "after").map((i) => i.id)).toEqual(["b", "c", "a"]);
  });

  it("refuses to drop an item inside its own steps", () => {
    const items = [item({ id: "a" }), item({ id: "s", parentId: "a" })];
    expect(moveTodoItemTo(items, "a", "s", "after")).toEqual(items);
  });

  it("does nothing when dropped on itself", () => {
    const items = [item({ id: "a" }), item({ id: "b" })];
    expect(moveTodoItemTo(items, "a", "a", "before")).toEqual(items);
  });
});

describe("pruneTrash", () => {
  const entry = (id: string, removedAt: string): TrashEntry => ({
    id,
    removedAt,
    kind: "items",
    frameId: "f",
    title: "List",
    removed: [],
  });

  it("keeps entries from the last seven days and drops older ones", () => {
    const now = new Date("2026-10-24T12:00:00Z");
    const kept = pruneTrash(
      [entry("new", "2026-10-20T12:00:00Z"), entry("old", "2026-10-10T12:00:00Z")],
      now,
    );
    expect(kept.map((e) => e.id)).toEqual(["new"]);
  });
});

describe("trash storage", () => {
  const entry: TrashEntry = {
    id: "e1",
    removedAt: "2026-10-24T12:00:00Z",
    kind: "items",
    frameId: "f",
    title: "List",
    removed: [{ item: item({ id: "a" }), index: 0 }],
  };

  it("adds the newest entry first and removes by id", () => {
    const entries = addTrashEntry([entry], { ...entry, id: "e2" });
    expect(entries.map((e) => e.id)).toEqual(["e2", "e1"]);
    expect(removeTrashEntry(entries, "e1").map((e) => e.id)).toEqual(["e2"]);
  });

  it("round-trips through storage and treats bad data as empty", () => {
    const storage = fakeStorage();
    saveTrash(storage, [entry]);
    expect(loadTrash(storage)).toEqual([entry]);
    expect(loadTrash(fakeStorage({ [TRASH_KEY]: "{bad" }))).toEqual([]);
  });
});

describe("saved views", () => {
  it("round-trips sort and filter per list", () => {
    const storage = fakeStorage();
    saveTodoViews(storage, { f1: { filter: "open", sort: "due" } });
    expect(loadTodoViews(storage)).toEqual({ f1: { filter: "open", sort: "due" } });
  });

  it("drops invalid entries and missing data", () => {
    const stored = JSON.stringify({ f1: { filter: "nope", sort: "due" }, f2: { filter: "all", sort: "manual" } });
    expect(loadTodoViews(fakeStorage({ [TODO_VIEWS_KEY]: stored }))).toEqual({
      f2: { filter: "all", sort: "manual" },
    });
    expect(loadTodoViews(fakeStorage())).toEqual({});
  });
});

import { visibleTodoGroups } from "./todo";

describe("visibleTodoGroups with deep steps", () => {
  const today = new Date(2026, 9, 24);

  it("includes all descendants with their depth, depth-first", () => {
    const items = [item({ id: "a" }), item({ id: "b", parentId: "a" }), item({ id: "c", parentId: "b" }), item({ id: "d", parentId: "a" })];
    const [group] = visibleTodoGroups(items, { filter: "all", sort: "manual" }, today);
    expect(group.rows.map((r) => [r.item.id, r.depth])).toEqual([
      ["a", 0],
      ["b", 1],
      ["c", 2],
      ["d", 1],
    ]);
  });

  it("shows a group when a deep step matches the filter", () => {
    const items = [item({ id: "a" }), item({ id: "b", parentId: "a" }), item({ id: "c", parentId: "b", due: "2026-10-01" })];
    const groups = visibleTodoGroups(items, { filter: "overdue", sort: "manual" }, today);
    expect(groups.map((g) => g.parent.id)).toEqual(["a"]);
  });
});

import { clearCompletedTodos, deleteTodoItem as deleteItem } from "./todo";

describe("removing a subtree", () => {
  it("deleting an item also deletes steps at every depth", () => {
    const items = [item({ id: "p" }), item({ id: "c", parentId: "p" }), item({ id: "g", parentId: "c" }), item({ id: "o" })];
    expect(deleteItem(items, "p").map((i) => i.id)).toEqual(["o"]);
  });

  it("clearing completed also removes steps at every depth under a done parent", () => {
    const items = [item({ id: "p", done: true }), item({ id: "c", parentId: "p" }), item({ id: "g", parentId: "c" }), item({ id: "o" })];
    expect(clearCompletedTodos(items).map((i) => i.id)).toEqual(["o"]);
  });
});

import { removedItemsBetween, restoreRemovedItems } from "./todo-trash";

describe("restoring removed items", () => {
  it("finds what was removed and where it sat", () => {
    const previous = [item({ id: "a" }), item({ id: "b" }), item({ id: "c" })];
    const removed = removedItemsBetween(previous, [item({ id: "a" }), item({ id: "c" })]);
    expect(removed.map((r) => [r.item.id, r.index])).toEqual([["b", 1]]);
  });

  it("puts removed items back at their positions without bringing back later removals", () => {
    const removed = [{ item: item({ id: "a" }), index: 0 }];
    const current = [item({ id: "c" })];
    expect(restoreRemovedItems(current, removed).map((i) => i.id)).toEqual(["a", "c"]);
  });

  it("keeps the current version of an item that is already present", () => {
    const removed = [{ item: item({ id: "a", text: "old" }), index: 0 }];
    const current = [item({ id: "a", text: "edited" })];
    expect(restoreRemovedItems(current, removed)[0].text).toBe("edited");
  });
});

describe("nesting follows the order on screen", () => {
  it("nests under the item shown directly above, not the saved order above", () => {
    // Saved order is [low, high]; on screen (sorted by priority) high is shown first, so nothing is above it.
    const items = [item({ id: "low", priority: "low" }), item({ id: "high", priority: "high" })];
    expect(nestTodoItem(items, "high", ["high", "low"])).toEqual(items);
  });

  it("nests under the row shown above when the order is given", () => {
    const items = [item({ id: "a" }), item({ id: "b" })];
    expect(nestTodoItem(items, "b", ["b", "a"]).find((i) => i.id === "b")!.parentId).toBeNull();
  });
});

import { overdueCount } from "./todo";

describe("overdueCount", () => {
  const today = new Date(2026, 9, 24);

  it("counts open items due before today, including steps", () => {
    const items = [
      item({ id: "a", due: "2026-10-20" }),
      item({ id: "b", due: "2026-10-20", done: true }),
      item({ id: "c", due: "2026-10-24" }),
      item({ id: "d", parentId: "a", due: "2026-10-01" }),
    ];
    expect(overdueCount(items, today)).toBe(2);
  });
});

import { setTodoDue } from "./todo";

describe("setTodoDue", () => {
  it("sets a valid date on the item", () => {
    const items = [item({ id: "a" })];
    expect(setTodoDue(items, "a", "2026-11-12")[0].due).toBe("2026-11-12");
  });

  it("clears the date with null", () => {
    const items = [item({ id: "a", due: "2026-11-12" })];
    expect(setTodoDue(items, "a", null)[0].due).toBeNull();
  });

  it("ignores a malformed date", () => {
    const items = [item({ id: "a", due: "2026-11-12" })];
    expect(setTodoDue(items, "a", "12/11/2026")[0].due).toBe("2026-11-12");
  });
});
