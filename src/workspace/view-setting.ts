import { DEFAULT_WORKSPACE_VIEW, workspaceViewMeta } from "./view";
import type { WorkspaceViewId } from "./view";

export const WORKSPACE_VIEW_KEY = "focus-space-workspace-view";

export function loadWorkspaceView(storage: Pick<Storage, "getItem">): WorkspaceViewId {
  try {
    const saved = storage.getItem(WORKSPACE_VIEW_KEY);
    return saved !== null && Object.hasOwn(workspaceViewMeta, saved)
      ? (saved as WorkspaceViewId)
      : DEFAULT_WORKSPACE_VIEW;
  } catch {
    return DEFAULT_WORKSPACE_VIEW;
  }
}

export function saveWorkspaceView(storage: Pick<Storage, "setItem">, view: WorkspaceViewId): void {
  storage.setItem(WORKSPACE_VIEW_KEY, view);
}
