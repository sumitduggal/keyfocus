import { useRef, useState } from "react";
import { countDuplicates, detectFormat, exportAs, mergeImport, parseImport, type Format, type ImportedBookmark } from "../bookmarks-io";
import { getLibrary, updateLibrary } from "../bookmarks-store";
import { Notice } from "./Notice";

// Import and export for the bookmarks library, shown inside the Settings panel.
export function BookmarksSettings() {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<{ rows: ImportedBookmark[]; duplicates: number } | null>(null);

  const finish = (rows: ImportedBookmark[], skipDuplicates: boolean) => {
    const result = mergeImport(getLibrary(), rows, skipDuplicates, () => crypto.randomUUID(), new Date());
    updateLibrary(result.library);
    setPending(null);
    setMessage(
      `Imported ${result.added} bookmark${result.added === 1 ? "" : "s"}${result.duplicates ? `, ${result.duplicates} duplicate${result.duplicates === 1 ? "" : "s"} ${skipDuplicates ? "skipped" : "kept"}` : ""}.`,
    );
  };

  const read = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    const format = detectFormat(file.name, text);
    const rows = format ? parseImport(format, text) : [];
    if (rows.length === 0) return setMessage("No bookmarks found in that file.");
    const duplicates = countDuplicates(getLibrary(), rows);
    if (duplicates > 0) {
      setMessage(null);
      setPending({ rows, duplicates });
    } else finish(rows, true);
  };

  const download = (format: Format) => {
    const { text, mime, name } = exportAs(format, getLibrary());
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([text], { type: mime }));
    link.download = name;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <>
      <div className="settings-row">
        <span>
          <b>Bookmarks import</b>
          <small>Browser HTML, CSV or JSON</small>
        </span>
        <button type="button" onClick={() => fileRef.current?.click()}>
          Import
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".html,.htm,.csv,.json,text/html,text/csv,application/json"
          hidden
          aria-label="Import bookmarks file"
          onChange={(event) => {
            void read(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>
      {pending && (
        <div className="settings-row settings-note" role="alertdialog" aria-label="Duplicates found">
          <span>
            <b>{pending.duplicates} of {pending.rows.length} already saved</b>
            <small>Skip them, or import everything?</small>
          </span>
          <span className="settings-controls">
            <button type="button" onClick={() => finish(pending.rows, true)}>Skip</button>
            <button type="button" onClick={() => finish(pending.rows, false)}>Import all</button>
            <button type="button" aria-label="Cancel import" onClick={() => setPending(null)}>×</button>
          </span>
        </div>
      )}
      <div className="settings-row">
        <span>
          <b>Bookmarks export</b>
          <small>Backup or move to another app</small>
        </span>
        <span className="settings-controls">
          {(["html", "csv", "json"] as Format[]).map((format) => (
            <button key={format} type="button" onClick={() => download(format)}>
              {format.toUpperCase()}
            </button>
          ))}
        </span>
      </div>
      {message && (
        <Notice presentation="inline" tone="neutral" announcement="polite" className="settings-message">
          {message}
        </Notice>
      )}
    </>
  );
}
