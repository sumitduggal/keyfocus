import type { Feature, WorkspaceFrame } from "./types";
import { visibleFeatures } from "./constants";

export const FRAMES_KEY = "focus-space-frames";
export const NOTE_BODIES_KEY = "focus-space-note-bodies";

// Frames saved for a feature that is no longer visible are removed, along with their note bodies.
export function migrateHiddenFeatures(
  storage: Pick<Storage, "getItem" | "setItem">,
  visible: Feature[] = visibleFeatures,
): void {
  const frames = parseJson<Partial<WorkspaceFrame>[]>(storage.getItem(FRAMES_KEY), []);
  const featureOf = (frame: Partial<WorkspaceFrame>) => frame.feature ?? "notes";
  const removed = frames.filter((frame) => !visible.includes(featureOf(frame)));
  if (removed.length === 0) return;

  const removedIds = new Set(removed.map((frame) => frame.id));
  const noteBodies = parseJson<Record<string, string>>(storage.getItem(NOTE_BODIES_KEY), {});
  const keptBodies = Object.fromEntries(
    Object.entries(noteBodies).filter(([id]) => !removedIds.has(id)),
  );

  storage.setItem(
    FRAMES_KEY,
    JSON.stringify(frames.filter((frame) => !removedIds.has(frame.id ?? ""))),
  );
  storage.setItem(NOTE_BODIES_KEY, JSON.stringify(keptBodies));
}

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
