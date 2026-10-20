import { motion } from "motion/react";
import type { Command } from "../types";
import { featureMeta } from "../constants";

interface SearchResult {
  id: string;
  feature: string;
  title: string;
}

interface CommandPaletteProps {
  menuOpen: boolean;
  searchMode: boolean;
  query: string;
  visibleCommands: Command[];
  searchResults: SearchResult[];
  menuFocusIndex: number;
  activeMenuId: string | undefined;
  actionInputRef: React.RefObject<HTMLInputElement | null>;
  reduceMotion: boolean;
  onQueryChange: (value: string) => void;
  onFocus: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onRunCommand: (command: Command) => void;
  onSelectResult: (id: string) => void;
}

export function CommandPalette({
  menuOpen,
  searchMode,
  query,
  visibleCommands,
  searchResults,
  menuFocusIndex,
  activeMenuId,
  actionInputRef,
  reduceMotion,
  onQueryChange,
  onFocus,
  onKeyDown,
  onRunCommand,
  onSelectResult,
}: CommandPaletteProps) {
  const activeLabel = activeMenuId
    ? searchMode
      ? `result-${activeMenuId}`
      : `action-${activeMenuId.toLowerCase().replaceAll(" ", "-")}`
    : undefined;

  return (
    <>
      <motion.div
        className="command-wrap"
        animate={menuOpen ? { scaleX: 1.2, scaleY: 1.2 } : { scaleX: 1, scaleY: 1 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.18, ease: "easeOut" }}
      >
        <input
          ref={actionInputRef}
          aria-label="Open actions"
          aria-controls="action-menu"
          aria-activedescendant={menuOpen && activeMenuId ? activeLabel : undefined}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onFocus={onFocus}
          onKeyDown={onKeyDown}
          placeholder={searchMode ? "Search created features…" : "Choose an action…"}
        />
        <kbd>⌘K</kbd>
      </motion.div>

      {menuOpen && (
        <motion.div
          className="menu-layer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.12 }}
          onMouseDown={(event) => event.target === event.currentTarget}
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
                : query
                  ? "Matching actions"
                  : "Create or search"}
            </p>
            {searchMode ? (
              searchResults.length ? (
                searchResults.map((frame, index) => (
                  <button
                    key={frame.id}
                    id={`result-${frame.id}`}
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
            ) : visibleCommands.length ? (
              visibleCommands.map((command, index) =>
                command === "Search" ? (
                  <button
                    key={command}
                    id="action-search"
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
                    id={`action-${command.replaceAll(" ", "-")}`}
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
              )
            ) : (
              <p className="empty-command">No matching actions</p>
            )}
          </motion.div>
        </motion.div>
      )}
    </>
  );
}
