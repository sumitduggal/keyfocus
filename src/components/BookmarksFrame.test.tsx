// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BookmarksFrame } from "./BookmarksFrame";
import { createBookmark, type Library } from "../bookmarks";
import { getLibrary, updateLibrary } from "../bookmarks-store";

const now = new Date("2026-05-10T12:00:00Z");
const seed = (): Library => ({
  collections: [{ id: "dev", name: "Development", parent: null }],
  bookmarks: [
    createBookmark("https://typescriptlang.org/docs", "a", new Date("2026-05-03T00:00:00Z"), { title: "TypeScript Docs", tags: ["ts"], collection: "dev", note: "handbook" }),
    createBookmark("https://react.dev", "b", new Date("2026-05-02T00:00:00Z"), { title: "React", tags: ["react"] }),
    createBookmark("https://news.ycombinator.com", "c", new Date("2026-05-01T00:00:00Z"), { title: "Hacker News", favorite: true }),
  ],
});
const titles = () => screen.queryAllByRole("link").map((a) => a.textContent);

beforeEach(() => {
  localStorage.clear();
  updateLibrary(seed());
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 404 })));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("BookmarksFrame", () => {
  it("lists bookmarks newest first and has no import/export in the toolbar", () => {
    render(<BookmarksFrame />);
    expect(titles()).toEqual(["TypeScript Docs", "React", "Hacker News"]);
    expect(screen.queryByRole("button", { name: "Import" })).toBeNull();
    expect(screen.queryByRole("button", { name: /html/i })).toBeNull();
  });

  it("saves a pasted link, then fills in the title from the BFF", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ title: "Vite", image: "https://vite.dev/c.png", favicon: null }));
    const user = userEvent.setup();
    render(<BookmarksFrame />);
    await user.type(screen.getByLabelText("New bookmark address"), "vite.dev{Enter}");
    expect(await screen.findByText("Vite")).toBeTruthy();
    const saved = getLibrary().bookmarks.find((b) => b.url === "https://vite.dev/");
    expect(saved?.cover).toBe("https://vite.dev/c.png");
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe("/api/og?url=https%3A%2F%2Fvite.dev%2F");
  });

  it("keeps the domain as title when the BFF fails", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("offline"));
    const user = userEvent.setup();
    render(<BookmarksFrame />);
    await user.type(screen.getByLabelText("New bookmark address"), "https://example.com/a{Enter}");
    expect(await screen.findByRole("link", { name: "example.com" })).toBeTruthy();
  });

  it("rejects bad addresses and duplicates with a message", async () => {
    const user = userEvent.setup();
    render(<BookmarksFrame />);
    const field = screen.getByLabelText("New bookmark address");
    await user.type(field, "not a link{Enter}");
    expect((await screen.findByRole("status")).textContent).toMatch(/does not look like/);
    await user.clear(field);
    await user.type(field, "https://www.react.dev/?utm_source=x{Enter}");
    expect((await screen.findByRole("status")).textContent).toMatch(/Already saved as "React"/);
    expect(getLibrary().bookmarks).toHaveLength(3);
  });

  it("filters with search operators", async () => {
    const user = userEvent.setup();
    render(<BookmarksFrame />);
    const search = screen.getByLabelText("Search bookmarks");
    await user.type(search, "#ts");
    expect(titles()).toEqual(["TypeScript Docs"]);
    await user.clear(search);
    await user.type(search, "❤");
    expect(titles()).toEqual(["Hacker News"]);
    await user.clear(search);
    await user.type(search, "zzz");
    expect(screen.getByText("Nothing here.")).toBeTruthy();
  });

  it("switches views and remembers the choice", async () => {
    const user = userEvent.setup();
    render(<BookmarksFrame />);
    const list = () => document.querySelector(".bm-items")!;
    expect(list().className).toContain("bm-list");
    for (const view of ["grid", "headlines", "masonry"]) {
      await user.click(screen.getByRole("button", { name: view }));
      expect(list().className).toContain(`bm-${view}`);
    }
    expect(localStorage.getItem("focus-space-bookmarks-view")).toBe("masonry");
  });

  it("opens collections and tags from the sidebar", async () => {
    const user = userEvent.setup();
    render(<BookmarksFrame />);
    const side = within(screen.getByRole("navigation", { name: "Collections" }));
    await user.click(side.getByRole("button", { name: /^Development/ }));
    expect(titles()).toEqual(["TypeScript Docs"]);
    await user.click(side.getByRole("button", { name: /Unsorted/ }));
    expect(titles()).toEqual(["React", "Hacker News"]);
    await user.click(side.getByRole("button", { name: /#react/ }));
    expect(titles()).toEqual(["React"]);
  });

  it("creates a collection", async () => {
    vi.stubGlobal("prompt", vi.fn().mockReturnValue("Reading"));
    const user = userEvent.setup();
    render(<BookmarksFrame />);
    await user.click(screen.getByRole("button", { name: "New collection" }));
    expect(getLibrary().collections.map((c) => c.name)).toEqual(["Development", "Reading"]);
  });

  it("favorites a bookmark", async () => {
    const user = userEvent.setup();
    render(<BookmarksFrame />);
    await user.click(screen.getAllByRole("button", { name: "Add to favorites" })[0]);
    expect(getLibrary().bookmarks.find((b) => b.id === "a")?.favorite).toBe(true);
  });

  it("trashes a bookmark, shows it in Trash, and restores it", async () => {
    const user = userEvent.setup();
    render(<BookmarksFrame />);
    await user.click(screen.getByRole("button", { name: "Trash React" }));
    expect(titles()).toEqual(["TypeScript Docs", "Hacker News"]);
    await user.click(within(screen.getByRole("navigation")).getByRole("button", { name: /Trash/ }));
    expect(titles()).toEqual(["React"]);
    await user.click(screen.getByRole("button", { name: "Restore" }));
    expect(getLibrary().bookmarks.every((b) => b.trashedAt === null)).toBe(true);
  });

  it("deletes forever from Trash", async () => {
    updateLibrary((lib) => ({ ...lib, bookmarks: lib.bookmarks.map((b) => (b.id === "b" ? { ...b, trashedAt: now.toISOString() } : b)) }));
    const user = userEvent.setup();
    render(<BookmarksFrame />);
    await user.click(within(screen.getByRole("navigation")).getByRole("button", { name: /Trash/ }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(getLibrary().bookmarks.map((b) => b.id)).toEqual(["a", "c"]);
  });

  it("applies bulk actions to the selection: tag, move, favorite, trash", async () => {
    const user = userEvent.setup();
    render(<BookmarksFrame />);
    await user.click(screen.getByLabelText("Select React"));
    await user.click(screen.getByLabelText("Select Hacker News"));
    expect(screen.getByText("2 selected")).toBeTruthy();
    await user.type(screen.getByLabelText("Add tags to selected"), "read, later{Enter}");
    expect(getLibrary().bookmarks.find((b) => b.id === "b")?.tags).toEqual(["react", "read", "later"]);
    await user.click(screen.getByRole("button", { name: "★ Favorite" }));
    expect(getLibrary().bookmarks.filter((b) => b.favorite).map((b) => b.id).sort()).toEqual(["b", "c"]);
    await user.selectOptions(screen.getByLabelText("Move selected to"), "dev");
    expect(getLibrary().bookmarks.filter((b) => b.collection === "dev").map((b) => b.id).sort()).toEqual(["a", "b", "c"]);
    expect(screen.queryByText("2 selected")).toBeNull();
    await user.click(screen.getByLabelText("Select React"));
    await user.click(screen.getByRole("button", { name: "Trash" }));
    expect(getLibrary().bookmarks.find((b) => b.id === "b")?.trashedAt).not.toBeNull();
  });

  it("edits title, note, tags, collection, reminder and highlights", async () => {
    const user = userEvent.setup();
    render(<BookmarksFrame />);
    await user.click(screen.getAllByRole("button", { name: "Edit" })[1]); // React
    const edit = within(document.querySelector(".bm-edit") as HTMLElement);
    const title = edit.getByDisplayValue("React");
    await user.clear(title);
    await user.type(title, "React Docs");
    await user.tab();
    const tags = edit.getByDisplayValue("react");
    await user.clear(tags);
    await user.type(tags, "ui, js");
    await user.tab();
    await user.selectOptions(edit.getByRole("combobox"), "dev");
    await user.type(edit.getByLabelText("New highlight"), "hooks rule{Enter}");
    const saved = () => getLibrary().bookmarks.find((b) => b.id === "b")!;
    expect(saved()).toMatchObject({ title: "React Docs", tags: ["ui", "js"], collection: "dev", highlights: ["hooks rule"] });
    await user.click(edit.getByLabelText("Remove highlight"));
    expect(saved().highlights).toEqual([]);
  });

  it("sets a reminder and lists it, highlighting when due", async () => {
    updateLibrary((lib) => ({ ...lib, bookmarks: lib.bookmarks.map((b) => (b.id === "c" ? { ...b, remindAt: "2020-01-01T09:00:00.000Z" } : b)) }));
    const user = userEvent.setup();
    render(<BookmarksFrame />);
    const side = within(screen.getByRole("navigation"));
    expect(side.getByRole("button", { name: /Reminders \(1 due\)/ })).toBeTruthy();
    await user.click(side.getByRole("button", { name: /Reminders/ }));
    expect(titles()).toEqual(["Hacker News"]);
    expect(document.querySelector(".bm-item.is-due")).not.toBeNull();
  });

  it("marks broken links after Check links", async () => {
    vi.mocked(fetch).mockImplementation(async (input) =>
      Response.json({ ok: !String(input).includes("react.dev") }),
    );
    const user = userEvent.setup();
    render(<BookmarksFrame />);
    await user.click(screen.getByRole("button", { name: "Check links" }));
    expect((await screen.findByText("1 broken link found.")).textContent).toBeTruthy();
    expect(getLibrary().bookmarks.filter((b) => b.broken).map((b) => b.id)).toEqual(["b"]);
    await user.click(within(screen.getByRole("navigation")).getByRole("button", { name: /Broken/ }));
    expect(titles()).toEqual(["React"]);
  });

  it("shows duplicates together", async () => {
    updateLibrary((lib) => ({ ...lib, bookmarks: [...lib.bookmarks, createBookmark("http://www.react.dev/", "d", now, { title: "React again" })] }));
    const user = userEvent.setup();
    render(<BookmarksFrame />);
    await user.click(within(screen.getByRole("navigation")).getByRole("button", { name: /Duplicates/ }));
    expect(titles().sort()).toEqual(["React", "React again"]);
  });
});
