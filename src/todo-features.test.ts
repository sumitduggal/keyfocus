import { describe, expect, it } from "vitest";
import {
  clearCompletedTodos,
  isOverdue,
  progressCounts,
  updateTodoText,
  type TodoItem,
} from "./todo";

const today = new Date(2026, 9, 24); // 24 October 2026

const item = (overrides: Partial<TodoItem> & { id: string }): TodoItem => ({
  text: "Task",
  done: false,
  priority: "medium",
  due: null,
  parentId: null,
  ...overrides,
});

describe("isOverdue", () => {
  it("is true for an open item due before today", () => {
    expect(isOverdue(item({ id: "a", due: "2026-10-23" }), today)).toBe(true);
  });

  it("is false for an item due today", () => {
    expect(isOverdue(item({ id: "a", due: "2026-10-24" }), today)).toBe(false);
  });

  it("is false for a done item even when its date has passed", () => {
    expect(isOverdue(item({ id: "a", due: "2026-10-01", done: true }), today)).toBe(false);
  });

  it("is false when there is no due date", () => {
    expect(isOverdue(item({ id: "a", due: null }), today)).toBe(false);
  });
});

describe("clearCompletedTodos", () => {
  it("removes every done item and keeps open ones in order", () => {
    const items = [item({ id: "a", done: true }), item({ id: "b" }), item({ id: "c", done: true })];
    expect(clearCompletedTodos(items).map((i) => i.id)).toEqual(["b"]);
  });

  it("removes nested items under a done parent", () => {
    const items = [
      item({ id: "p", done: true }),
      item({ id: "child", parentId: "p" }),
      item({ id: "other" }),
    ];
    expect(clearCompletedTodos(items).map((i) => i.id)).toEqual(["other"]);
  });

  it("does not mutate the input", () => {
    const items = [item({ id: "a", done: true })];
    clearCompletedTodos(items);
    expect(items).toHaveLength(1);
  });
});

describe("progressCounts", () => {
  it("counts done and total over all items, including nested steps", () => {
    const items = [
      item({ id: "a", done: true }),
      item({ id: "b", parentId: "a" }),
      item({ id: "c" }),
    ];
    expect(progressCounts(items)).toEqual({ done: 1, total: 3 });
  });

  it("is zero for an empty list", () => {
    expect(progressCounts([])).toEqual({ done: 0, total: 0 });
  });
});

describe("updateTodoText", () => {
  it("replaces the text of the matching item", () => {
    const items = [item({ id: "a", text: "Mlk" })];
    expect(updateTodoText(items, "a", "Milk")[0].text).toBe("Milk");
  });

  it("keeps the old text when the new text is blank", () => {
    const items = [item({ id: "a", text: "Milk" })];
    expect(updateTodoText(items, "a", "   ")[0].text).toBe("Milk");
  });
});

import {
  moveTodoItem,
  nestTodoItem,
  unnestTodoItem,
  visibleTodoGroups,
  loadTodoLists,
  TODO_STORAGE_KEY,
} from "./todo";

describe("moveTodoItem", () => {
  it("swaps an item with the previous sibling", () => {
    const items = [item({ id: "a" }), item({ id: "b" }), item({ id: "c" })];
    expect(moveTodoItem(items, "b", -1).map((i) => i.id)).toEqual(["b", "a", "c"]);
  });

  it("swaps an item with the next sibling", () => {
    const items = [item({ id: "a" }), item({ id: "b" }), item({ id: "c" })];
    expect(moveTodoItem(items, "b", 1).map((i) => i.id)).toEqual(["a", "c", "b"]);
  });

  it("does nothing at the edges", () => {
    const items = [item({ id: "a" }), item({ id: "b" })];
    expect(moveTodoItem(items, "a", -1).map((i) => i.id)).toEqual(["a", "b"]);
    expect(moveTodoItem(items, "b", 1).map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("only swaps with siblings under the same parent", () => {
    const items = [
      item({ id: "p1" }),
      item({ id: "s1", parentId: "p1" }),
      item({ id: "p2" }),
      item({ id: "s2", parentId: "p2" }),
    ];
    expect(moveTodoItem(items, "s2", -1).map((i) => i.id)).toEqual(["p1", "s1", "p2", "s2"]);
  });
});

describe("nestTodoItem and unnestTodoItem", () => {
  it("nests an item under the top-level item directly above it", () => {
    const items = [item({ id: "a" }), item({ id: "b" })];
    expect(nestTodoItem(items, "b")[1].parentId).toBe("a");
  });

  it("does nothing for the first item, which has nothing above it", () => {
    const items = [item({ id: "a" }), item({ id: "b" })];
    expect(nestTodoItem(items, "a")[0].parentId).toBeNull();
  });

  it("refuses to nest an item that already has steps under it", () => {
    const items = [item({ id: "a" }), item({ id: "b" }), item({ id: "c", parentId: "b" })];
    expect(nestTodoItem(items, "b")[1].parentId).toBeNull();
  });

  it("nests under the group of the step directly above it", () => {
    const items = [item({ id: "a" }), item({ id: "s", parentId: "a" }), item({ id: "b" })];
    expect(nestTodoItem(items, "b")[2].parentId).toBe("a");
  });

  it("nests in display order, so a step's group is the one shown above", () => {
    const items = [item({ id: "p" }), item({ id: "c", parentId: "p" }), item({ id: "q" })];
    expect(nestTodoItem(items, "q")[2].parentId).toBe("p");
  });

  it("un-nests a step back to the top level", () => {
    const items = [item({ id: "a" }), item({ id: "s", parentId: "a" })];
    expect(unnestTodoItem(items, "s")[1].parentId).toBeNull();
  });
});

describe("visibleTodoGroups", () => {
  const today = new Date(2026, 9, 24);
  const items = [
    item({ id: "a", priority: "low", due: "2026-10-30" }),
    item({ id: "a1", parentId: "a", due: "2026-10-22" }),
    item({ id: "b", priority: "high", due: null }),
    item({ id: "c", priority: "medium", due: "2026-10-25", done: true }),
  ];

  it("keeps manual order and includes every group with the all filter", () => {
    const groups = visibleTodoGroups(items, { filter: "all", sort: "manual" }, today);
    expect(groups.map((g) => g.parent.id)).toEqual(["a", "b", "c"]);
    expect(groups[0].children.map((i) => i.id)).toEqual(["a1"]);
  });

  it("sorts by priority, high first, ties in manual order", () => {
    const groups = visibleTodoGroups(items, { filter: "all", sort: "priority" }, today);
    expect(groups.map((g) => g.parent.id)).toEqual(["b", "c", "a"]);
  });

  it("sorts by due date, earliest first, undated last", () => {
    const groups = visibleTodoGroups(items, { filter: "all", sort: "due" }, today);
    expect(groups.map((g) => g.parent.id)).toEqual(["c", "a", "b"]);
  });

  it("filters to open items: a group shows if the parent or a step is open", () => {
    const groups = visibleTodoGroups(items, { filter: "open", sort: "manual" }, today);
    expect(groups.map((g) => g.parent.id)).toEqual(["a", "b"]);
  });

  it("filters to overdue items: a group shows if the parent or a step is overdue", () => {
    const groups = visibleTodoGroups(items, { filter: "overdue", sort: "manual" }, today);
    expect(groups.map((g) => g.parent.id)).toEqual(["a"]);
  });
});

describe("loadTodoLists with the parent field", () => {
  it("loads older items without a parent as top-level items", () => {
    const stored = JSON.stringify({
      f: [{ id: "a", text: "Old", done: false, priority: "medium", due: null }],
    });
    const storage = { getItem: (key: string) => (key === TODO_STORAGE_KEY ? stored : null) };
    expect(loadTodoLists(storage).f[0].parentId).toBeNull();
  });
});

import { deleteTodoItem } from "./todo";

describe("deleteTodoItem with steps", () => {
  it("removes an item's steps along with it", () => {
    const items = [item({ id: "p" }), item({ id: "s", parentId: "p" }), item({ id: "o" })];
    expect(deleteTodoItem(items, "p").map((i) => i.id)).toEqual(["o"]);
  });
});


import { restoreTodoItems } from "./todo";

describe("restoreTodoItems", () => {
  it("puts back removed items in their old order and keeps items added since", () => {
    const previous = [item({ id: "a" }), item({ id: "b" }), item({ id: "c" })];
    const current = [item({ id: "a" }), item({ id: "new" })];
    expect(restoreTodoItems(current, previous).map((i) => i.id)).toEqual(["a", "b", "c", "new"]);
  });

  it("keeps the current version of items that still exist", () => {
    const previous = [item({ id: "a", text: "old" })];
    const current = [item({ id: "a", text: "edited" })];
    expect(restoreTodoItems(current, previous)[0].text).toBe("edited");
  });
});

describe("loadTodoLists with steps of steps", () => {
  it("treats a parent that is itself a step as top-level", () => {
    const stored = JSON.stringify({
      f: [
        { id: "a", text: "A", done: false, priority: "medium", due: null },
        { id: "b", text: "B", done: false, priority: "medium", due: null, parentId: "a" },
        { id: "c", text: "C", done: false, priority: "medium", due: null, parentId: "b" },
      ],
    });
    const storage = { getItem: (key: string) => (key === TODO_STORAGE_KEY ? stored : null) };
    const items = loadTodoLists(storage).f;
    expect(items.find((i) => i.id === "c")!.parentId).toBeNull();
    expect(items.find((i) => i.id === "b")!.parentId).toBe("a");
  });
});
