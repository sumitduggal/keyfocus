import { describe, it, expect } from "vitest";
import {
  TODO_STORAGE_KEY,
  addTodoItem,
  createTodoItem,
  cyclePriority,
  deleteTodoItem,
  loadTodoLists,
  openTodoCount,
  parseTodoInput,
  saveTodoLists,
  toggleTodoItem,
  type TodoItem,
} from "./todo";

// Saturday, 24 October 2026
const TODAY = new Date(2026, 9, 24);

function makeItem(id: string, overrides: Partial<TodoItem> = {}): TodoItem {
  return { id, text: `task ${id}`, done: false, priority: "medium", due: null, parentId: null, ...overrides };
}

function fakeStorage(): Storage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  } as unknown as Storage & { map: Map<string, string> };
}

describe("parseTodoInput", () => {
  it("defaults priority to medium with no due date", () => {
    expect(parseTodoInput("buy milk", TODAY)).toEqual({
      text: "buy milk",
      priority: "medium",
      due: null,
    });
  });

  it.each([
    ["!high", "high"],
    ["!medium", "medium"],
    ["!low", "low"],
    ["!HIGH", "high"],
    ["!Low", "low"],
  ] as const)("recognises priority token %s", (token, priority) => {
    const result = parseTodoInput(`write report ${token}`, TODAY);
    expect(result.priority).toBe(priority);
    expect(result.text).toBe("write report");
  });

  it("uses the last priority token when several appear", () => {
    expect(parseTodoInput("task !high !low", TODAY).priority).toBe("low");
    expect(parseTodoInput("!low task !high", TODAY).priority).toBe("high");
  });

  it("maps @today to today", () => {
    expect(parseTodoInput("call @today", TODAY)).toEqual({
      text: "call",
      priority: "medium",
      due: "2026-10-24",
    });
  });

  it("maps @tomorrow to today plus one day", () => {
    expect(parseTodoInput("call @tomorrow", TODAY).due).toBe("2026-10-25");
  });

  it("maps @tomorrow across a month boundary", () => {
    expect(parseTodoInput("call @tomorrow", new Date(2026, 9, 31)).due).toBe("2026-11-01");
  });

  it("finds the next occurrence of a weekday", () => {
    expect(parseTodoInput("x @monday", TODAY).due).toBe("2026-10-26");
    expect(parseTodoInput("x @friday", TODAY).due).toBe("2026-10-30");
    expect(parseTodoInput("x @sunday", TODAY).due).toBe("2026-10-25");
  });

  it("counts today when the weekday matches", () => {
    // 24 October 2026 is a Saturday
    expect(parseTodoInput("x @saturday", TODAY).due).toBe("2026-10-24");
    expect(parseTodoInput("x @SATURDAY", TODAY).due).toBe("2026-10-24");
  });

  it("accepts every weekday name", () => {
    const names = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const dues = names.map((name) => parseTodoInput(`@${name}`, TODAY).due);
    expect(dues).toEqual([
      "2026-10-25",
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-24",
    ]);
  });

  it("parses a valid @YYYY-MM-DD date and removes the token", () => {
    expect(parseTodoInput("renew @2026-12-01", TODAY)).toEqual({
      text: "renew",
      priority: "medium",
      due: "2026-12-01",
    });
  });

  it("leaves an invalid @YYYY-MM-DD token in the text", () => {
    expect(parseTodoInput("renew @2026-02-30", TODAY)).toEqual({
      text: "renew @2026-02-30",
      priority: "medium",
      due: null,
    });
    expect(parseTodoInput("renew @2026-13-01", TODAY).due).toBeNull();
  });

  it("resolves @D Mon to the upcoming date in the current year", () => {
    expect(parseTodoInput("pay rent @12 Nov", TODAY)).toEqual({
      text: "pay rent",
      priority: "medium",
      due: "2026-11-12",
    });
  });

  it("accepts full English month names case-insensitively", () => {
    expect(parseTodoInput("pay rent @12 November", TODAY).due).toBe("2026-11-12");
    expect(parseTodoInput("pay rent @12 NOV", TODAY).due).toBe("2026-11-12");
  });

  it("counts today for @D Mon when the date matches", () => {
    expect(parseTodoInput("x @24 Oct", TODAY).due).toBe("2026-10-24");
  });

  it("rolls @D Mon into the next year when the date has passed", () => {
    expect(parseTodoInput("x @3 Oct", TODAY)).toEqual({
      text: "x",
      priority: "medium",
      due: "2027-10-03",
    });
    expect(parseTodoInput("x @1 January", TODAY).due).toBe("2027-01-01");
  });

  it("leaves @D Mon in the text when the day is invalid for the month", () => {
    expect(parseTodoInput("x @31 Feb", TODAY)).toEqual({
      text: "x @31 Feb",
      priority: "medium",
      due: null,
    });
  });

  it("leaves an unknown @token in the text unchanged", () => {
    expect(parseTodoInput("ping @alice about it", TODAY)).toEqual({
      text: "ping @alice about it",
      priority: "medium",
      due: null,
    });
  });

  it("collapses whitespace and trims the text", () => {
    expect(parseTodoInput("   plan    the   trip  !high   @today  ", TODAY)).toEqual({
      text: "plan the trip",
      priority: "high",
      due: "2026-10-24",
    });
  });

  it("returns empty text for input made only of tokens", () => {
    expect(parseTodoInput("  !low  @today ", TODAY)).toEqual({
      text: "",
      priority: "low",
      due: "2026-10-24",
    });
  });
});

describe("createTodoItem", () => {
  it("builds an open item from parsed input", () => {
    const parsed = parseTodoInput("ship it !high @tomorrow", TODAY);
    expect(createTodoItem(parsed, "t1")).toEqual({
      id: "t1",
      text: "ship it",
      done: false,
      priority: "high",
      due: "2026-10-25",
      parentId: null,
    });
  });
});

describe("addTodoItem", () => {
  it("appends a new item without mutating the input", () => {
    const items = [makeItem("a")];
    const snapshot = structuredClone(items);
    const next = addTodoItem(items, makeItem("b"));
    expect(next.map((item) => item.id)).toEqual(["a", "b"]);
    expect(items).toEqual(snapshot);
    expect(next).not.toBe(items);
  });

  it("does not add an item with empty text", () => {
    const items = [makeItem("a")];
    expect(addTodoItem(items, makeItem("b", { text: "" }))).toBe(items);
  });
});

describe("toggleTodoItem", () => {
  it("flips done for the matching item only", () => {
    const items = [makeItem("a"), makeItem("b", { done: true })];
    const next = toggleTodoItem(items, "a");
    expect(next[0].done).toBe(true);
    expect(next[1].done).toBe(true);
    expect(toggleTodoItem(next, "b")[1].done).toBe(false);
  });

  it("does not mutate the input items", () => {
    const items = [makeItem("a")];
    toggleTodoItem(items, "a");
    expect(items[0].done).toBe(false);
  });
});

describe("deleteTodoItem", () => {
  it("removes only the matching item", () => {
    const items = [makeItem("a"), makeItem("b"), makeItem("c")];
    const next = deleteTodoItem(items, "b");
    expect(next.map((item) => item.id)).toEqual(["a", "c"]);
    expect(items).toHaveLength(3);
  });
});

describe("cyclePriority", () => {
  it("cycles high -> medium -> low -> high for the matching item", () => {
    let items = [makeItem("a", { priority: "high" }), makeItem("b", { priority: "high" })];
    items = cyclePriority(items, "a");
    expect(items.map((item) => item.priority)).toEqual(["medium", "high"]);
    items = cyclePriority(items, "a");
    expect(items[0].priority).toBe("low");
    items = cyclePriority(items, "a");
    expect(items[0].priority).toBe("high");
  });

  it("does not mutate the input items", () => {
    const items = [makeItem("a", { priority: "high" })];
    cyclePriority(items, "a");
    expect(items[0].priority).toBe("high");
  });
});

describe("openTodoCount", () => {
  it("counts items that are not done", () => {
    expect(openTodoCount([])).toBe(0);
    expect(
      openTodoCount([makeItem("a"), makeItem("b", { done: true }), makeItem("c")]),
    ).toBe(2);
  });
});

describe("loadTodoLists", () => {
  it("returns an empty object when the key is missing", () => {
    expect(loadTodoLists(fakeStorage())).toEqual({});
  });

  it("returns an empty object for invalid JSON", () => {
    const storage = fakeStorage();
    storage.map.set(TODO_STORAGE_KEY, "{not json");
    expect(loadTodoLists(storage)).toEqual({});
  });

  it("returns an empty object for non-object JSON", () => {
    const storage = fakeStorage();
    storage.map.set(TODO_STORAGE_KEY, "[1, 2, 3]");
    expect(loadTodoLists(storage)).toEqual({});
  });

  it("returns the stored lists keyed by frame id", () => {
    const lists = {
      frameA: [makeItem("a1", { priority: "high", due: "2026-10-30" })],
      frameB: [],
    };
    const storage = fakeStorage();
    storage.map.set(TODO_STORAGE_KEY, JSON.stringify(lists));
    expect(loadTodoLists(storage)).toEqual(lists);
  });

  it("drops malformed items but keeps valid ones", () => {
    const storage = fakeStorage();
    storage.map.set(
      TODO_STORAGE_KEY,
      JSON.stringify({
        frameA: [makeItem("ok"), { id: 1, text: "bad" }, null],
        frameB: "not an array",
      }),
    );
    expect(loadTodoLists(storage)).toEqual({ frameA: [makeItem("ok")] });
  });

  it("returns an empty object when storage throws", () => {
    const storage = {
      getItem: () => {
        throw new Error("denied");
      },
    };
    expect(loadTodoLists(storage)).toEqual({});
  });
});

describe("saveTodoLists", () => {
  it("round-trips through storage", () => {
    const lists = {
      frameA: [makeItem("a", { due: "2026-11-12", priority: "low" }), makeItem("b", { done: true })],
      frameB: [makeItem("c")],
    };
    const storage = fakeStorage();
    saveTodoLists(storage, lists);
    expect(storage.map.has(TODO_STORAGE_KEY)).toBe(true);
    expect(loadTodoLists(storage)).toEqual(lists);
  });

  it("does not throw when storage fails", () => {
    const storage = {
      setItem: () => {
        throw new Error("quota exceeded");
      },
    };
    expect(() => saveTodoLists(storage, { frameA: [] })).not.toThrow();
  });
});
