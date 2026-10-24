import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Stands in for the browser's audio element and records what the player does to it.
class FakeAudio {
  static instances: FakeAudio[] = [];
  paused = true;
  currentTime = 0;
  volume = 1;
  loop = false;
  preload = "";
  error = null;
  onended: (() => void) | null = null;
  dataset: Record<string, string> = {};
  listeners: Record<string, () => void> = {};
  removed = false;

  constructor(public src: string) {
    FakeAudio.instances.push(this);
  }
  play() {
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
  load() {}
  removeAttribute(name: string) {
    if (name === "src") this.removed = true;
  }
  addEventListener(type: string, listener: () => void) {
    this.listeners[type] = listener;
  }
}

async function freshPlayer() {
  vi.resetModules();
  const player = await import("./music-player");
  player.initMusic();
  return player;
}

beforeEach(() => {
  FakeAudio.instances = [];
  vi.stubGlobal("Audio", FakeAudio);
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {} });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("music player", () => {
  it("plays a short preview first, then hands over to the full file at the same point", async () => {
    const player = await freshPlayer();
    player.selectTrack(1);
    const file = player.getMusicState().tracks[1].file;
    const [preview, full] = FakeAudio.instances;

    expect(preview.src).toBe(`/previews/music/${file}`);
    expect(full.src).toBe(`/music/${file}`);
    expect(player.getMusicState().playing).toBe(true);

    preview.currentTime = 4;
    full.listeners.canplaythrough();

    expect(full.currentTime).toBe(4);
    expect(full.paused).toBe(false);
    expect(preview.paused).toBe(true);
    expect(player.getMusicState().playing).toBe(true);
  });

  it("deselecting a track stops it and drops its downloads", async () => {
    const player = await freshPlayer();
    player.selectTrack(0);
    const [preview, full] = FakeAudio.instances;

    player.deselectTrack();

    expect(player.getMusicState().trackIndex).toBe(-1);
    expect(player.getMusicState().playing).toBe(false);
    expect(preview.removed).toBe(true);
    expect(full.removed).toBe(true);
  });

  it("does nothing on play when no track or sound is selected", async () => {
    const player = await freshPlayer();
    player.deselectTrack();

    player.play();

    expect(player.getMusicState().playing).toBe(false);
    expect(FakeAudio.instances).toHaveLength(0);
  });
});
