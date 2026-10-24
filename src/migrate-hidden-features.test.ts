import { describe, expect, it } from "vitest";
import { FRAMES_KEY, NOTE_BODIES_KEY, migrateHiddenFeatures } from "./migrate-hidden-features";

function fakeStorage(initial: Record<string, string>) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    read: (key: string) => data.get(key),
  };
}

const frame = (id: string, feature: string) => ({ id, feature, title: id });

describe("migrateHiddenFeatures", () => {
  it("removes frames for hidden features and keeps visible ones", () => {
    const storage = fakeStorage({
      [FRAMES_KEY]: JSON.stringify([frame("n1", "notes"), frame("p1", "pomodoro")]),
    });

    migrateHiddenFeatures(storage, ["pomodoro"]);

    expect(JSON.parse(storage.read(FRAMES_KEY)!)).toEqual([frame("p1", "pomodoro")]);
  });

  it("removes the note bodies of removed frames and keeps the rest", () => {
    const storage = fakeStorage({
      [FRAMES_KEY]: JSON.stringify([frame("n1", "notes")]),
      [NOTE_BODIES_KEY]: JSON.stringify({ n1: "# my note", other: "kept" }),
    });

    migrateHiddenFeatures(storage, ["pomodoro"]);

    expect(JSON.parse(storage.read(NOTE_BODIES_KEY)!)).toEqual({ other: "kept" });
  });

  it("treats a frame with no feature as notes", () => {
    const storage = fakeStorage({ [FRAMES_KEY]: JSON.stringify([{ id: "old", title: "old" }]) });

    migrateHiddenFeatures(storage, ["pomodoro"]);

    expect(JSON.parse(storage.read(FRAMES_KEY)!)).toEqual([]);
  });

  it("does nothing when there is nothing hidden, so it is safe to run every load", () => {
    const original = JSON.stringify([frame("p1", "pomodoro")]);
    const storage = fakeStorage({ [FRAMES_KEY]: original });

    migrateHiddenFeatures(storage, ["pomodoro"]);

    expect(storage.read(FRAMES_KEY)).toBe(original);
  });

  it("does nothing on missing or corrupt data", () => {
    expect(() => migrateHiddenFeatures(fakeStorage({}), ["pomodoro"])).not.toThrow();
    const corrupt = fakeStorage({ [FRAMES_KEY]: "{not json" });
    migrateHiddenFeatures(corrupt, ["pomodoro"]);
    expect(corrupt.read(FRAMES_KEY)).toBe("{not json");
  });
});
