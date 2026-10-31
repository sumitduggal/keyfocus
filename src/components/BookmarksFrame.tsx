import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { DragEvent, FormEvent } from "react";
import {
  addCollection,
  addTags,
  allTags,
  cleanUrl,
  collectionTree,
  createBookmark,
  deleteBookmarks,
  deleteCollection,
  domainOf,
  dueReminders,
  duplicateIds,
  findDuplicate,
  parseTags,
  renameCollection,
  restoreBookmarks,
  trashBookmarks,
  updateBookmarks,
  visibleBookmarks,
  type Bookmark,
  type Collection,
  type Library,
  type Scope,
} from "../bookmarks";
import { getLibrary, subscribeLibrary, updateLibrary } from "../bookmarks-store";
import { Notice } from "./Notice";

type View = "list" | "grid" | "headlines" | "masonry";
const VIEWS: View[] = ["list", "grid", "headlines", "masonry"];
const VIEW_KEY = "focus-space-bookmarks-view";

interface Meta {
  title?: string;
  image?: string | null;
  favicon?: string | null;
}

// Asks the BFF for a page's title, cover and icon. Failure is fine: the bookmark keeps its domain as title.
async function fetchMeta(url: string): Promise<Meta | null> {
  try {
    const response = await fetch(`/api/og?url=${encodeURIComponent(url)}`);
    return response.ok ? ((await response.json()) as Meta) : null;
  } catch {
    return null;
  }
}

async function checkLink(url: string): Promise<boolean | null> {
  try {
    const response = await fetch(`/api/og?url=${encodeURIComponent(url)}&check=1`);
    return response.ok ? ((await response.json()) as { ok: boolean }).ok : null;
  } catch {
    return null;
  }
}

const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

const scopeKey = (scope: Scope) => JSON.stringify(scope);

export function BookmarksFrame() {
  const library = useSyncExternalStore(subscribeLibrary, getLibrary);
  const [scope, setScope] = useState<Scope>({ kind: "all" });
  const [search, setSearch] = useState("");
  const [view, setView] = useState<View>(() => {
    const saved = localStorage.getItem(VIEW_KEY);
    return VIEWS.includes(saved as View) ? (saved as View) : "list";
  });
  const [url, setUrl] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [bulkTags, setBulkTags] = useState("");
  const [checking, setChecking] = useState(false);
  const notified = useRef(new Set<string>());

  const change = updateLibrary;

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch {
      // The view just resets on reload.
    }
  }, [view]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const due = useMemo(() => dueReminders(library, now), [library, now]);
  // A browser notification once per due bookmark, when the person has allowed notifications.
  useEffect(() => {
    for (const bookmark of due) {
      if (notified.current.has(bookmark.id)) continue;
      notified.current.add(bookmark.id);
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification("Bookmark reminder", { body: bookmark.title });
      }
    }
  }, [due]);

  const bookmarks = useMemo(() => visibleBookmarks(library, scope, search), [library, scope, search]);
  const tags = useMemo(() => allTags(library.bookmarks), [library.bookmarks]);
  const dupes = useMemo(() => duplicateIds(library.bookmarks.filter((b) => b.trashedAt === null)), [library.bookmarks]);
  const dueIds = new Set(due.map((b) => b.id));
  const live = library.bookmarks.filter((b) => b.trashedAt === null);
  const inTrash = scope.kind === "trash";
  // Selection only counts what is on screen, so a bulk action never touches hidden bookmarks.
  const chosen = selected.filter((id) => bookmarks.some((b) => b.id === id));

  const patch = (ids: string[], values: Partial<Bookmark>) => change((current) => updateBookmarks(current, ids, values));

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const clean = cleanUrl(url);
    if (!clean) return setNotice("That does not look like a web address.");
    const existing = findDuplicate(library.bookmarks, clean);
    if (existing) {
      setNotice(existing.trashedAt ? `"${existing.title}" is in the trash.` : `Already saved as "${existing.title}".`);
      return;
    }
    const id = crypto.randomUUID();
    const collection = scope.kind === "collection" ? scope.id : null;
    const tag = scope.kind === "tag" ? [scope.tag] : [];
    change((current) => ({
      ...current,
      bookmarks: [createBookmark(clean, id, new Date(), { collection, tags: tag }), ...current.bookmarks],
    }));
    setUrl("");
    const meta = await fetchMeta(clean);
    if (meta) {
      patch([id], {
        ...(meta.title ? { title: meta.title } : {}),
        cover: meta.image ?? null,
        favicon: meta.favicon ?? null,
      });
    }
  };

  const remove = (ids: string[]) => {
    if (inTrash) change((current) => deleteBookmarks(current, ids));
    else change((current) => trashBookmarks(current, ids, new Date()));
    setSelected((current) => current.filter((id) => !ids.includes(id)));
    if (!inTrash) setNotice(`${ids.length} moved to trash. Open Trash to restore.`);
  };

  // Checks every live link, four at a time, and marks the ones that no longer answer.
  const checkAll = async () => {
    setChecking(true);
    const queue = [...live];
    let found = 0;
    const worker = async () => {
      for (let next = queue.shift(); next; next = queue.shift()) {
        const ok = await checkLink(next.url);
        if (ok === false) found++;
        if (ok !== null) change((current) => updateBookmarks(current, [next.id], { broken: !ok }));
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    setChecking(false);
    setNotice(found ? `${found} broken link${found === 1 ? "" : "s"} found.` : "All links answered.");
  };

  const drop = (event: DragEvent, collection: string | null) => {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/bookmark");
    if (!id) return;
    patch(selected.includes(id) ? selected : [id], { collection });
  };

  const addFolder = (parent: string | null) => {
    const name = window.prompt(parent ? "Sub-collection name" : "Collection name");
    if (name?.trim()) change((current) => addCollection(current, { id: crypto.randomUUID(), name: name.trim(), parent }));
  };

  const folderRows = (parent: string | null, depth: number): React.ReactNode[] =>
    library.collections
      .filter((c) => c.parent === parent)
      .flatMap((collection: Collection) => {
        const count = live.filter((b) => b.collection !== null && collectionTree(library.collections, collection.id).includes(b.collection)).length;
        return [
          <li key={collection.id} className="bm-folder" style={{ paddingLeft: depth * 12 }}>
            <button
              type="button"
              className={scopeKey(scope) === scopeKey({ kind: "collection", id: collection.id }) ? "is-active" : ""}
              onClick={() => setScope({ kind: "collection", id: collection.id })}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => drop(event, collection.id)}
            >
              <span>{collection.name}</span>
              <small>{count}</small>
            </button>
            <span className="bm-folder-actions">
              <button type="button" aria-label={`Add sub-collection to ${collection.name}`} onClick={() => addFolder(collection.id)}>+</button>
              <button
                type="button"
                aria-label={`Rename ${collection.name}`}
                onClick={() => {
                  const name = window.prompt("Rename collection", collection.name);
                  if (name) change((current) => renameCollection(current, collection.id, name));
                }}
              >
                ✎
              </button>
              <button
                type="button"
                aria-label={`Delete ${collection.name}`}
                onClick={() => {
                  if (!window.confirm(`Delete "${collection.name}"? Its bookmarks move to Unsorted.`)) return;
                  change((current) => deleteCollection(current, collection.id));
                  setScope({ kind: "all" });
                }}
              >
                ×
              </button>
            </span>
          </li>,
          ...folderRows(collection.id, depth + 1),
        ];
      });

  const smart: { scope: Scope; label: string; count?: number }[] = [
    { scope: { kind: "all" }, label: "All", count: live.length },
    { scope: { kind: "favorites" }, label: "Favorites", count: live.filter((b) => b.favorite).length },
    { scope: { kind: "unsorted" }, label: "Unsorted", count: live.filter((b) => b.collection === null).length },
    { scope: { kind: "reminders" }, label: due.length ? `Reminders (${due.length} due)` : "Reminders", count: live.filter((b) => b.remindAt).length },
    { scope: { kind: "duplicates" }, label: "Duplicates", count: dupes.size },
    { scope: { kind: "broken" }, label: "Broken", count: live.filter((b) => b.broken).length },
    { scope: { kind: "trash" }, label: "Trash", count: library.bookmarks.length - live.length },
  ];

  return (
    <div className="bm">
      <form className="todo-add bm-add" onSubmit={save}>
        <input
          value={url}
          placeholder="Paste a link, then Enter"
          aria-label="New bookmark address"
          onChange={(event) => setUrl(event.target.value)}
        />
      </form>

      <div className="bm-bar">
        <input
          type="search"
          value={search}
          placeholder="Search…  #tag  type:image  domain:x.com  created:>2025-01  ❤"
          aria-label="Search bookmarks"
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="bm-views" role="group" aria-label="View">
          {VIEWS.map((name) => (
            <button key={name} type="button" aria-pressed={view === name} className={view === name ? "is-active" : ""} onClick={() => setView(name)}>
              {name}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => void checkAll()} disabled={checking || live.length === 0}>
          {checking ? "Checking…" : "Check links"}
        </button>
      </div>

      {notice && (
        <Notice presentation="inline" tone="accent" announcement="polite" className="bm-notice">
          {notice}
        </Notice>
      )}

      <div className="bm-body">
        <nav className="bm-side" aria-label="Collections">
          <ul>
            {smart.map((entry) => (
              <li key={entry.label}>
                <button
                  type="button"
                  className={scopeKey(scope) === scopeKey(entry.scope) ? "is-active" : ""}
                  onClick={() => setScope(entry.scope)}
                  onDragOver={entry.scope.kind === "unsorted" ? (event) => event.preventDefault() : undefined}
                  onDrop={entry.scope.kind === "unsorted" ? (event) => drop(event, null) : undefined}
                >
                  <span>{entry.label}</span>
                  <small>{entry.count}</small>
                </button>
              </li>
            ))}
          </ul>
          <p className="bm-heading">
            Collections <button type="button" aria-label="New collection" onClick={() => addFolder(null)}>+</button>
          </p>
          <ul>{folderRows(null, 0)}</ul>
          {tags.length > 0 && (
            <>
              <p className="bm-heading">Tags</p>
              <ul className="bm-tags">
                {tags.map(({ tag, count }) => (
                  <li key={tag}>
                    <button
                      type="button"
                      className={scope.kind === "tag" && scope.tag === tag ? "is-active" : ""}
                      onClick={() => setScope({ kind: "tag", tag })}
                    >
                      #{tag} <small>{count}</small>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </nav>

        <div className="bm-main">
          {chosen.length > 0 && (
            <div className="bm-bulk" role="toolbar" aria-label="Bulk actions">
              <b>{chosen.length} selected</b>
              {inTrash ? (
                <button type="button" onClick={() => { change((c) => restoreBookmarks(c, chosen)); setSelected([]); }}>Restore</button>
              ) : (
                <>
                  <select
                    aria-label="Move selected to"
                    value=""
                    onChange={(event) => {
                      patch(chosen, { collection: event.target.value === "__none" ? null : event.target.value });
                      setSelected([]);
                    }}
                  >
                    <option value="" disabled>Move to…</option>
                    <option value="__none">Unsorted</option>
                    {library.collections.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      change((c) => addTags(c, chosen, parseTags(bulkTags)));
                      setBulkTags("");
                    }}
                  >
                    <input value={bulkTags} placeholder="Add tags" aria-label="Add tags to selected" onChange={(event) => setBulkTags(event.target.value)} />
                  </form>
                  <button type="button" onClick={() => patch(chosen, { favorite: true })}>★ Favorite</button>
                </>
              )}
              <button type="button" onClick={() => remove(chosen)}>{inTrash ? "Delete forever" : "Trash"}</button>
              <button type="button" onClick={() => setSelected([])}>Clear</button>
            </div>
          )}

          {bookmarks.length === 0 ? (
            <p className="bm-empty">{live.length === 0 && !inTrash ? "No bookmarks yet. Paste a link above or import a file." : "Nothing here."}</p>
          ) : (
            <ul className={`bm-items bm-${view}`}>
              {bookmarks.map((bookmark) => (
                <BookmarkItem
                  key={bookmark.id}
                  bookmark={bookmark}
                  view={view}
                  library={library}
                  checked={selected.includes(bookmark.id)}
                  editing={editing === bookmark.id}
                  isDue={dueIds.has(bookmark.id)}
                  isDuplicate={dupes.has(bookmark.id)}
                  inTrash={inTrash}
                  onCheck={(on) => setSelected((current) => (on ? [...current, bookmark.id] : current.filter((id) => id !== bookmark.id)))}
                  onEdit={() => setEditing(editing === bookmark.id ? null : bookmark.id)}
                  onPatch={(values) => patch([bookmark.id], values)}
                  onRemove={() => remove([bookmark.id])}
                  onRestore={() => change((current) => restoreBookmarks(current, [bookmark.id]))}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

interface ItemProps {
  bookmark: Bookmark;
  view: View;
  library: Library;
  checked: boolean;
  editing: boolean;
  isDue: boolean;
  isDuplicate: boolean;
  inTrash: boolean;
  onCheck: (on: boolean) => void;
  onEdit: () => void;
  onPatch: (values: Partial<Bookmark>) => void;
  onRemove: () => void;
  onRestore: () => void;
}

function BookmarkItem({ bookmark, view, library, checked, editing, isDue, isDuplicate, inTrash, onCheck, onEdit, onPatch, onRemove, onRestore }: ItemProps) {
  const [quote, setQuote] = useState("");
  const showCover = (view === "grid" || view === "masonry") && bookmark.cover;
  const collection = library.collections.find((c) => c.id === bookmark.collection);
  return (
    <li
      className={`bm-item${isDue ? " is-due" : ""}${bookmark.broken ? " is-broken" : ""}`}
      draggable
      onDragStart={(event) => event.dataTransfer.setData("text/bookmark", bookmark.id)}
    >
      {showCover && <img className="bm-cover" src={bookmark.cover!} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(event) => (event.currentTarget.hidden = true)} />}
      <div className="bm-row">
        <input type="checkbox" checked={checked} aria-label={`Select ${bookmark.title}`} onChange={(event) => onCheck(event.target.checked)} />
        {bookmark.favicon ? (
          <img className="bm-icon" src={bookmark.favicon} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(event) => (event.currentTarget.hidden = true)} />
        ) : (
          <span className="bm-icon bm-letter" aria-hidden="true">{domainOf(bookmark.url).charAt(0).toUpperCase()}</span>
        )}
        <div className="bm-text">
          <a href={bookmark.url} target="_blank" rel="noopener noreferrer">{bookmark.title}</a>
          {view !== "headlines" && (
            <small>
              {domainOf(bookmark.url)}
              {collection ? ` · ${collection.name}` : ""}
              {bookmark.broken ? " · broken" : ""}
              {isDuplicate ? " · duplicate" : ""}
              {bookmark.remindAt ? ` · ⏰ ${new Date(bookmark.remindAt).toLocaleString()}` : ""}
            </small>
          )}
          {view !== "headlines" && bookmark.note && <p>{bookmark.note}</p>}
          {view !== "headlines" && bookmark.tags.length > 0 && <small className="bm-tag-line">{bookmark.tags.map((t) => `#${t}`).join(" ")}</small>}
        </div>
        <span className="bm-actions">
          {inTrash ? (
            <>
              <button type="button" onClick={onRestore}>Restore</button>
              <button type="button" onClick={onRemove}>Delete</button>
            </>
          ) : (
            <>
              <button type="button" className="bm-fav" aria-pressed={bookmark.favorite} aria-label={bookmark.favorite ? "Remove from favorites" : "Add to favorites"} onClick={() => onPatch({ favorite: !bookmark.favorite })}>
                {bookmark.favorite ? "★" : "☆"}
              </button>
              <button type="button" aria-expanded={editing} onClick={onEdit}>Edit</button>
              <button type="button" aria-label={`Trash ${bookmark.title}`} onClick={onRemove}>×</button>
            </>
          )}
        </span>
      </div>
      {editing && !inTrash && (
        <div className="bm-edit">
          <label>Title <input defaultValue={bookmark.title} onBlur={(event) => onPatch({ title: event.target.value.trim() || bookmark.title })} /></label>
          <label>Note <textarea defaultValue={bookmark.note} rows={2} onBlur={(event) => onPatch({ note: event.target.value })} /></label>
          <label>Tags <input defaultValue={bookmark.tags.join(", ")} placeholder="comma separated" onBlur={(event) => onPatch({ tags: parseTags(event.target.value) })} /></label>
          <label>
            Collection
            <select value={bookmark.collection ?? ""} onChange={(event) => onPatch({ collection: event.target.value || null })}>
              <option value="">Unsorted</option>
              {library.collections.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label>
            Remind me
            <input
              type="datetime-local"
              value={toLocalInput(bookmark.remindAt)}
              onChange={(event) => {
                onPatch({ remindAt: event.target.value ? new Date(event.target.value).toISOString() : null });
                if (event.target.value && typeof Notification !== "undefined" && Notification.permission === "default") void Notification.requestPermission();
              }}
            />
          </label>
          <div className="bm-highlights">
            Highlights
            <ul>
              {bookmark.highlights.map((text, index) => (
                <li key={index}>
                  “{text}” <button type="button" aria-label="Remove highlight" onClick={() => onPatch({ highlights: bookmark.highlights.filter((_, i) => i !== index) })}>×</button>
                </li>
              ))}
            </ul>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (!quote.trim()) return;
                onPatch({ highlights: [...bookmark.highlights, quote.trim()] });
                setQuote("");
              }}
            >
              <input value={quote} placeholder="Paste a quote, then Enter" aria-label="New highlight" onChange={(event) => setQuote(event.target.value)} />
            </form>
          </div>
        </div>
      )}
    </li>
  );
}
