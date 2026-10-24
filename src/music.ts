export const MUSIC_SETTINGS_KEY = "focus-space-music";

// Built-in sounds are audio files in public/sounds, looped under a track.
export const BUILT_IN_SOUNDS = [
  { id: "rain", label: "Rain", file: "rain.mp3" },
  { id: "thunder", label: "Thunder", file: "thunder.mp3" },
  { id: "chirping", label: "Chirping", file: "chirping.mp3" },
] as const;

export type SoundId = (typeof BUILT_IN_SOUNDS)[number]["id"];

export interface MusicSettings {
  sounds: SoundId[]; // any number of built-in sounds, layered together; empty means none
  soundVolume: number; // 0 to 1
  trackIndex: number; // -1 when no track is selected
  trackVolume: number; // 0 to 1
  loop: boolean;
}

export interface Track {
  file: string;
  title: string;
}

export const DEFAULT_MUSIC_SETTINGS: MusicSettings = {
  sounds: [],
  soundVolume: 0.5,
  trackIndex: 0,
  trackVolume: 0.8,
  loop: false,
};

const clamp = (value: unknown, fallback: number, min: number, max: number) =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

// Saved settings are checked piece by piece, so one bad value does not discard the rest.
export function loadMusicSettings(storage: Pick<Storage, "getItem">): MusicSettings {
  try {
    const raw = storage.getItem(MUSIC_SETTINGS_KEY);
    if (raw === null) return { ...DEFAULT_MUSIC_SETTINGS };
    const saved = JSON.parse(raw) as Partial<Record<keyof MusicSettings, unknown>>;
    // The built-in sound layer is never remembered: every visit starts with no sounds selected.
    return {
      sounds: [],
      soundVolume: clamp(saved.soundVolume, DEFAULT_MUSIC_SETTINGS.soundVolume, 0, 1),
      trackIndex: Math.round(clamp(saved.trackIndex, 0, -1, Number.MAX_SAFE_INTEGER)),
      trackVolume: clamp(saved.trackVolume, DEFAULT_MUSIC_SETTINGS.trackVolume, 0, 1),
      loop: typeof saved.loop === "boolean" ? saved.loop : DEFAULT_MUSIC_SETTINGS.loop,
    };
  } catch {
    return { ...DEFAULT_MUSIC_SETTINGS };
  }
}

export function saveMusicSettings(storage: Pick<Storage, "setItem">, settings: MusicSettings): void {
  try {
    // Volumes, last track and loop are remembered; the sound layer is not.
    storage.setItem(MUSIC_SETTINGS_KEY, JSON.stringify({ ...settings, sounds: [] }));
  } catch {
    // Storage can be full or blocked; the settings simply reset on reload.
  }
}

export function nextTrackIndex(current: number, count: number): number {
  return count === 0 ? 0 : (current + 1) % count;
}

// -1 means no track is selected; previous then goes to the last track.
export function previousTrackIndex(current: number, count: number): number {
  return count === 0 ? 0 : (Math.max(current, 0) - 1 + count) % count;
}
