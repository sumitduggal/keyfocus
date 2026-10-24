import { describe, expect, it } from "vitest";
import {
  addCollection,
  addTags,
  allTags,
  cleanUrl,
  createBookmark,
  deleteBookmarks,
  deleteCollection,
  dueReminders,
  duplicateIds,
  ensurePath,
  loadLibrary,
  moveCollection,
  normalizeUrl,
  parseSearch,
  parseTags,
  pathOf,
  pruneTrash,
  renameCollection,
  restoreBookmarks,
  trashBookmarks,
  typeOf,
  visibleBookmarks,
  type Library,
} from "./bookmarks";
import {
  detectFormat,
  exportCsv,
  exportHtml,
  exportJson,
  mergeImport,
  parseCsv,
  parseHtml,
  parseJson,
} from "./bookmarks-io";

const now = new Date("2026-05-10T12:00:00Z");
let n = 0;
const id = () => `id${++n}`;

function sample(): Library {
  let lib: Library = { bookmarks: [], collections: [] };
  lib = addCollection(lib, { id: "dev", name: "Dev", parent: null });
  lib = addCollection(lib, { id: "ts", name: "TypeScript", parent: "dev" });
  lib.bookmarks = [
    createBookmark("https://www.typescriptlang.org/docs/", "a", now, { title: "TS Docs", collection: "ts", tags: ["ts", "docs"], note: 'has "quotes", commas\nand a newline', favorite: true }),
    createBookmark("https://example.com/photo.png", "b", new Date("2025-01-02T00:00:00Z"), { title: "Photo", tags: ["img"] }),
  ];
  return lib;
}

describe("urls", () => {
  it("normalizes tracking, www, hash and slash", () => {
    expect(normalizeUrl("https://www.Example.com/a/?utm_source=x&b=1&a=2#top")).toBe(normalizeUrl("http://example.com/a?a=2&b=1"));
  });
  it("cleans pasted input", () => {
    expect(cleanUrl("example.com/x")).toBe("https://example.com/x");
    expect(cleanUrl("javascript:alert(1)")).toBeNull();
    expect(cleanUrl("two words.com")).toBeNull();
    expect(cleanUrl("localhost")).toBeNull();
  });
});

describe("search", () => {
  const lib = sample();
  const find = (q: string) => visibleBookmarks(lib, { kind: "all" }, q).map((b) => b.id);
  it("matches text, #tag, type, domain, favorite and created", () => {
    expect(find("docs")).toEqual(["a"]);
    expect(find("#img")).toEqual(["b"]);
    expect(find("type:image")).toEqual(["b"]);
    expect(find("domain:typescriptlang.org")).toEqual(["a"]);
    expect(find("❤")).toEqual(["a"]);
    expect(find("created:2025")).toEqual(["b"]);
    expect(find("created:>2025-06")).toEqual(["a"]);
    expect(find("created:<2026")).toEqual(["b"]);
    expect(find("#ts #nope")).toEqual([]);
  });
  it("parses operators out of free text", () => {
    expect(parseSearch("hello #a type:video").text).toEqual(["hello"]);
  });
  it("scopes by collection tree, trash and duplicates", () => {
    expect(visibleBookmarks(lib, { kind: "collection", id: "dev" }, "").map((b) => b.id)).toEqual(["a"]);
    const trashed = trashBookmarks(lib, ["a"], now);
    expect(visibleBookmarks(trashed, { kind: "all" }, "").map((b) => b.id)).toEqual(["b"]);
    expect(visibleBookmarks(trashed, { kind: "trash" }, "").map((b) => b.id)).toEqual(["a"]);
    const dupes = { ...lib, bookmarks: [...lib.bookmarks, createBookmark("http://typescriptlang.org/docs", "c", now)] };
    expect([...duplicateIds(dupes.bookmarks)].sort()).toEqual(["a", "c"]);
  });
  it("purges trash after a week", () => {
    const trashed = trashBookmarks(sample(), ["a"], new Date("2026-05-01T00:00:00Z"));
    expect(pruneTrash(trashed, now).bookmarks.map((b) => b.id)).toEqual(["b"]);
  });
});

describe("collections", () => {
  it("deleting moves bookmarks to Unsorted and children up", () => {
    const next = deleteCollection(sample(), "ts");
    expect(next.bookmarks.find((b) => b.id === "a")?.collection).toBeNull();
    const next2 = deleteCollection(sample(), "dev");
    expect(next2.collections.find((c) => c.id === "ts")?.parent).toBeNull();
  });
  it("cannot move into itself", () => {
    const lib = sample();
    expect(moveCollection(lib, "dev", "ts")).toBe(lib);
  });
});

describe("storage", () => {
  it("survives damaged data", () => {
    expect(loadLibrary({ getItem: () => "{nope" })).toEqual({ bookmarks: [], collections: [] });
    const lib = loadLibrary({ getItem: () => JSON.stringify({ bookmarks: [null, { id: "x", url: "https://a.com", collection: "gone" }], collections: [1] }) });
    expect(lib.bookmarks).toHaveLength(1);
    expect(lib.bookmarks[0].collection).toBeNull();
  });
});

describe("import and export", () => {
  const roundTrip = (rows: ReturnType<typeof parseHtml>) => mergeImport({ bookmarks: [], collections: [] }, rows, true, id, now).library;
  const check = (lib: Library) => {
    const a = lib.bookmarks.find((b) => b.url.includes("typescriptlang"))!;
    expect(a.title).toBe("TS Docs");
    expect(a.tags).toEqual(["ts", "docs"]);
    expect(lib.collections.map((c) => c.name).sort()).toEqual(["Dev", "TypeScript"]);
    expect(lib.collections.find((c) => c.id === a.collection)?.name).toBe("TypeScript");
  };
  it("round-trips HTML", () => {
    const html = exportHtml(sample());
    expect(detectFormat("x.html", html)).toBe("html");
    const rows = parseHtml(html);
    expect(rows).toHaveLength(2);
    check(roundTrip(rows));
    expect(rows.find((r) => r.url.includes("typescriptlang"))?.note).toContain('"quotes"');
  });
  it("round-trips CSV with quotes and newlines", () => {
    const rows = parseCsv(exportCsv(sample()));
    expect(rows).toHaveLength(2);
    expect(rows[0].note).toBe('has "quotes", commas\nand a newline');
    check(roundTrip(rows));
  });
  it("round-trips JSON", () => {
    const rows = parseJson(exportJson(sample()));
    check(roundTrip(rows));
    expect(rows[0].favorite).toBe(true);
  });
  it("skips or keeps duplicates", () => {
    const rows = parseCsv(exportCsv(sample()));
    const skip = mergeImport(sample(), rows, true, id, now);
    expect([skip.added, skip.duplicates, skip.library.bookmarks.length]).toEqual([0, 2, 2]);
    const keep = mergeImport(sample(), rows, false, id, now);
    expect([keep.added, keep.library.bookmarks.length]).toEqual([2, 4]);
    expect(keep.library.collections).toHaveLength(2);
  });
  it("ignores bad rows and non-http links", () => {
    expect(parseCsv("url,title\njavascript:x,Bad\nhttps://ok.com,Ok\n")).toHaveLength(1);
    expect(parseCsv("title\nno url column")).toEqual([]);
    expect(parseJson("not json")).toEqual([]);
  });
});

describe("editing helpers", () => {
  it("adds tags without duplicates, only to the chosen bookmarks", () => {
    const next = addTags(sample(), ["a"], ["docs", "new"]);
    expect(next.bookmarks.find((b) => b.id === "a")?.tags).toEqual(["ts", "docs", "new"]);
    expect(next.bookmarks.find((b) => b.id === "b")?.tags).toEqual(["img"]);
  });
  it("parses tags from commas, spaces and #", () => {
    expect(parseTags("#One, two  two,THREE")).toEqual(["one", "two", "three"]);
  });
  it("renames a collection and ignores a blank name", () => {
    const lib = sample();
    expect(renameCollection(lib, "dev", "  Work ").collections.find((c) => c.id === "dev")?.name).toBe("Work");
    expect(renameCollection(lib, "dev", "   ")).toBe(lib);
  });
  it("trashes, restores and deletes forever", () => {
    const trashed = trashBookmarks(sample(), ["a"], now);
    expect(trashed.bookmarks.find((b) => b.id === "a")?.trashedAt).toBe(now.toISOString());
    expect(restoreBookmarks(trashed, ["a"]).bookmarks.find((b) => b.id === "a")?.trashedAt).toBeNull();
    expect(deleteBookmarks(trashed, ["a"]).bookmarks.map((b) => b.id)).toEqual(["b"]);
  });
  it("moves a collection to a valid parent", () => {
    const moved = moveCollection(sample(), "ts", null);
    expect(moved.collections.find((c) => c.id === "ts")?.parent).toBeNull();
  });
  it("finds or creates a collection path, reusing what exists", () => {
    const lib = sample();
    const reused = ensurePath(lib, ["Dev", "TypeScript"], id);
    expect(reused.id).toBe("ts");
    expect(reused.library.collections).toHaveLength(2);
    const made = ensurePath(lib, ["Dev", "Go"], id);
    expect(made.library.collections).toHaveLength(3);
    expect(pathOf(made.library.collections, made.id)).toEqual(["Dev", "Go"]);
    expect(ensurePath(lib, [], id).id).toBeNull();
  });
  it("defaults the title to the domain", () => {
    expect(createBookmark("https://www.site.com/x", "z", now).title).toBe("site.com");
  });
});

describe("types, tags and reminders", () => {
  it("guesses the type from the address", () => {
    expect(typeOf("https://a.com/x.PNG")).toBe("image");
    expect(typeOf("https://www.youtube.com/watch?v=1")).toBe("video");
    expect(typeOf("https://a.com/song.mp3")).toBe("audio");
    expect(typeOf("https://a.com/paper.pdf")).toBe("document");
    expect(typeOf("https://a.com/page")).toBe("link");
  });
  it("counts live tags by use, most used first", () => {
    const lib = sample();
    lib.bookmarks.push(createBookmark("https://c.com", "c", now, { tags: ["img", "ts"] }));
    lib.bookmarks.push(createBookmark("https://d.com", "d", now, { tags: ["img"], trashedAt: now.toISOString() }));
    expect(allTags(lib.bookmarks)).toEqual([
      { tag: "img", count: 2 },
      { tag: "ts", count: 2 },
      { tag: "docs", count: 1 },
    ]);
  });
  it("lists due reminders soonest first and only live ones", () => {
    const lib = sample();
    lib.bookmarks = [
      createBookmark("https://a.com", "late", now, { remindAt: "2026-05-11T00:00:00Z" }),
      createBookmark("https://b.com", "soon", now, { remindAt: "2026-05-09T00:00:00Z" }),
      createBookmark("https://c.com", "gone", now, { remindAt: "2026-05-01T00:00:00Z", trashedAt: now.toISOString() }),
      createBookmark("https://d.com", "none", now),
    ];
    expect(visibleBookmarks(lib, { kind: "reminders" }, "").map((b) => b.id)).toEqual(["soon", "late"]);
    expect(dueReminders(lib, now).map((b) => b.id)).toEqual(["soon"]);
  });
  it("filters favorites, unsorted, broken and tag scopes", () => {
    const lib = sample();
    lib.bookmarks.push(createBookmark("https://dead.com", "dead", now, { broken: true, tags: ["x"] }));
    const ids = (scope: Parameters<typeof visibleBookmarks>[1]) => visibleBookmarks(lib, scope, "").map((b) => b.id).sort();
    expect(ids({ kind: "favorites" })).toEqual(["a"]);
    expect(ids({ kind: "unsorted" })).toEqual(["b", "dead"]);
    expect(ids({ kind: "broken" })).toEqual(["dead"]);
    expect(ids({ kind: "tag", tag: "x" })).toEqual(["dead"]);
    expect(visibleBookmarks(lib, { kind: "tag", tag: "ts" }, "docs").map((b) => b.id)).toEqual(["a"]);
  });
  it("searches notes and highlights", () => {
    const lib = sample();
    lib.bookmarks[1].highlights = ["a memorable quote"];
    expect(visibleBookmarks(lib, { kind: "all" }, "memorable").map((b) => b.id)).toEqual(["b"]);
  });
});
