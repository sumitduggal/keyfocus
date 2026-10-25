// A frame left unused in the stack for an hour drops out of the stack bar. Nothing is deleted: the
// frame and its data stay saved, and it opens again from ⌘K or the dock like any other frame.
import type { WorkspaceFrame } from "./types";

export const STACK_MAX_AGE_MS = 60 * 60 * 1000;

// Has been in the stack for an hour or more, so it is no longer shown there.
export const isParked = (frame: WorkspaceFrame, now: number): boolean =>
  frame.stackedAt !== undefined && now - frame.stackedAt >= STACK_MAX_AGE_MS;

export function unstamped(frame: WorkspaceFrame): WorkspaceFrame {
  const { stackedAt, ...rest } = frame;
  void stackedAt;
  return rest;
}

// Records when each frame went into the stack. The frame that just left the main side starts a new hour,
// the active frame is not in the stack so it has no time, and a frame with none yet (saved before this
// existed, or just created) starts one now. Returns the same list when nothing changes.
export function markStacked(
  frames: WorkspaceFrame[],
  activeId: string,
  previousId: string | null,
  now: number,
): WorkspaceFrame[] {
  let changed = false;
  const next = frames.map((frame) => {
    if (frame.id === activeId) {
      if (frame.stackedAt === undefined) return frame;
      changed = true;
      return unstamped(frame);
    }
    if (frame.id !== previousId && frame.stackedAt !== undefined) return frame;
    changed = true;
    return { ...frame, stackedAt: now };
  });
  return changed ? next : frames;
}
