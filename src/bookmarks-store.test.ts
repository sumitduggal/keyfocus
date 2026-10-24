import { beforeEach, describe, expect, it, vi } from "vitest";
import { BOOKMARKS_KEY, createBookmark } from "./bookmarks";

// The store reads localStorage when it loads, so each test gives it a fresh fake and a fresh module.
function fakeStorage(initial?: string) {
  const data = new Map<string, string>(initial ? [[BOOKMARKS_KEY, initial]] : []);
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), data };
}

async function load(initial?: string) {
  vi.resetModules();
  const storage = fakeStorage(initial);
  vi.stubGlobal("localStorage", storage);
  return { store: await import("./bookmarks-store"), storage };
}

beforeEach(() => vi.unstubAllGlobals());

describe("bookmarks store", () => {
  it("starts empty, and from damaged data", async () => {
    expect((await load()).store.getLibrary()).toEqual({ bookmarks: [], collections: [] });
    expect((await load("{broken")).store.getLibrary().bookmarks).toEqual([]);
  });
  it("drops bookmarks trashed more than a week ago on load", async () => {
    const old = createBookmark("https://old.com", "old", new Date(), { trashedAt: "2020-01-01T00:00:00Z" });
    const keep = createBookmark("https://new.com", "new", new Date());
    const { store } = await load(JSON.stringify({ bookmarks: [old, keep], collections: [] }));
    expect(store.getLibrary().bookmarks.map((b) => b.id)).toEqual(["new"]);
  });
  it("updates, saves and notifies listeners", async () => {
    const { store, storage } = await load();
    const listener = vi.fn();
    const stop = store.subscribeLibrary(listener);
    store.updateLibrary((lib) => ({ ...lib, bookmarks: [createBookmark("https://a.com", "a", new Date())] }));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(JSON.parse(storage.data.get(BOOKMARKS_KEY)!).bookmarks).toHaveLength(1);
    stop();
    store.updateLibrary({ bookmarks: [], collections: [] });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getLibrary().bookmarks).toEqual([]);
  });
});
