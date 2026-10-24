export const MUSIC_SETTINGS_KEY = "focus-space-music";

export const BUILT_IN_SOUNDS = [
  { id: "rain", label: "Rain" },
  { id: "brown", label: "Brown noise" },
  { id: "white", label: "White noise" },
  { id: "cafe", label: "Café murmur" },
] as const;

export type SoundId = (typeof BUILT_IN_SOUNDS)[number]["id"];

export interface MusicSettings {
  sound: SoundId | null; // null means no built-in sound
  soundVolume: number; // 0 to 1
  trackIndex: number;
  trackVolume: number; // 0 to 1
  loop: boolean;
}

export interface Track {
  file: string;
  title: string;
}

export const DEFAULT_MUSIC_SETTINGS: MusicSettings = {
  sound: null,
  soundVolume: 0.5,
  trackIndex: 0,
  trackVolume: 0.8,
  loop: false,
};

const SOUND_IDS: string[] = BUILT_IN_SOUNDS.map((sound) => sound.id);

const clamp = (value: unknown, fallback: number, min: number, max: number) =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

// Saved settings are checked piece by piece, so one bad value does not discard the rest.
export function loadMusicSettings(storage: Pick<Storage, "getItem">): MusicSettings {
  try {
    const raw = storage.getItem(MUSIC_SETTINGS_KEY);
    if (raw === null) return { ...DEFAULT_MUSIC_SETTINGS };
    const saved = JSON.parse(raw) as Partial<Record<keyof MusicSettings, unknown>>;
    const sound = typeof saved.sound === "string" && SOUND_IDS.includes(saved.sound) ? (saved.sound as SoundId) : null;
    return {
      sound,
      soundVolume: clamp(saved.soundVolume, DEFAULT_MUSIC_SETTINGS.soundVolume, 0, 1),
      trackIndex: Math.round(clamp(saved.trackIndex, 0, 0, Number.MAX_SAFE_INTEGER)),
      trackVolume: clamp(saved.trackVolume, DEFAULT_MUSIC_SETTINGS.trackVolume, 0, 1),
      loop: typeof saved.loop === "boolean" ? saved.loop : DEFAULT_MUSIC_SETTINGS.loop,
    };
  } catch {
    return { ...DEFAULT_MUSIC_SETTINGS };
  }
}

export function saveMusicSettings(storage: Pick<Storage, "setItem">, settings: MusicSettings): void {
  try {
    storage.setItem(MUSIC_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Storage can be full or blocked; the settings simply reset on reload.
  }
}

// Reads the track list file. Entries without a file or title are skipped.
export function parseTrackList(json: unknown): Track[] {
  if (typeof json !== "object" || json === null) return [];
  const tracks = (json as { tracks?: unknown }).tracks;
  if (!Array.isArray(tracks)) return [];
  return tracks.flatMap((entry): Track[] => {
    const { file, title } = (entry ?? {}) as Partial<Record<keyof Track, unknown>>;
    return typeof file === "string" && file !== "" && typeof title === "string" && title !== ""
      ? [{ file, title }]
      : [];
  });
}

export function nextTrackIndex(current: number, count: number): number {
  return count === 0 ? 0 : (current + 1) % count;
}

export function previousTrackIndex(current: number, count: number): number {
  return count === 0 ? 0 : (current - 1 + count) % count;
}
