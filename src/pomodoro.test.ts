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
let closeHandlers: ((event: { persisted: boolean }) => void)[];

const logged = () =>
  (JSON.parse(storage.get("focus-space-focus-log") ?? "[]") as { seconds: number; completed: boolean }[]).map(
    ({ seconds, completed }) => ({ seconds, completed }),
  );

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
  closeHandlers = [];
  vi.stubGlobal("window", {
    setInterval,
    clearInterval,
    addEventListener: (type: string, handler: (event: { persisted: boolean }) => void) => {
      if (type === "pagehide") closeHandlers.push(handler);
    },
  });
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

describe("focus log", () => {
  it("records a completed session at its full length", async () => {
    const timer = await freshTimer();
    timer.setPomodoroMinutes(2);
    timer.startPomodoro();
    vi.advanceTimersByTime(121_000);
    expect(logged()).toEqual([{ seconds: 120, completed: true }]);
  });

  it("records the time run as partial when reset after a minute or more", async () => {
    const timer = await freshTimer();
    timer.startPomodoro();
    vi.advanceTimersByTime(90_000);
    timer.resetPomodoro();
    expect(logged()).toEqual([{ seconds: 90, completed: false }]);
  });

  it("records nothing for a session under a minute", async () => {
    const timer = await freshTimer();
    timer.startPomodoro();
    vi.advanceTimersByTime(59_000);
    timer.resetPomodoro();
    expect(logged()).toEqual([]);
  });

  it("counts only the time run, not the time spent paused", async () => {
    const timer = await freshTimer();
    timer.startPomodoro();
    vi.advanceTimersByTime(120_000);
    timer.pausePomodoro();
    vi.advanceTimersByTime(300_000);
    timer.resetPomodoro();
    expect(logged()).toEqual([{ seconds: 120, completed: false }]);
  });

  it("records a session once when it is paused and resumed before finishing", async () => {
    const timer = await freshTimer();
    timer.setPomodoroMinutes(2);
    timer.startPomodoro();
    vi.advanceTimersByTime(30_000);
    timer.pausePomodoro();
    vi.advanceTimersByTime(60_000);
    timer.startPomodoro();
    vi.advanceTimersByTime(91_000);
    expect(logged()).toEqual([{ seconds: 120, completed: true }]);
  });

  it("records partial time when another length is chosen mid-session", async () => {
    const timer = await freshTimer();
    timer.startPomodoro();
    vi.advanceTimersByTime(75_000);
    timer.setPomodoroMinutes(15);
    expect(logged()).toEqual([{ seconds: 75, completed: false }]);
    timer.resetPomodoro();
    expect(logged()).toHaveLength(1);
  });

  it("records partial time when the tab is closed, but not when the page is only kept for later", async () => {
    const timer = await freshTimer();
    timer.startPomodoro();
    vi.advanceTimersByTime(100_000);
    closeHandlers.forEach((handler) => handler({ persisted: true }));
    expect(logged()).toEqual([]);
    closeHandlers.forEach((handler) => handler({ persisted: false }));
    expect(logged()).toEqual([{ seconds: 100, completed: false }]);
  });

  it("does not record a second time after a session was already recorded", async () => {
    const timer = await freshTimer();
    timer.setPomodoroMinutes(1);
    timer.startPomodoro();
    vi.advanceTimersByTime(61_000);
    timer.resetPomodoro();
    expect(logged()).toEqual([{ seconds: 60, completed: true }]);
  });
});
