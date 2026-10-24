// Import and export: browser bookmarks HTML (Netscape), Raindrop-style CSV, and our own JSON.
import {
  cleanUrl,
  createBookmark,
  ensurePath,
  findDuplicate,
  parseTags,
  pathOf,
  type Bookmark,
  type Library,
} from "./bookmarks";

export type Format = "html" | "csv" | "json";

export interface ImportedBookmark {
  url: string;
  title: string;
  note: string;
  tags: string[];
  path: string[]; // collection names from the top
  created: string | null;
  favorite: boolean;
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const unixOf = (iso: string) => String(Math.floor(new Date(iso).getTime() / 1000) || 0);

// ---- export ----

export function exportHtml(library: Library): string {
  const live = library.bookmarks.filter((b) => b.trashedAt === null);
  const link = (b: Bookmark) =>
    `<DT><A HREF="${escapeHtml(b.url)}" ADD_DATE="${unixOf(b.created)}" TAGS="${escapeHtml(b.tags.join(","))}">${escapeHtml(b.title)}</A>` +
    (b.note ? `\n<DD>${escapeHtml(b.note)}` : "");
  const folder = (parent: string | null): string =>
    [
      ...library.collections
        .filter((c) => c.parent === parent)
        .map((c) => `<DT><H3>${escapeHtml(c.name)}</H3>\n<DL><p>\n${folder(c.id)}</DL><p>`),
      ...live.filter((b) => b.collection === parent).map(link),
    ].join("\n");
  return [
    "<!DOCTYPE NETSCAPE-Bookmark-file-1>",
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    "<TITLE>Bookmarks</TITLE>",
    "<H1>Bookmarks</H1>",
    "<DL><p>",
    folder(null),
    "</DL><p>",
    "",
  ].join("\n");
}

const CSV_HEADER = ["id", "title", "note", "excerpt", "url", "folder", "tags", "created", "cover", "highlights", "favorite"];

const csvCell = (value: string) => (/[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

// Same columns as Raindrop's CSV export, so a file moves both ways.
export function exportCsv(library: Library): string {
  const rows = library.bookmarks
    .filter((b) => b.trashedAt === null)
    .map((b) =>
      [
        b.id,
        b.title,
        b.note,
        "",
        b.url,
        pathOf(library.collections, b.collection).join("/"),
        b.tags.join(", "),
        b.created,
        b.cover ?? "",
        b.highlights.join("\n"),
        b.favorite ? "true" : "false",
      ].map(csvCell),
    );
  return [CSV_HEADER.join(","), ...rows.map((row) => row.join(","))].join("\n") + "\n";
}

export const exportJson = (library: Library) => JSON.stringify({ version: 1, ...library }, null, 2);

export function exportAs(format: Format, library: Library): { text: string; mime: string; name: string } {
  const day = new Date().toISOString().slice(0, 10);
  if (format === "html") return { text: exportHtml(library), mime: "text/html", name: `bookmarks-${day}.html` };
  if (format === "csv") return { text: exportCsv(library), mime: "text/csv", name: `bookmarks-${day}.csv` };
  return { text: exportJson(library), mime: "application/json", name: `bookmarks-${day}.json` };
}

// ---- import ----

export function detectFormat(name: string, text: string): Format | null {
  const head = text.trimStart().slice(0, 200).toLowerCase();
  if (head.startsWith("<!doctype netscape") || /<(dl|a )\b/i.test(head) || name.toLowerCase().endsWith(".html")) return "html";
  if (head.startsWith("{")) return "json";
  if (name.toLowerCase().endsWith(".csv") || head.includes("url")) return "csv";
  return null;
}

// Reads folders (<H3> + <DL>) as collections and links (<A>) as bookmarks, with a small tag scanner
// instead of the DOM so it works in tests and never runs scripts from the file.
export function parseHtml(text: string): ImportedBookmark[] {
  const out: ImportedBookmark[] = [];
  const stack: string[] = [];
  let pendingFolder: string | null = null;
  const token = /<(\/?)(h3|dl|a|dd)\b([^>]*)>([^<]*)/gi;
  const attr = (attrs: string, name: string) =>
    new RegExp(`${name}\\s*=\\s*"([^"]*)"`, "i").exec(attrs)?.[1] ?? "";
  const decode = (s: string) =>
    s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").trim();
  for (const match of text.matchAll(token)) {
    const [, closing, rawTag, attrs, inner] = match;
    const tag = rawTag.toLowerCase();
    if (tag === "h3" && !closing) pendingFolder = decode(inner);
    else if (tag === "dl" && !closing) {
      if (pendingFolder !== null) stack.push(pendingFolder);
      else if (stack.length || out.length) stack.push(""); // keeps open and close tags balanced
      pendingFolder = null;
    } else if (tag === "dl" && closing) stack.pop();
    else if (tag === "a" && !closing) {
      const url = cleanUrl(decode(attr(attrs, "href")));
      if (!url) continue;
      const added = Number(attr(attrs, "add_date"));
      out.push({
        url,
        title: decode(inner),
        note: "",
        tags: parseTags(decode(attr(attrs, "tags"))),
        path: stack.filter(Boolean),
        created: added > 0 ? new Date(added * 1000).toISOString() : null,
        favorite: false,
      });
    } else if (tag === "dd" && !closing && out.length) out[out.length - 1].note = decode(inner);
  }
  return out;
}

// RFC 4180 style: quoted cells may hold commas, quotes ("") and line breaks.
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

export function parseCsv(text: string): ImportedBookmark[] {
  const [header, ...rows] = parseCsvRows(text.replace(/^﻿/, ""));
  if (!header) return [];
  const col = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name);
  const [iUrl, iTitle, iNote, iFolder, iTags, iCreated, iFav] = ["url", "title", "note", "folder", "tags", "created", "favorite"].map(col);
  if (iUrl < 0) return [];
  return rows.flatMap((row) => {
    const url = cleanUrl(row[iUrl] ?? "");
    if (!url) return [];
    const created = new Date(row[iCreated] ?? "");
    return [
      {
        url,
        title: row[iTitle] ?? "",
        note: row[iNote] ?? "",
        tags: parseTags(row[iTags] ?? ""),
        path: (row[iFolder] ?? "").split("/").filter(Boolean),
        created: Number.isNaN(created.getTime()) ? null : created.toISOString(),
        favorite: (row[iFav] ?? "").toLowerCase() === "true",
      },
    ];
  });
}

// Our own JSON is lossless, so it is returned as a whole library to merge rather than as rows.
export function parseJson(text: string): ImportedBookmark[] {
  let data: { bookmarks?: Partial<Bookmark>[]; collections?: { id: string; name: string; parent: string | null }[] };
  try {
    data = JSON.parse(text);
  } catch {
    return [];
  }
  const collections = Array.isArray(data.collections) ? data.collections : [];
  const pathFor = (id: string | null | undefined): string[] => {
    const path: string[] = [];
    for (let at = id; at; ) {
      const found = collections.find((c) => c.id === at);
      if (!found) break;
      path.unshift(found.name);
      at = found.parent;
    }
    return path;
  };
  return (Array.isArray(data.bookmarks) ? data.bookmarks : []).flatMap((b) => {
    const url = cleanUrl(b.url ?? "");
    if (!url) return [];
    return [
      {
        url,
        title: typeof b.title === "string" ? b.title : "",
        note: typeof b.note === "string" ? b.note : "",
        tags: Array.isArray(b.tags) ? b.tags.filter((t): t is string => typeof t === "string") : [],
        path: pathFor(b.collection),
        created: typeof b.created === "string" ? b.created : null,
        favorite: b.favorite === true,
      },
    ];
  });
}

export function parseImport(format: Format, text: string): ImportedBookmark[] {
  return format === "html" ? parseHtml(text) : format === "csv" ? parseCsv(text) : parseJson(text);
}

export interface MergeResult {
  library: Library;
  added: number;
  duplicates: number;
}

// Adds the rows to the library. With skipDuplicates, rows whose URL is already saved (or repeated in
// the file) are left out and counted instead.
export function mergeImport(
  library: Library,
  rows: ImportedBookmark[],
  skipDuplicates: boolean,
  newId: () => string,
  now: Date,
): MergeResult {
  let next = library;
  let added = 0;
  let duplicates = 0;
  for (const row of rows) {
    if (findDuplicate(next.bookmarks, row.url)) {
      duplicates++;
      if (skipDuplicates) continue;
    }
    const placed = ensurePath(next, row.path, newId);
    next = placed.library;
    next = {
      ...next,
      bookmarks: [
        createBookmark(row.url, newId(), now, {
          ...(row.title ? { title: row.title } : {}),
          note: row.note,
          tags: row.tags,
          collection: placed.id,
          favorite: row.favorite,
          ...(row.created ? { created: row.created } : {}),
        }),
        ...next.bookmarks,
      ],
    };
    added++;
  }
  return { library: next, added, duplicates };
}

// How many rows would be skipped as duplicates, so the person can choose before importing.
export const countDuplicates = (library: Library, rows: ImportedBookmark[]) =>
  rows.filter((row) => findDuplicate(library.bookmarks, row.url)).length;
