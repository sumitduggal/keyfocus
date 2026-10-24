import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHabit, setHabitNudge, type Habit } from "./habits";
import { REMINDERS_KEY, createReminder } from "./reminders";
import { NUDGES_KEY } from "./nudges";

// Stands in for the browser. Alerts only need Audio to exist.
class FakeAudio {
  volume = 1;
  constructor(public src: string) {}
  play() {
    return Promise.resolve();
  }
}

let storage: Map<string, string>;

async function freshStore() {
  vi.resetModules();
  return import("./reminders-store");
}

const oneOff = (id: string, due: string) => createReminder({ text: id, priority: "medium", due, repeat: null }, id);
const habit = (nudge: string): Habit => setHabitNudge([createHabit("Read", 3, "h1", new Date(2025, 9, 15), 1)], "h1", nudge)[0];

beforeEach(() => {
  storage = new Map();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2025, 9, 15, 8, 59, 0));
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => void storage.set(key, value),
  });
  vi.stubGlobal("window", { setInterval, addEventListener: () => {} });
  vi.stubGlobal("document", { hidden: false });
  vi.stubGlobal("Audio", FakeAudio);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("reminder scheduler", () => {
  it("shows reminders missed while closed as overdue, without a banner", async () => {
    storage.set(REMINDERS_KEY, JSON.stringify({ f1: { reminders: [oneOff("a", "2025-10-15T07:00")], done: [] } }));
    const store = await freshStore();
    store.initReminders();
    const state = store.getRemindersState();
    expect(state.lists.f1.reminders[0].firedAt).toBe("2025-10-15T07:00");
    expect(state.banner).toEqual([]);
  });

  it("alerts once when a reminder comes due while open", async () => {
    storage.set(REMINDERS_KEY, JSON.stringify({ f1: { reminders: [oneOff("a", "2025-10-15T09:00")], done: [] } }));
    const store = await freshStore();
    store.initReminders();
    expect(store.getRemindersState().banner).toEqual([]);
    vi.advanceTimersByTime(61_000);
    expect(store.getRemindersState().banner).toEqual([{ frameId: "f1", id: "a" }]);
    vi.advanceTimersByTime(5000);
    expect(store.getRemindersState().banner).toHaveLength(1);
  });

  it("clears a banner when its reminder is no longer overdue", async () => {
    storage.set(REMINDERS_KEY, JSON.stringify({ f1: { reminders: [oneOff("a", "2025-10-15T09:00")], done: [] } }));
    const store = await freshStore();
    store.initReminders();
    vi.advanceTimersByTime(61_000);
    store.updateReminders("f1", (data) => ({ ...data, reminders: [] }));
    vi.advanceTimersByTime(1000);
    expect(store.getRemindersState().banner).toEqual([]);
  });

  it("nudges once at the habit's time and clears when answered", async () => {
    const store = await freshStore();
    const tickHabit = vi.fn();
    store.initReminders();
    store.registerHabitSource({ get: () => ({ f1: [habit("09:00")] }), tick: tickHabit });
    expect(store.getRemindersState().nudges).toEqual([]);

    vi.advanceTimersByTime(61_000);
    const { nudges, banner } = store.getRemindersState();
    expect(nudges).toHaveLength(1);
    expect(banner).toEqual([{ frameId: "f1", id: "h1", nudge: true, day: "2025-10-15" }]);

    store.tickNudge(nudges[0]);
    expect(tickHabit).toHaveBeenCalledWith("f1", "h1", "2025-10-15");
    expect(store.getRemindersState().nudges).toEqual([]);
    vi.advanceTimersByTime(5000);
    expect(store.getRemindersState().nudges).toEqual([]);
  });

  it("keeps yesterday's missed nudge separate from today's banner", async () => {
    storage.set(
      NUDGES_KEY,
      JSON.stringify({ lastNudged: { h1: "2025-10-14" }, open: [{ frameId: "f1", habitId: "h1", day: "2025-10-14", name: "Read" }] }),
    );
    const store = await freshStore();
    store.initReminders();
    store.registerHabitSource({ get: () => ({ f1: [habit("09:00")] }), tick: () => {} });
    vi.advanceTimersByTime(61_000);
    const { nudges, banner } = store.getRemindersState();
    expect(nudges.map((nudge) => nudge.day)).toEqual(["2025-10-14", "2025-10-15"]);
    expect(banner).toEqual([{ frameId: "f1", id: "h1", nudge: true, day: "2025-10-15" }]);
  });
});
