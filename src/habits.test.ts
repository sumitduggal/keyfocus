import { describe, expect, it } from "vitest";
import {
  addDays,
  archiveHabit,
  bestWeek,
  canTick,
  createHabit,
  heatMap,
  loadHabits,
  nextWeekTarget,
  saveHabits,
  setHabitIcon,
  setHabitTarget,
  toggleDay,
  weekProgress,
  weekStart,
  type Habit,
} from "./habits";

const MONDAY = 1;
const SUNDAY = 0;
// Wednesday 15 October 2025.
const today = new Date(2025, 9, 15);

function habit(overrides: Partial<Habit> = {}): Habit {
  return { ...createHabit("Read", 4, "h1", today, MONDAY), ...overrides };
}

describe("weeks", () => {
  it("starts the week on the chosen day", () => {
    expect(weekStart("2025-10-15", MONDAY)).toBe("2025-10-13");
    expect(weekStart("2025-10-15", SUNDAY)).toBe("2025-10-12");
    expect(weekStart("2025-10-13", MONDAY)).toBe("2025-10-13");
  });

  it("adds days across a month end", () => {
    expect(addDays("2025-10-31", 1)).toBe("2025-11-01");
    expect(addDays("2025-03-01", -1)).toBe("2025-02-28");
  });
});

describe("ticking", () => {
  it("ticks and unticks today", () => {
    const once = toggleDay([habit()], "h1", "2025-10-15", today);
    expect(once[0].done).toEqual(["2025-10-15"]);
    expect(toggleDay(once, "h1", "2025-10-15", today)[0].done).toEqual([]);
  });

  it("allows today and two days back only", () => {
    expect(canTick("2025-10-13", today)).toBe(true);
    expect(canTick("2025-10-12", today)).toBe(false);
    expect(canTick("2025-10-16", today)).toBe(false);
    const habits = [habit()];
    expect(toggleDay(habits, "h1", "2025-10-12", today)).toBe(habits);
  });
});

describe("progress", () => {
  it("counts this week against the target", () => {
    let habits = [habit()];
    habits = toggleDay(habits, "h1", "2025-10-13", today);
    habits = toggleDay(habits, "h1", "2025-10-15", today);
    expect(weekProgress(habits[0], today, MONDAY)).toEqual({ count: 2, target: 4 });
  });

  it("finds the best week and ignores misses", () => {
    const done = ["2025-09-29", "2025-09-30", "2025-10-01", "2025-10-13"];
    expect(bestWeek(habit({ done }), MONDAY)).toBe(3);
    expect(bestWeek(habit(), MONDAY)).toBe(0);
  });

  it("a week below target changes nothing about the target", () => {
    expect(nextWeekTarget(habit({ done: ["2025-09-29"] }))).toBe(4);
  });
});

describe("target changes", () => {
  it("applies from this week and keeps earlier weeks", () => {
    const old = habit({ targets: [{ since: "2025-09-29", target: 3 }] });
    const [changed] = setHabitTarget([old], "h1", 5, today, MONDAY);
    expect(changed.targets).toEqual([
      { since: "2025-09-29", target: 3 },
      { since: "2025-10-13", target: 5 },
    ]);
    expect(weekProgress(changed, today, MONDAY).target).toBe(5);
    expect(weekProgress(changed, new Date(2025, 9, 1), MONDAY).target).toBe(3);
  });

  it("keeps the target between 1 and 7", () => {
    expect(setHabitTarget([habit()], "h1", 99, today, MONDAY)[0].targets.at(-1)?.target).toBe(7);
    expect(setHabitTarget([habit()], "h1", 0, today, MONDAY)[0].targets.at(-1)?.target).toBe(1);
  });
});

describe("heat map", () => {
  it("returns whole weeks ending with this one, marking done and future days", () => {
    const weeks = heatMap(habit({ done: ["2025-10-14"] }), today, MONDAY, 2);
    expect(weeks).toHaveLength(2);
    expect(weeks[0][0].day).toBe("2025-10-06");
    expect(weeks[1][1]).toEqual({ day: "2025-10-14", done: true, future: false });
    expect(weeks[1][3].future).toBe(true);
  });
});

describe("storage", () => {
  it("round trips and drops malformed habits", () => {
    let saved = "";
    saveHabits({ setItem: (_key, value) => (saved = value) }, { f1: [habit()] });
    expect(loadHabits({ getItem: () => saved }).f1).toHaveLength(1);

    const broken = JSON.stringify({ f1: [habit(), { id: 1 }], f2: "x" });
    const loaded = loadHabits({ getItem: () => broken });
    expect(loaded.f1).toHaveLength(1);
    expect(loaded.f2).toBeUndefined();
    expect(loadHabits({ getItem: () => "nope" })).toEqual({});
  });

  it("keeps a chosen icon and ignores a bad one when loading", () => {
    const [withIcon] = setHabitIcon([habit()], "h1", "★");
    expect(withIcon.icon).toBe("★");
    const raw = JSON.stringify({ f1: [withIcon, { ...habit({ id: "h2" }), icon: 5 }] });
    expect(loadHabits({ getItem: () => raw }).f1.map((entry) => entry.id)).toEqual(["h1"]);
  });

  it("archives a habit", () => {
    expect(archiveHabit([habit()], "h1", true)[0].archived).toBe(true);
  });
});
