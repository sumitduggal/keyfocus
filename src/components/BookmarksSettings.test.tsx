// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BookmarksSettings } from "./BookmarksSettings";
import { createBookmark, type Library } from "../bookmarks";
import { exportCsv, exportHtml, exportJson } from "../bookmarks-io";
import { getLibrary, updateLibrary } from "../bookmarks-store";

const seed = (): Library => ({
  collections: [{ id: "dev", name: "Dev", parent: null }],
  bookmarks: [createBookmark("https://react.dev", "a", new Date("2026-05-01T00:00:00Z"), { title: "React", collection: "dev", tags: ["ui"] })],
});
const upload = (text: string, name: string) => userEvent.setup({ applyAccept: false }).upload(screen.getByLabelText("Import bookmarks file"), new File([text], name));

beforeEach(() => {
  localStorage.clear();
  updateLibrary(seed());
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("BookmarksSettings", () => {
  it("imports an HTML file with folders, tags and dates", async () => {
    render(<BookmarksSettings />);
    await upload(
      '<DL><DT><H3>Tools</H3><DL><DT><A HREF="https://vite.dev" ADD_DATE="1700000000" TAGS="build,js">Vite</A></DL></DL>',
      "bookmarks.html",
    );
    expect((await screen.findByRole("status")).textContent).toBe("Imported 1 bookmark.");
    const vite = getLibrary().bookmarks.find((b) => b.url.includes("vite.dev"))!;
    expect(vite).toMatchObject({ title: "Vite", tags: ["build", "js"], created: "2023-11-14T22:13:20.000Z" });
    expect(getLibrary().collections.find((c) => c.id === vite.collection)?.name).toBe("Tools");
  });

  it("imports CSV and JSON", async () => {
    render(<BookmarksSettings />);
    await upload("url,title,tags\nhttps://a.com,A,x\nhttps://b.com,B,y\n", "r.csv");
    await screen.findByText("Imported 2 bookmarks.");
    const json = exportJson({ collections: [], bookmarks: [createBookmark("https://c.com", "c", new Date(), { title: "C" })] });
    await upload(json, "own.json");
    await screen.findByText("Imported 1 bookmark.");
    expect(getLibrary().bookmarks).toHaveLength(4);
  });

  it("asks about duplicates: skip", async () => {
    const user = userEvent.setup();
    render(<BookmarksSettings />);
    await upload("url,title\nhttps://www.react.dev/,Again\nhttps://new.com,New\n", "r.csv");
    expect((await screen.findByRole("alertdialog")).textContent).toMatch(/1 of 2 already saved/);
    expect(getLibrary().bookmarks).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Skip" }));
    expect((await screen.findByRole("status")).textContent).toBe("Imported 1 bookmark, 1 duplicate skipped.");
    expect(getLibrary().bookmarks).toHaveLength(2);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("asks about duplicates: import all, or cancel", async () => {
    const user = userEvent.setup();
    render(<BookmarksSettings />);
    await upload("url,title\nhttps://react.dev,Again\n", "r.csv");
    await user.click(await screen.findByRole("button", { name: "Cancel import" }));
    expect(getLibrary().bookmarks).toHaveLength(1);
    await upload("url,title\nhttps://react.dev,Again\n", "r.csv");
    await user.click(await screen.findByRole("button", { name: "Import all" }));
    expect((await screen.findByRole("status")).textContent).toBe("Imported 1 bookmark, 1 duplicate kept.");
    expect(getLibrary().bookmarks).toHaveLength(2);
  });

  it("says so when a file has no bookmarks", async () => {
    render(<BookmarksSettings />);
    await upload("nothing useful here", "notes.txt");
    expect((await screen.findByRole("status")).textContent).toBe("No bookmarks found in that file.");
    expect(getLibrary().bookmarks).toHaveLength(1);
  });

  it.each([
    ["HTML", exportHtml, "text/html", ".html"],
    ["CSV", exportCsv, "text/csv", ".csv"],
    ["JSON", exportJson, "application/json", ".json"],
  ])("downloads %s of the current library", async (label, exporter, mime, ext) => {
    const blobs: Blob[] = [];
    URL.createObjectURL = (blob: Blob | MediaSource) => (blobs.push(blob as Blob), "blob:x");
    URL.revokeObjectURL = () => undefined;
    const names: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      names.push(this.download);
    });
    const user = userEvent.setup();
    render(<BookmarksSettings />);
    await user.click(screen.getByRole("button", { name: label }));
    await waitFor(() => expect(blobs).toHaveLength(1));
    expect(blobs[0].type).toBe(mime);
    expect(await blobs[0].text()).toBe(exporter(getLibrary()));
    expect(names[0]).toMatch(new RegExp(`^bookmarks-\\d{4}-\\d{2}-\\d{2}\\${ext}$`));
  });
});
