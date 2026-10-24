import { describe, expect, it } from "vitest";
import { createHabit, setHabitNudge, toggleDay, loadHabits, type Habit } from "./habits";
import { EMPTY_NUDGES, dueNudges, loadNudges, pruneNudges, saveNudges } from "./nudges";

// Wednesday 15 October 2025.
const at = (hours: number, minutes = 0) => new Date(2025, 9, 15, hours, minutes);
const base = createHabit("Read", 4, "h1", at(8), 1);
const withNudge = (time: string, habit: Habit = base) => setHabitNudge([habit], "h1", time);

describe("due nudges", () => {
  it("fires once the nudge time has passed", () => {
    const lists = { f1: withNudge("09:00") };
    expect(dueNudges(lists, EMPTY_NUDGES, at(8, 59))).toEqual([]);
    expect(dueNudges(lists, EMPTY_NUDGES, at(9))).toEqual([
      { frameId: "f1", habitId: "h1", day: "2025-10-15", name: "Read", icon: undefined },
    ]);
  });

  it("does not fire again the same day, or for a habit done today", () => {
    const lists = { f1: withNudge("09:00") };
    expect(dueNudges(lists, { lastNudged: { h1: "2025-10-15" }, open: [] }, at(10))).toEqual([]);
    const done = { f1: toggleDay(lists.f1, "h1", "2025-10-15", at(10)) };
    expect(dueNudges(done, EMPTY_NUDGES, at(10))).toEqual([]);
  });

  it("fires again the next day, and skips archived habits and habits with no nudge", () => {
    const lists = { f1: withNudge("09:00") };
    expect(dueNudges(lists, { lastNudged: { h1: "2025-10-14" }, open: [] }, at(10))).toHaveLength(1);
    expect(dueNudges({ f1: [{ ...lists.f1[0], archived: true }] }, EMPTY_NUDGES, at(10))).toEqual([]);
    expect(dueNudges({ f1: [base] }, EMPTY_NUDGES, at(10))).toEqual([]);
  });
});

describe("open nudges", () => {
  const open = [{ frameId: "f1", habitId: "h1", day: "2025-10-15", name: "Read" }];

  it("stay until the habit is ticked for that day", () => {
    const lists = { f1: withNudge("09:00") };
    expect(pruneNudges(open, lists, at(10))).toEqual(open);
    expect(pruneNudges(open, { f1: toggleDay(lists.f1, "h1", "2025-10-15", at(10)) }, at(10))).toEqual([]);
  });

  it("go away when the habit is removed or the day is too old to tick", () => {
    expect(pruneNudges(open, { f1: [] }, at(10))).toEqual([]);
    expect(pruneNudges(open, { f1: withNudge("09:00") }, new Date(2025, 9, 20, 10))).toEqual([]);
  });
});

describe("saving", () => {
  it("round trips nudge state and a habit's nudge time", () => {
    let saved = "";
    saveNudges({ setItem: (_key, value) => (saved = value) }, { lastNudged: { h1: "2025-10-15" }, open: [] });
    expect(loadNudges({ getItem: () => saved }).lastNudged.h1).toBe("2025-10-15");
    expect(loadNudges({ getItem: () => "nope" })).toEqual(EMPTY_NUDGES);

    const raw = JSON.stringify({ f1: [withNudge("09:30")[0], { ...base, id: "h2", nudge: "25:99" }] });
    expect(loadHabits({ getItem: () => raw }).f1.map((habit) => habit.id)).toEqual(["h1"]);
  });

  it("clears a nudge with an empty time", () => {
    expect(setHabitNudge(withNudge("09:00"), "h1", "")[0].nudge).toBeUndefined();
  });
});
