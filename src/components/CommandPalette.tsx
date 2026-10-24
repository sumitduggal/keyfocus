import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import type { Command, Feature } from "../types";
import { featureMeta } from "../constants";

interface SearchResult {
  id: string;
  feature: string;
  title: string;
}

// Where the footer is shown, the bar sits in it. Below that the footer is hidden and the bar floats.
const FOOTER_QUERY = "(min-width: 760px)";
const subscribeFooter = (onChange: () => void) => {
  const query = window.matchMedia(FOOTER_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};
const footerShown = () => window.matchMedia(FOOTER_QUERY).matches;

interface CommandPaletteProps {
  barHost: HTMLElement | null;
  menuOpen: boolean;
  searchMode: boolean;
  featureMenu: Feature | null;
  trashMenu: boolean;
  trashRows: { id: string; title: string; hint: string }[];
  showTrashRow: boolean;
  trashCount: number;
  onRestoreTrash: (id: string) => void;
  onOpenTrash: () => void;
  query: string;
  visibleCommands: Command[];
  searchResults: SearchResult[];
  featureEntries: SearchResult[];
  menuFocusIndex: number;
  activeMenuId: string | undefined;
  actionInputRef: React.RefObject<HTMLInputElement | null>;
  reduceMotion: boolean;
  onQueryChange: (value: string) => void;
  onFocus: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onRunCommand: (command: Command) => void;
  onCreateFeature: (feature: Feature) => void;
  onSelectResult: (id: string) => void;
}

// DOM id of a row. The active row's id is what aria-activedescendant points at.
const commandDomId = (command: string) => `action-${command.replaceAll(" ", "-")}`;
const resultDomId = (id: string) => `result-${id}`;
const NEW_ROW_ID = "new";

export function CommandPalette({
  barHost,
  menuOpen,
  searchMode,
  featureMenu,
  trashMenu,
  trashRows,
  showTrashRow,
  trashCount,
  onRestoreTrash,
  onOpenTrash,
  query,
  visibleCommands,
  searchResults,
  featureEntries,
  menuFocusIndex,
  activeMenuId,
  actionInputRef,
  reduceMotion,
  onQueryChange,
  onFocus,
  onKeyDown,
  onRunCommand,
  onCreateFeature,
  onSelectResult,
}: CommandPaletteProps) {
  const activeDomId = activeMenuId
    ? activeMenuId === NEW_ROW_ID
      ? commandDomId(`new-${featureMenu ?? ""}`)
      : searchMode || featureMenu
        ? resultDomId(activeMenuId)
        : commandDomId(activeMenuId)
    : undefined;

  const placeholder = searchMode
    ? "Search created features…"
    : featureMenu
      ? `Filter ${featureMeta[featureMenu].frame.title} or create one…`
      : "Run a command or search…";

  const inFooter = useSyncExternalStore(subscribeFooter, footerShown);
  const bar = (
    <motion.div
      className="command-wrap"
      animate={menuOpen ? { scaleX: 1.04, scaleY: 1.04 } : { scaleX: 1, scaleY: 1 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.18, ease: "easeOut" }}
    >
      <span className="command-mark" aria-hidden="true">
        ⌖
      </span>
      <input
        ref={actionInputRef}
        aria-label="Open actions"
        aria-controls="action-menu"
        aria-activedescendant={menuOpen && activeDomId ? activeDomId : undefined}
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
      />
      <kbd>⌘K</kbd>
    </motion.div>
  );

  return (
    <>
      {inFooter && barHost ? createPortal(bar, barHost) : bar}

      {menuOpen && (
        <motion.div
          className="menu-layer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.12 }}
        >
          <motion.div
            className="menu"
            id="action-menu"
            role="menu"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            transition={{
              duration: reduceMotion ? 0 : 0.16,
              ease: "easeOut",
            }}
          >
            <p className="menu-label">
              {searchMode
                ? "Search created features"
                : trashMenu
                  ? "Recently deleted · Esc to go back"
                  : featureMenu
                  ? `${featureMeta[featureMenu].frame.title} · Esc to go back`
                  : query
                    ? "Matching actions"
                    : "Create or search"}
            </p>
            {searchMode ? (
              searchResults.length ? (
                searchResults.map((frame, index) => (
                  <button
                    key={frame.id}
                    id={resultDomId(frame.id)}
                    role="menuitem"
                    aria-selected={index === menuFocusIndex}
                    type="button"
                    className={index === menuFocusIndex ? "selected" : ""}
                    onMouseEnter={() => {}}
                    onClick={() => onSelectResult(frame.id)}
                  >
                    <span className="command-glyph">
                      {featureMeta[frame.feature as keyof typeof featureMeta]?.glyph}
                    </span>
                    <span>
                      <b>{frame.title}</b>
                      <small>{frame.feature}</small>
                    </span>
                    <kbd>↵</kbd>
                  </button>
                ))
              ) : (
                <p className="empty-command">No matching features</p>
              )
            ) : trashMenu ? (
              trashRows.length ? (
                trashRows.map((row, index) => (
                  <button
                    key={row.id}
                    id={resultDomId(row.id)}
                    role="menuitem"
                    aria-selected={index === menuFocusIndex}
                    type="button"
                    className={index === menuFocusIndex ? "selected" : ""}
                    onMouseEnter={() => {}}
                    onClick={() => onRestoreTrash(row.id)}
                  >
                    <span className="command-glyph">↺</span>
                    <span>
                      <b>{row.title}</b>
                      <small>{row.hint} · Restore</small>
                    </span>
                    <kbd>↵</kbd>
                  </button>
                ))
              ) : (
                <p className="empty-command">Nothing recently deleted</p>
              )
            ) : featureMenu ? (
              <>
                <button
                  id={commandDomId(`new-${featureMenu}`)}
                  role="menuitem"
                  aria-selected={menuFocusIndex === 0}
                  type="button"
                  className={menuFocusIndex === 0 ? "menu-child selected" : "menu-child"}
                  onMouseEnter={() => {}}
                  onClick={() => onCreateFeature(featureMenu)}
                >
                  <span className="command-glyph">+</span>
                  <span>
                    <b>New {featureMeta[featureMenu].frame.title}</b>
                    <small>{featureMeta[featureMenu].description}</small>
                  </span>
                  <kbd>↵</kbd>
                </button>
                {featureEntries.map((entry, index) => (
                  <button
                    key={entry.id}
                    id={resultDomId(entry.id)}
                    role="menuitem"
                    aria-selected={index + 1 === menuFocusIndex}
                    type="button"
                    className={index + 1 === menuFocusIndex ? "menu-child selected" : "menu-child"}
                    onMouseEnter={() => {}}
                    onClick={() => onSelectResult(entry.id)}
                  >
                    <span className="command-glyph">{featureMeta[featureMenu].glyph}</span>
                    <span>
                      <b>{entry.title}</b>
                      <small>Open existing</small>
                    </span>
                    <kbd>↵</kbd>
                  </button>
                ))}
              </>
            ) : visibleCommands.length || showTrashRow ? (
              <>
              {visibleCommands.map((command, index) =>
                command === "Search" ? (
                  <button
                    key={command}
                    id={commandDomId(command)}
                    role="menuitem"
                    aria-selected={index === menuFocusIndex}
                    type="button"
                    className={index === menuFocusIndex ? "selected" : ""}
                    onMouseEnter={() => {}}
                    onClick={() => onRunCommand(command)}
                  >
                    <span className="command-glyph">⌕</span>
                    <span>
                      <b>Search</b>
                      <small>Find an existing feature</small>
                    </span>
                    <kbd>↵</kbd>
                  </button>
                ) : (
                  <button
                    key={command}
                    id={commandDomId(command)}
                    role="menuitem"
                    aria-selected={index === menuFocusIndex}
                    type="button"
                    className={index === menuFocusIndex ? "selected" : ""}
                    onMouseEnter={() => {}}
                    onClick={() => onRunCommand(command)}
                  >
                    <span className="command-glyph">{featureMeta[command].glyph}</span>
                    <span>
                      <b>{featureMeta[command].frame.title}</b>
                      <small>{featureMeta[command].description}</small>
                    </span>
                    <kbd>↵</kbd>
                  </button>
                ),
              )}
              {showTrashRow && (
                <button
                  id="action-trash"
                  role="menuitem"
                  aria-selected={visibleCommands.length === menuFocusIndex}
                  type="button"
                  className={visibleCommands.length === menuFocusIndex ? "selected" : ""}
                  onMouseEnter={() => {}}
                  onClick={onOpenTrash}
                >
                  <span className="command-glyph">↺</span>
                  <span>
                    <b>Recently deleted</b>
                    <small>{trashCount} to restore for seven days</small>
                  </span>
                  <kbd>↵</kbd>
                </button>
              )}
              </>
            ) : (
              <p className="empty-command">No matching actions</p>
            )}
          </motion.div>
        </motion.div>
      )}
    </>
  );
}
