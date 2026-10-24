// Bookmarks: a library of saved links in nested collections, with tags, favorites, trash,
// highlights and Raindrop-style search. Pure functions over plain data; the frame owns the state.
export interface Bookmark {
  id: string;
  url: string;
  title: string;
  note: string;
  tags: string[];
  collection: string | null; // a collection id; null is Unsorted
  favorite: boolean;
  trashedAt: string | null; // ISO time; trashed bookmarks are purged after a week
  created: string; // ISO time
  cover: string | null;
  favicon: string | null;
  highlights: string[]; // quotes typed in by hand
  remindAt: string | null; // ISO time
  broken: boolean | null; // null until checked
}

export interface Collection {
  id: string;
  name: string;
  parent: string | null;
}

export interface Library {
  bookmarks: Bookmark[];
  collections: Collection[];
}

export const BOOKMARKS_KEY = "focus-space-bookmarks";
export const EMPTY_LIBRARY: Library = { bookmarks: [], collections: [] };
const TRASH_MS = 7 * 24 * 60 * 60 * 1000;

const TRACKING_PARAM = /^(utm_|fbclid$|gclid$|mc_|ref$)/i;

// Two URLs are the same bookmark when they only differ by scheme, www, hash, trailing slash,
// tracking params or param order.
export function normalizeUrl(raw: string): string {
  try {
    const url = new URL(raw.trim());
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) if (TRACKING_PARAM.test(key)) url.searchParams.delete(key);
    url.searchParams.sort();
    const path = url.pathname.replace(/\/+$/, "");
    return `${url.hostname.replace(/^www\./, "")}${path}${url.search}`.toLowerCase();
  } catch {
    return raw.trim().toLowerCase();
  }
}

// A pasted address without a scheme is treated as https. Anything that is not http(s) is rejected.
export function cleanUrl(raw: string): string | null {
  const text = raw.trim();
  if (!text || /\s/.test(text)) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`);
    return (url.protocol === "http:" || url.protocol === "https:") && url.hostname.includes(".") ? url.href : null;
  } catch {
    return null;
  }
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function parseTags(raw: string): string[] {
  return [...new Set(raw.split(/[,\s]+/).map((tag) => tag.replace(/^#/, "").trim().toLowerCase()).filter(Boolean))];
}

export function createBookmark(
  url: string,
  id: string,
  now: Date,
  extra: Partial<Omit<Bookmark, "id" | "url">> = {},
): Bookmark {
  return {
    title: domainOf(url),
    note: "",
    tags: [],
    collection: null,
    favorite: false,
    trashedAt: null,
    created: now.toISOString(),
    cover: null,
    favicon: null,
    highlights: [],
    remindAt: null,
    broken: null,
    ...extra,
    id,
    url,
  };
}

export function findDuplicate(bookmarks: Bookmark[], url: string): Bookmark | undefined {
  const key = normalizeUrl(url);
  return bookmarks.find((bookmark) => normalizeUrl(bookmark.url) === key);
}

export function updateBookmarks(
  library: Library,
  ids: string[],
  change: Partial<Bookmark> | ((bookmark: Bookmark) => Partial<Bookmark>),
): Library {
  const set = new Set(ids);
  return {
    ...library,
    bookmarks: library.bookmarks.map((bookmark) =>
      set.has(bookmark.id) ? { ...bookmark, ...(typeof change === "function" ? change(bookmark) : change) } : bookmark,
    ),
  };
}

export const trashBookmarks = (library: Library, ids: string[], now: Date) =>
  updateBookmarks(library, ids, { trashedAt: now.toISOString() });

export const restoreBookmarks = (library: Library, ids: string[]) => updateBookmarks(library, ids, { trashedAt: null });

export function deleteBookmarks(library: Library, ids: string[]): Library {
  const set = new Set(ids);
  return { ...library, bookmarks: library.bookmarks.filter((bookmark) => !set.has(bookmark.id)) };
}

export function addTags(library: Library, ids: string[], tags: string[]): Library {
  return updateBookmarks(library, ids, (bookmark) => ({ tags: [...new Set([...bookmark.tags, ...tags])] }));
}

export function pruneTrash(library: Library, now: Date): Library {
  const cutoff = now.getTime() - TRASH_MS;
  const expired = library.bookmarks
    .filter((bookmark) => bookmark.trashedAt !== null && new Date(bookmark.trashedAt).getTime() < cutoff)
    .map((bookmark) => bookmark.id);
  return expired.length ? deleteBookmarks(library, expired) : library;
}

export function addCollection(library: Library, collection: Collection): Library {
  return { ...library, collections: [...library.collections, collection] };
}

export function renameCollection(library: Library, id: string, name: string): Library {
  const next = name.trim();
  if (!next) return library;
  return { ...library, collections: library.collections.map((c) => (c.id === id ? { ...c, name: next } : c)) };
}

// The collection and everything inside it.
export function collectionTree(collections: Collection[], id: string): string[] {
  const children = collections.filter((c) => c.parent === id).flatMap((c) => collectionTree(collections, c.id));
  return [id, ...children];
}

// Deleting a collection moves its bookmarks to Unsorted and its sub-collections to its parent.
export function deleteCollection(library: Library, id: string): Library {
  const gone = library.collections.find((c) => c.id === id);
  if (!gone) return library;
  return {
    collections: library.collections
      .filter((c) => c.id !== id)
      .map((c) => (c.parent === id ? { ...c, parent: gone.parent } : c)),
    bookmarks: library.bookmarks.map((b) => (b.collection === id ? { ...b, collection: null } : b)),
  };
}

// A collection cannot move into itself or one of its own children.
export function moveCollection(library: Library, id: string, parent: string | null): Library {
  if (parent !== null && collectionTree(library.collections, id).includes(parent)) return library;
  return { ...library, collections: library.collections.map((c) => (c.id === id ? { ...c, parent } : c)) };
}

// Finds a collection by its "A/B/C" path, creating missing ones. Used by import.
export function ensurePath(library: Library, path: string[], newId: () => string): { library: Library; id: string | null } {
  let current: string | null = null;
  let next = library;
  for (const name of path.map((part) => part.trim()).filter(Boolean)) {
    const found: Collection | undefined = next.collections.find((c) => c.parent === current && c.name === name);
    if (found) {
      current = found.id;
    } else {
      const created: Collection = { id: newId(), name, parent: current };
      next = addCollection(next, created);
      current = created.id;
    }
  }
  return { library: next, id: current };
}

export function pathOf(collections: Collection[], id: string | null): string[] {
  const path: string[] = [];
  for (let at = id; at; ) {
    const collection = collections.find((c) => c.id === at);
    if (!collection) break;
    path.unshift(collection.name);
    at = collection.parent;
  }
  return path;
}

export type BookmarkType = "link" | "image" | "video" | "audio" | "document";

export function typeOf(url: string): BookmarkType {
  const path = (() => {
    try {
      return new URL(url).pathname.toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  })();
  if (/\.(jpe?g|png|gif|webp|svg|avif)$/.test(path)) return "image";
  if (/\.(mp4|webm|mov|mkv)$/.test(path) || /(youtube\.com|youtu\.be|vimeo\.com)/.test(domainOf(url))) return "video";
  if (/\.(mp3|wav|ogg|flac|m4a)$/.test(path)) return "audio";
  if (/\.(pdf|docx?|xlsx?|pptx?|txt|epub)$/.test(path)) return "document";
  return "link";
}

export interface SearchQuery {
  text: string[];
  tags: string[];
  types: BookmarkType[];
  domains: string[];
  favorite: boolean;
  created: { op: ">" | "<" | "="; day: string }[];
}

// Raindrop-style operators: #tag, type:image, domain:x.com, created:2024-05, created:>2024-01-01, ❤ or is:favorite.
export function parseSearch(raw: string): SearchQuery {
  const query: SearchQuery = { text: [], tags: [], types: [], domains: [], favorite: false, created: [] };
  for (const word of raw.trim().split(/\s+/).filter(Boolean)) {
    const lower = word.toLowerCase();
    if (lower === "❤" || lower === "❤️" || lower === "is:favorite") query.favorite = true;
    else if (lower.startsWith("#") && lower.length > 1) query.tags.push(lower.slice(1));
    else if (lower.startsWith("type:")) query.types.push(lower.slice(5) as BookmarkType);
    else if (lower.startsWith("domain:")) query.domains.push(lower.slice(7).replace(/^www\./, ""));
    else if (lower.startsWith("created:")) {
      const match = /^([<>]?)(\d{4}(?:-\d{2}(?:-\d{2})?)?)$/.exec(lower.slice(8));
      if (match) query.created.push({ op: (match[1] || "=") as ">" | "<" | "=", day: match[2] });
      else query.text.push(lower);
    } else query.text.push(lower);
  }
  return query;
}

export function matches(bookmark: Bookmark, query: SearchQuery): boolean {
  if (query.favorite && !bookmark.favorite) return false;
  if (!query.tags.every((tag) => bookmark.tags.includes(tag))) return false;
  if (query.types.length && !query.types.includes(typeOf(bookmark.url))) return false;
  if (query.domains.length && !query.domains.some((d) => domainOf(bookmark.url).endsWith(d))) return false;
  const day = bookmark.created.slice(0, 10);
  // Compares only as much of the date as was typed, so created:>2024-05 means after May 2024.
  const ok = query.created.every(({ op, day: want }) => {
    const part = day.slice(0, want.length);
    return op === "=" ? part === want : op === ">" ? part > want : part < want;
  });
  if (!ok) return false;
  const haystack = [bookmark.title, bookmark.url, bookmark.note, ...bookmark.tags, ...bookmark.highlights].join(" ").toLowerCase();
  return query.text.every((word) => haystack.includes(word));
}

export type Scope =
  | { kind: "all" }
  | { kind: "favorites" }
  | { kind: "unsorted" }
  | { kind: "trash" }
  | { kind: "reminders" }
  | { kind: "broken" }
  | { kind: "duplicates" }
  | { kind: "collection"; id: string }
  | { kind: "tag"; tag: string };

export function duplicateIds(bookmarks: Bookmark[]): Set<string> {
  const seen = new Map<string, string[]>();
  for (const bookmark of bookmarks) {
    const key = normalizeUrl(bookmark.url);
    seen.set(key, [...(seen.get(key) ?? []), bookmark.id]);
  }
  return new Set([...seen.values()].filter((ids) => ids.length > 1).flat());
}

export function visibleBookmarks(library: Library, scope: Scope, search: string): Bookmark[] {
  const live = library.bookmarks.filter((b) => b.trashedAt === null);
  const dupes = scope.kind === "duplicates" ? duplicateIds(live) : null;
  const inScope = (() => {
    switch (scope.kind) {
      case "trash":
        return library.bookmarks.filter((b) => b.trashedAt !== null);
      case "favorites":
        return live.filter((b) => b.favorite);
      case "unsorted":
        return live.filter((b) => b.collection === null);
      case "reminders":
        return live.filter((b) => b.remindAt !== null).sort((a, b) => a.remindAt!.localeCompare(b.remindAt!));
      case "broken":
        return live.filter((b) => b.broken === true);
      case "duplicates":
        return live.filter((b) => dupes!.has(b.id));
      case "collection": {
        const ids = new Set(collectionTree(library.collections, scope.id));
        return live.filter((b) => b.collection !== null && ids.has(b.collection));
      }
      case "tag":
        return live.filter((b) => b.tags.includes(scope.tag));
      default:
        return live;
    }
  })();
  const query = parseSearch(search);
  const found = inScope.filter((b) => matches(b, query));
  // Newest first, except reminders which are soonest first and duplicates which sit together.
  if (scope.kind === "reminders") return found;
  if (scope.kind === "duplicates") return found.sort((a, b) => normalizeUrl(a.url).localeCompare(normalizeUrl(b.url)));
  return found.sort((a, b) => b.created.localeCompare(a.created));
}

export const dueReminders = (library: Library, now: Date) =>
  library.bookmarks.filter((b) => b.trashedAt === null && b.remindAt !== null && new Date(b.remindAt) <= now);

export function allTags(bookmarks: Bookmark[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const bookmark of bookmarks) if (bookmark.trashedAt === null) for (const tag of bookmark.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

const isString = (value: unknown): value is string => typeof value === "string";
const stringOrNull = (value: unknown) => (isString(value) ? value : null);

// Saved data can be missing or damaged; anything unreadable is dropped rather than stopping the app.
export function loadLibrary(storage: Pick<Storage, "getItem">): Library {
  let saved: unknown = null;
  try {
    saved = JSON.parse(storage.getItem(BOOKMARKS_KEY) ?? "null");
  } catch {
    // fall through to an empty library
  }
  const raw = (saved ?? {}) as { bookmarks?: unknown; collections?: unknown };
  const collections = (Array.isArray(raw.collections) ? raw.collections : []).flatMap((c: Partial<Collection>) =>
    isString(c?.id) && isString(c?.name) ? [{ id: c.id, name: c.name, parent: stringOrNull(c.parent) }] : [],
  );
  const bookmarks = (Array.isArray(raw.bookmarks) ? raw.bookmarks : []).flatMap((b: Partial<Bookmark>) => {
    if (!isString(b?.id) || !isString(b?.url)) return [];
    const base = createBookmark(b.url, b.id, new Date(0));
    return [
      {
        ...base,
        title: isString(b.title) ? b.title : base.title,
        note: isString(b.note) ? b.note : "",
        tags: Array.isArray(b.tags) ? b.tags.filter(isString) : [],
        collection: isString(b.collection) && collections.some((c) => c.id === b.collection) ? b.collection : null,
        favorite: b.favorite === true,
        trashedAt: stringOrNull(b.trashedAt),
        created: isString(b.created) ? b.created : base.created,
        cover: stringOrNull(b.cover),
        favicon: stringOrNull(b.favicon),
        highlights: Array.isArray(b.highlights) ? b.highlights.filter(isString) : [],
        remindAt: stringOrNull(b.remindAt),
        broken: typeof b.broken === "boolean" ? b.broken : null,
      },
    ];
  });
  return { bookmarks, collections };
}

export function saveLibrary(storage: Pick<Storage, "setItem">, library: Library): void {
  try {
    storage.setItem(BOOKMARKS_KEY, JSON.stringify(library));
  } catch {
    // Storage can be full or blocked; the in-memory library still works.
  }
}
