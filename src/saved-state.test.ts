import { describe, expect, it } from "vitest";
import { FRAMES_KEY, NOTE_BODIES_KEY, THEME_KEY, initialFrame } from "./constants";
import { loadFrames, loadNoteBodies, loadTheme } from "./saved-state";

const storage = (values: Record<string, string>) => ({ getItem: (key: string) => values[key] ?? null });

describe("saved frames", () => {
  it("starts from the default frame when nothing is saved", () => {
    expect(loadFrames(storage({}))).toEqual([initialFrame]);
  });

  it("starts from the default frame when the saved list is empty, as after hidden frames are removed", () => {
    expect(loadFrames(storage({ [FRAMES_KEY]: "[]" }))).toEqual([initialFrame]);
  });

  it("starts from the default frame when the saved data is damaged or not a list", () => {
    for (const bad of ["{not json", "null", '"text"', '{"a":1}', "42"]) {
      expect(loadFrames(storage({ [FRAMES_KEY]: bad }))).toEqual([initialFrame]);
    }
  });

  it("keeps readable frames and drops the rest", () => {
    const saved = JSON.stringify([
      { id: "a", feature: "todo list", title: "Chores" },
      { id: 5, feature: "todo list" },
      { id: "b", feature: "no such feature" },
      null,
      { id: "c", title: "Old note" },
    ]);
    const frames = loadFrames(storage({ [FRAMES_KEY]: saved }));
    expect(frames.map((frame) => [frame.id, frame.feature, frame.title])).toEqual([
      ["a", "todo list", "Chores"],
      ["c", "notes", "Old note"],
    ]);
  });

  it("fills in fields an older save did not have", () => {
    const [frame] = loadFrames(storage({ [FRAMES_KEY]: JSON.stringify([{ id: "a", feature: "pomodoro" }]) }));
    expect(frame.eyebrow).toBe(initialFrame.eyebrow);
  });
});

describe("saved notes", () => {
  it("uses the starter note when nothing usable is saved", () => {
    for (const bad of [undefined, "{oops", "[]", "7"]) {
      const values: Record<string, string> = bad === undefined ? {} : { [NOTE_BODIES_KEY]: bad };
      expect(Object.keys(loadNoteBodies(storage(values)))).toEqual(["main"]);
    }
  });

  it("keeps text bodies and drops other values", () => {
    const saved = JSON.stringify({ a: "hello", b: 3, c: null });
    expect(loadNoteBodies(storage({ [NOTE_BODIES_KEY]: saved }))).toEqual({ a: "hello" });
  });
});

describe("saved theme", () => {
  it("accepts light and dark and falls back to dark", () => {
    expect(loadTheme(storage({ [THEME_KEY]: "light" }))).toBe("light");
    expect(loadTheme(storage({ [THEME_KEY]: "dark" }))).toBe("dark");
    expect(loadTheme(storage({ [THEME_KEY]: "foo" }))).toBe("dark");
    expect(loadTheme(storage({}))).toBe("dark");
  });
});
