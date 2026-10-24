import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class FakeAudio {
  static played = 0;
  volume = 1;
  constructor(public src: string) {}
  play() {
    FakeAudio.played++;
    return Promise.resolve();
  }
}

let storage: Map<string, string>;

async function freshTimer() {
  vi.resetModules();
  return import("./pomodoro");
}

beforeEach(() => {
  storage = new Map();
  FakeAudio.played = 0;
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2025, 9, 15, 10, 0, 0));
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => void storage.set(key, value),
  });
  vi.stubGlobal("window", { setInterval, clearInterval });
  vi.stubGlobal("document", { hidden: false });
  vi.stubGlobal("Audio", FakeAudio);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("pomodoro timer", () => {
  it("starts idle at the saved length, or 25 minutes", async () => {
    const timer = await freshTimer();
    expect(timer.getPomodoroState()).toEqual({ durationMin: 25, remainingSec: 1500, phase: "idle" });
    storage.set("focus-space-pomodoro-duration", "40");
    expect((await freshTimer()).getPomodoroState().durationMin).toBe(40);
    storage.set("focus-space-pomodoro-duration", "9999");
    expect((await freshTimer()).getPomodoroState().durationMin).toBe(180);
  });

  it("counts down while running and pauses where it was", async () => {
    const timer = await freshTimer();
    timer.startPomodoro();
    expect(timer.getPomodoroState().phase).toBe("running");
    vi.advanceTimersByTime(61_000);
    expect(timer.getPomodoroState().remainingSec).toBe(1439);
    timer.pausePomodoro();
    vi.advanceTimersByTime(30_000);
    expect(timer.getPomodoroState()).toMatchObject({ phase: "paused", remainingSec: 1439 });
    timer.startPomodoro();
    vi.advanceTimersByTime(10_000);
    expect(timer.getPomodoroState().remainingSec).toBe(1429);
  });

  it("stays right when ticks are late, as in a background tab", async () => {
    const timer = await freshTimer();
    timer.startPomodoro();
    vi.setSystemTime(new Date(2025, 9, 15, 10, 5, 0));
    vi.advanceTimersByTime(250);
    expect(timer.getPomodoroState().remainingSec).toBe(1200);
  });

  it("completes once, plays the alert, and stops ticking", async () => {
    const timer = await freshTimer();
    timer.setPomodoroMinutes(1);
    timer.startPomodoro();
    vi.advanceTimersByTime(59_000);
    expect(timer.getPomodoroState().phase).toBe("running");
    vi.advanceTimersByTime(2_000);
    expect(timer.getPomodoroState()).toMatchObject({ phase: "complete", remainingSec: 0 });
    vi.advanceTimersByTime(10_000);
    expect(FakeAudio.played).toBe(1);
  });

  it("starts a finished timer again from the full length", async () => {
    const timer = await freshTimer();
    timer.setPomodoroMinutes(1);
    timer.startPomodoro();
    vi.advanceTimersByTime(61_000);
    timer.startPomodoro();
    expect(timer.getPomodoroState()).toMatchObject({ phase: "running", remainingSec: 60 });
  });

  it("resets, and choosing a length stops the timer, saves it and keeps it between 1 and 180", async () => {
    const timer = await freshTimer();
    timer.startPomodoro();
    vi.advanceTimersByTime(5_000);
    timer.resetPomodoro();
    expect(timer.getPomodoroState()).toEqual({ durationMin: 25, remainingSec: 1500, phase: "idle" });
    timer.setPomodoroMinutes(15);
    expect(storage.get("focus-space-pomodoro-duration")).toBe("15");
    timer.setPomodoroMinutes(500);
    expect(timer.getPomodoroState().durationMin).toBe(180);
    timer.setPomodoroMinutes(0);
    expect(timer.getPomodoroState().durationMin).toBe(1);
  });

  it("formats the clock", async () => {
    const timer = await freshTimer();
    expect(timer.formatClock(1125)).toBe("18:45");
    expect(timer.formatClock(0)).toBe("00:00");
    expect(timer.formatClock(3600)).toBe("60:00");
  });
});
