import type { Feature, WorkspaceFrame } from "./types";
import { visibleFeatures } from "./constants";

export const FRAMES_KEY = "focus-space-frames";
export const NOTE_BODIES_KEY = "focus-space-note-bodies";

type Download = (filename: string, text: string) => void;

// Frames saved before a feature was hidden are removed once. A backup of the removed frames and
// note bodies is handed to `download` first, so the data can be recovered.
export function migrateHiddenFeatures(
  storage: Pick<Storage, "getItem" | "setItem">,
  download: Download,
  visible: Feature[] = visibleFeatures,
): void {
  const frames = parseJson<Partial<WorkspaceFrame>[]>(storage.getItem(FRAMES_KEY), []);
  const featureOf = (frame: Partial<WorkspaceFrame>) => frame.feature ?? "notes";
  const removed = frames.filter((frame) => !visible.includes(featureOf(frame)));
  if (removed.length === 0) return;

  const removedIds = new Set(removed.map((frame) => frame.id));
  const noteBodies = parseJson<Record<string, string>>(storage.getItem(NOTE_BODIES_KEY), {});
  const removedBodies = Object.fromEntries(
    Object.entries(noteBodies).filter(([id]) => removedIds.has(id)),
  );
  const keptBodies = Object.fromEntries(
    Object.entries(noteBodies).filter(([id]) => !removedIds.has(id)),
  );

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  download(
    `keyfocus-backup-${stamp}.json`,
    JSON.stringify({ removedFrames: removed, removedNoteBodies: removedBodies }, null, 2),
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

export function downloadTextFile(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
