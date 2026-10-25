// What the app starts from. Anything saved that is missing, empty or damaged falls back to the
// defaults, so a bad value never stops the first screen from drawing.
import { FRAMES_KEY, NOTE_BODIES_KEY, THEME_KEY, featureMeta, initialFrame } from "./constants";
import type { Feature, Theme, WorkspaceFrame } from "./types";

type Store = Pick<Storage, "getItem">;

function read(storage: Store, key: string): unknown {
  try {
    return JSON.parse(storage.getItem(key) ?? "null");
  } catch {
    return null;
  }
}

const isFeature = (value: unknown): value is Feature =>
  typeof value === "string" && Object.hasOwn(featureMeta, value);

// Frames saved without a feature are old notes frames. Frames that cannot be read are dropped, and
// with none left the app starts from the default frame, because it needs at least one.
export function loadFrames(storage: Store): WorkspaceFrame[] {
  const saved = read(storage, FRAMES_KEY);
  const frames = (Array.isArray(saved) ? saved : []).flatMap((frame: Partial<WorkspaceFrame> | null) => {
    if (typeof frame?.id !== "string") return [];
    const feature = frame.feature ?? "notes";
    const { stackedAt, ...rest } = frame;
    const time = typeof stackedAt === "number" && Number.isFinite(stackedAt) ? { stackedAt } : {};
    return isFeature(feature) ? [{ ...initialFrame, ...rest, ...time, feature }] : [];
  });
  return frames.length > 0 ? frames : [initialFrame];
}

export function loadNoteBodies(storage: Store): Record<string, string> {
  const saved = read(storage, NOTE_BODIES_KEY);
  if (typeof saved !== "object" || saved === null || Array.isArray(saved)) {
    return { main: "# Notes\n\nStart writing in Markdown…\n\n- [ ] Capture the next idea" };
  }
  return Object.fromEntries(Object.entries(saved).filter(([, body]) => typeof body === "string")) as Record<string, string>;
}

export function loadTheme(storage: Store): Theme {
  // The theme is saved as plain text, not JSON.
  const saved = storage.getItem(THEME_KEY);
  return saved === "light" || saved === "dark" ? saved : "dark";
}
