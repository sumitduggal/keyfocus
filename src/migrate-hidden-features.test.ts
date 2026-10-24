import { describe, expect, it, vi } from "vitest";
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
    const download = vi.fn();

    migrateHiddenFeatures(storage, download, ["pomodoro"]);

    expect(JSON.parse(storage.read(FRAMES_KEY)!)).toEqual([frame("p1", "pomodoro")]);
    expect(download).toHaveBeenCalledTimes(1);
  });

  it("backs up removed frames and their note bodies before deleting", () => {
    const storage = fakeStorage({
      [FRAMES_KEY]: JSON.stringify([frame("n1", "notes")]),
      [NOTE_BODIES_KEY]: JSON.stringify({ n1: "# my note", other: "kept?" }),
    });
    const download = vi.fn();

    migrateHiddenFeatures(storage, download, ["pomodoro"]);

    const [filename, text] = download.mock.calls[0];
    expect(filename).toMatch(/^keyfocus-backup-.*\.json$/);
    expect(JSON.parse(text)).toEqual({
      removedFrames: [frame("n1", "notes")],
      removedNoteBodies: { n1: "# my note" },
    });
    expect(JSON.parse(storage.read(NOTE_BODIES_KEY)!)).toEqual({ other: "kept?" });
  });

  it("treats a frame with no feature as notes", () => {
    const storage = fakeStorage({ [FRAMES_KEY]: JSON.stringify([{ id: "old", title: "old" }]) });
    const download = vi.fn();

    migrateHiddenFeatures(storage, download, ["pomodoro"]);

    expect(JSON.parse(storage.read(FRAMES_KEY)!)).toEqual([]);
  });

  it("does nothing when there is nothing hidden, so it is safe to run every load", () => {
    const original = JSON.stringify([frame("p1", "pomodoro")]);
    const storage = fakeStorage({ [FRAMES_KEY]: original });
    const download = vi.fn();

    migrateHiddenFeatures(storage, download, ["pomodoro"]);

    expect(storage.read(FRAMES_KEY)).toBe(original);
    expect(download).not.toHaveBeenCalled();
  });

  it("does nothing on missing or corrupt data", () => {
    const download = vi.fn();
    migrateHiddenFeatures(fakeStorage({}), download, ["pomodoro"]);
    migrateHiddenFeatures(fakeStorage({ [FRAMES_KEY]: "{not json" }), download, ["pomodoro"]);
    expect(download).not.toHaveBeenCalled();
  });
});
