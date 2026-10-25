import { describe, expect, it } from "vitest";
import { STACK_MAX_AGE_MS, isParked, markStacked, unstamped } from "./stack-expiry";
import type { WorkspaceFrame } from "./types";

const frame = (id: string, stackedAt?: number): WorkspaceFrame => ({
  id, feature: "todo list", title: id, eyebrow: "E", description: "D", details: [], ...(stackedAt === undefined ? {} : { stackedAt }),
});
const NOW = 10 * STACK_MAX_AGE_MS;

describe("parking", () => {
  it("hides a frame once it has been stacked for an hour, not before", () => {
    expect(isParked(frame("a", NOW - STACK_MAX_AGE_MS + 1), NOW)).toBe(false);
    expect(isParked(frame("a", NOW - STACK_MAX_AGE_MS), NOW)).toBe(true);
    expect(isParked(frame("a", NOW - 5 * STACK_MAX_AGE_MS), NOW)).toBe(true);
  });

  it("never hides a frame with no time recorded", () => {
    expect(isParked(frame("a"), NOW)).toBe(false);
  });
});

describe("marking frames as stacked", () => {
  it("starts the hour for the frame that left the main side and clears the active one", () => {
    const frames = [frame("a", 5), frame("b", 7), frame("c", 9)];
    const next = markStacked(frames, "b", "a", NOW);
    expect(next.find((entry) => entry.id === "a")?.stackedAt).toBe(NOW);
    expect(next.find((entry) => entry.id === "b")?.stackedAt).toBeUndefined();
    expect(next.find((entry) => entry.id === "c")?.stackedAt).toBe(9);
  });

  it("gives a frame with no time one, and keeps one it already has", () => {
    const next = markStacked([frame("a"), frame("b", 3)], "z", null, NOW);
    expect(next.map((entry) => entry.stackedAt)).toEqual([NOW, 3]);
  });

  it("returns the same list when nothing changes", () => {
    const frames = [frame("a"), frame("b", 3)];
    const once = markStacked(frames, "a", null, NOW);
    expect(markStacked(once, "a", null, NOW + 1)).toBe(once);
  });

  it("a frame promoted and stacked again gets a fresh hour", () => {
    const old = markStacked([frame("a", 1), frame("b")], "a", null, NOW);
    expect(old.find((entry) => entry.id === "a")?.stackedAt).toBeUndefined();
    const again = markStacked(old, "b", "a", NOW + 1000);
    expect(again.find((entry) => entry.id === "a")?.stackedAt).toBe(NOW + 1000);
  });

  it("removes the time from a restored frame", () => {
    expect(unstamped(frame("a", 5)).stackedAt).toBeUndefined();
  });
});
