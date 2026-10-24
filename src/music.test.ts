import { describe, expect, it } from "vitest";
import {
  DEFAULT_MUSIC_SETTINGS,
  MUSIC_SETTINGS_KEY,
  loadMusicSettings,
  nextTrackIndex,
  parseTrackList,
  previousTrackIndex,
  saveMusicSettings,
} from "./music";

const fakeStorage = (initial: Record<string, string> = {}) => {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    read: (key: string) => data.get(key),
  };
};

describe("loadMusicSettings", () => {
  it("returns defaults when nothing is saved", () => {
    expect(loadMusicSettings(fakeStorage())).toEqual(DEFAULT_MUSIC_SETTINGS);
  });

  it("returns defaults for corrupt JSON", () => {
    expect(loadMusicSettings(fakeStorage({ [MUSIC_SETTINGS_KEY]: "{bad" }))).toEqual(DEFAULT_MUSIC_SETTINGS);
  });

  it("keeps valid saved values", () => {
    const stored = JSON.stringify({ sound: "rain", soundVolume: 0.4, trackIndex: 2, trackVolume: 0.7, loop: true });
    expect(loadMusicSettings(fakeStorage({ [MUSIC_SETTINGS_KEY]: stored }))).toEqual({
      sound: "rain",
      soundVolume: 0.4,
      trackIndex: 2,
      trackVolume: 0.7,
      loop: true,
    });
  });

  it("replaces unknown sounds and clamps out-of-range volumes and indexes", () => {
    const stored = JSON.stringify({ sound: "laser", soundVolume: 3, trackIndex: -4, trackVolume: -1, loop: "yes" });
    expect(loadMusicSettings(fakeStorage({ [MUSIC_SETTINGS_KEY]: stored }))).toEqual({
      ...DEFAULT_MUSIC_SETTINGS,
      soundVolume: 1,
      trackIndex: 0,
      trackVolume: 0,
    });
  });
});

describe("saveMusicSettings", () => {
  it("round-trips through storage", () => {
    const storage = fakeStorage();
    const settings = { ...DEFAULT_MUSIC_SETTINGS, sound: "brown" as const, loop: true };
    saveMusicSettings(storage, settings);
    expect(loadMusicSettings(storage)).toEqual(settings);
  });
});

describe("parseTrackList", () => {
  it("reads titles and files in order", () => {
    const json = { tracks: [{ file: "a.mp3", title: "Deep work mix" }, { file: "b.mp3", title: "Ambient room" }] };
    expect(parseTrackList(json)).toEqual([
      { file: "a.mp3", title: "Deep work mix" },
      { file: "b.mp3", title: "Ambient room" },
    ]);
  });

  it("drops entries without a file or title", () => {
    const json = { tracks: [{ file: "a.mp3" }, { title: "No file" }, { file: "b.mp3", title: "Kept" }] };
    expect(parseTrackList(json)).toEqual([{ file: "b.mp3", title: "Kept" }]);
  });

  it("returns an empty list for anything that is not a track list", () => {
    expect(parseTrackList(null)).toEqual([]);
    expect(parseTrackList({ tracks: "nope" })).toEqual([]);
  });
});

describe("track navigation", () => {
  it("moves forward and wraps to the start", () => {
    expect(nextTrackIndex(0, 3)).toBe(1);
    expect(nextTrackIndex(2, 3)).toBe(0);
  });

  it("moves back and wraps to the end", () => {
    expect(previousTrackIndex(1, 3)).toBe(0);
    expect(previousTrackIndex(0, 3)).toBe(2);
  });

  it("stays at zero when there are no tracks", () => {
    expect(nextTrackIndex(0, 0)).toBe(0);
    expect(previousTrackIndex(0, 0)).toBe(0);
  });
});
