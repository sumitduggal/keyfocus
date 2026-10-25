import { describe, expect, it } from "vitest";
import { frameSummary, type FrameData } from "./frame-summary";
import { createHabit, toggleDay } from "./habits";
import { createReminder } from "./reminders";
import type { WorkspaceFrame } from "./types";

const today = new Date(2025, 9, 15, 10, 0);
const frame = (feature: WorkspaceFrame["feature"], id = "f1"): WorkspaceFrame => ({
  id, feature, title: "T", eyebrow: "E", description: "Template copy", details: [],
});
const empty: FrameData = {
  todos: {}, habits: {}, reminders: {}, notes: {},
  library: { bookmarks: [], collections: [] },
  pomodoro: { durationMin: 25, remainingSec: 1500, phase: "idle" },
  today,
};
const todo = (text: string, done = false) => ({ id: text, text, done, priority: "medium" as const, due: null, parentId: null });

describe("frame summary", () => {
  it("shows the open todo count and the first open item", () => {
    const data = { ...empty, todos: { f1: [todo("Pay rent", true), todo("Send proposal"), todo("Call mum")] } };
    expect(frameSummary(frame("todo list"), data)).toBe("2 open · Send proposal");
    expect(frameSummary(frame("todo list"), { ...empty, todos: { f1: [todo("a", true)] } })).toBe("All done");
    expect(frameSummary(frame("todo list"), empty)).toBe("Empty list");
  });

  it("shows habits ticked today, ignoring archived ones", () => {
    const [read] = [createHabit("Read", 3, "h1", today, 1)];
    const ticked = toggleDay([read, { ...createHabit("Walk", 3, "h2", today, 1) }], "h1", "2025-10-15", today);
    const data = { ...empty, habits: { f1: [...ticked, { ...createHabit("Old", 1, "h3", today, 1), archived: true }] } };
    expect(frameSummary(frame("habits"), data)).toBe("1 of 2 habits done today");
    expect(frameSummary(frame("habits"), empty)).toBe("No habits yet");
  });

  it("shows reminder counts with the next one, or how many are overdue", () => {
    const next = createReminder({ text: "Call Alex", priority: "medium", due: "2025-10-16T09:00", repeat: null }, "r1");
    expect(frameSummary(frame("reminders"), { ...empty, reminders: { f1: { reminders: [next], done: [] } } })).toBe("1 reminder · next: Call Alex");
    const overdue = { ...next, id: "r2", firedAt: "2025-10-15T08:00" };
    expect(frameSummary(frame("reminders"), { ...empty, reminders: { f1: { reminders: [next, overdue], done: [] } } })).toBe("2 reminders · 1 overdue");
    expect(frameSummary(frame("reminders"), empty)).toBe("No reminders");
  });

  it("shows the first line of a note without markdown marks", () => {
    expect(frameSummary(frame("notes"), { ...empty, notes: { f1: "\n# Launch ideas\n\n- [ ] Capture" } })).toBe("Launch ideas");
    expect(frameSummary(frame("notes"), empty)).toBe("Empty note");
  });

  it("shows the timer state and the bookmark count", () => {
    const running = { ...empty, pomodoro: { durationMin: 25, remainingSec: 1125, phase: "running" as const } };
    expect(frameSummary(frame("pomodoro"), running)).toBe("18:45 left");
    expect(frameSummary(frame("pomodoro"), empty)).toBe("25 min timer");
    const bookmark = { id: "b", url: "https://x.test", title: "x", note: "", tags: [], collection: null, favorite: false, trashedAt: null, created: "", cover: null, favicon: null, highlights: [], remindAt: null, broken: null };
    const library = { bookmarks: [bookmark, { ...bookmark, id: "c" }, { ...bookmark, id: "d", trashedAt: "2025-10-14T00:00:00Z" }], collections: [] };
    expect(frameSummary(frame("bookmarks"), { ...empty, library })).toBe("2 bookmarks");
  });

  it("falls back to the description for a feature with no summary", () => {
    expect(frameSummary(frame("focus music"), empty)).toBe("Template copy");
  });
});
