import { describe, expect, it } from "vitest";
import { WORKSPACE_VIEW_KEY, loadWorkspaceView, saveWorkspaceView } from "./view-setting";
import { DEFAULT_WORKSPACE_VIEW, workspaceViewMeta } from "./view";
import type { WorkspaceViewId } from "./view";

const viewIds: WorkspaceViewId[] = ["operator", "calm", "immersive", "overview"];

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

describe("workspace view metadata", () => {
  it("provides a label and description for every view and defaults to Operator Console", () => {
    expect(DEFAULT_WORKSPACE_VIEW).toBe("operator");
    expect(Object.keys(workspaceViewMeta)).toEqual(viewIds);
    expect(workspaceViewMeta.operator.label).toBe("Operator Console");
    expect(workspaceViewMeta.calm.label).toBe("Calm Workspace");
    expect(workspaceViewMeta.immersive.label).toBe("Immersive Focus");
    expect(workspaceViewMeta.overview.label).toBe("Daily Overview");
    for (const id of viewIds) expect(workspaceViewMeta[id].description).not.toBe("");
  });
});

describe("workspace view persistence", () => {
  it("loads every supported view", () => {
    for (const id of viewIds) {
      const storage = fakeStorage({ [WORKSPACE_VIEW_KEY]: id });
      expect(loadWorkspaceView(storage)).toBe(id);
    }
  });

  it("uses Operator Console when no view is saved", () => {
    expect(loadWorkspaceView(fakeStorage())).toBe(DEFAULT_WORKSPACE_VIEW);
  });

  it("uses Operator Console for unknown or damaged values", () => {
    for (const value of ["future-view", "{not json", "", "null", "__proto__"]) {
      const storage = fakeStorage({ [WORKSPACE_VIEW_KEY]: value });
      expect(loadWorkspaceView(storage)).toBe(DEFAULT_WORKSPACE_VIEW);
    }
  });

  it("uses Operator Console when storage cannot be read", () => {
    const storage = {
      getItem: () => {
        throw new Error("Storage unavailable");
      },
    };
    expect(loadWorkspaceView(storage)).toBe(DEFAULT_WORKSPACE_VIEW);
  });

  it("saves the selected view as plain text under the workspace view key", () => {
    const storage = fakeStorage();
    saveWorkspaceView(storage, "immersive");
    expect(storage.getItem(WORKSPACE_VIEW_KEY)).toBe("immersive");
    expect(loadWorkspaceView(storage)).toBe("immersive");
  });
});
