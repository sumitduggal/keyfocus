import { describe, expect, it } from "vitest";
import {
  FOCUS_LOG_KEY,
  addEntry,
  averageSeconds,
  bestDay,
  dailySeries,
  focusHeatMap,
  formatDuration,
  loadFocusLog,
  saveFocusLog,
  totals,
  type FocusEntry,
} from "./focus-log";

// Wednesday 15 October 2025, 15:00.
const now = new Date(2025, 9, 15, 15, 0);
const at = (day: number, hour = 10) => new Date(2025, 9, day, hour, 0).getTime();
const done = (day: number, minutes: number): FocusEntry => ({ at: at(day), seconds: minutes * 60, completed: true });
const part = (day: number, minutes: number): FocusEntry => ({ at: at(day), seconds: minutes * 60, completed: false });

describe("totals", () => {
  const log = [done(15, 25), done(15, 25), part(15, 10), done(12, 25), part(10, 5), done(5, 25)];

  it("keeps completed and partial time apart, and counts completed sessions", () => {
    expect(totals(log, now).today).toEqual({ completedSeconds: 3000, partialSeconds: 600, sessions: 2 });
  });

  it("covers the last seven days including today, and all time", () => {
    const { week, all } = totals(log, now);
    expect(week).toEqual({ completedSeconds: 3000 + 1500, partialSeconds: 600 + 300, sessions: 3 });
    expect(all.sessions).toBe(4);
    expect(all.completedSeconds + all.partialSeconds).toBe(6000 + 900);
  });

  it("is zero for an empty log", () => {
    expect(totals([], now).all).toEqual({ completedSeconds: 0, partialSeconds: 0, sessions: 0 });
  });
});

describe("daily series", () => {
  it("returns every day in the range, oldest first, with empty days included", () => {
    const series = dailySeries([done(15, 25), part(13, 7)], now, 3);
    expect(series.map((day) => day.day)).toEqual(["2025-10-13", "2025-10-14", "2025-10-15"]);
    expect(series.map((day) => day.completedSeconds + day.partialSeconds)).toEqual([420, 0, 1500]);
  });

  it("finds the best day and the average", () => {
    const series = dailySeries([done(15, 25), part(13, 7)], now, 3);
    expect(bestDay(series)?.day).toBe("2025-10-15");
    expect(averageSeconds(series)).toBe(Math.round(1920 / 3));
    expect(bestDay(dailySeries([], now, 3))).toBeNull();
    expect(averageSeconds([])).toBe(0);
  });
});

describe("heat map", () => {
  it("lays out whole weeks ending with this one and adds up each day", () => {
    const weeks = focusHeatMap([done(14, 25), part(14, 5)], now, 2, 1);
    expect(weeks).toHaveLength(2);
    expect(weeks[1][1]).toEqual({ day: "2025-10-14", seconds: 1800, future: false });
    expect(weeks[1][3].future).toBe(true);
  });
});

describe("formatting", () => {
  it("writes minutes, hours and both, dropping seconds", () => {
    expect(formatDuration(0)).toBe("0 min");
    expect(formatDuration(59)).toBe("0 min");
    expect(formatDuration(45 * 60)).toBe("45 min");
    expect(formatDuration(60 * 60)).toBe("1 h");
    expect(formatDuration(145 * 60 + 30)).toBe("2 h 25 min");
  });
});

describe("saving", () => {
  it("round trips and drops damaged entries", () => {
    let saved = "";
    saveFocusLog({ setItem: (_key, value) => (saved = value) }, [done(15, 25), part(14, 3)]);
    expect(loadFocusLog({ getItem: () => saved })).toHaveLength(2);
    const raw = JSON.stringify([done(15, 25), { at: "x", seconds: 5, completed: true }, { at: 1, seconds: 0, completed: true }, null]);
    expect(loadFocusLog({ getItem: (key) => (key === FOCUS_LOG_KEY ? raw : null) })).toHaveLength(1);
    for (const bad of ["{oops", "null", '{"a":1}', '"x"']) expect(loadFocusLog({ getItem: () => bad })).toEqual([]);
    expect(loadFocusLog({ getItem: () => null })).toEqual([]);
  });

  it("keeps only the newest entries once the log is very long", () => {
    let log: FocusEntry[] = [];
    for (let index = 0; index < 5005; index++) log = addEntry(log, { at: index + 1, seconds: 60, completed: true });
    expect(log).toHaveLength(5000);
    expect(log[0].at).toBe(6);
  });
});
