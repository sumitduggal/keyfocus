import { useCallback, useEffect } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { Feature, WorkspaceFrame } from "../types";
import { featureMeta } from "../constants";

interface FeaturePanelProps {
  featurePanel: Feature;
  featureEntries: WorkspaceFrame[];
  featureAnchorY: number | null;
  entryFocusIndex: number;
  featureAsideRef: React.RefObject<HTMLElement | null>;
  registerEntry: (id: string, node: HTMLButtonElement | null) => void;
  getEntry: (id: string) => HTMLButtonElement | null;
  onClose: () => void;
  onCreate?: () => void;
  onEntryClick: (frame: WorkspaceFrame) => void;
}

export function FeaturePanel({
  featurePanel,
  featureEntries,
  featureAnchorY,
  entryFocusIndex,
  featureAsideRef,
  registerEntry,
  getEntry,
  onClose,
  onCreate,
  onEntryClick,
}: FeaturePanelProps) {
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    const closeWhenFocusLeaves = (event: FocusEvent) => {
      if (featureAsideRef.current && !featureAsideRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("focusin", closeWhenFocusLeaves);
    return () => document.removeEventListener("focusin", closeWhenFocusLeaves);
  }, [featureAsideRef, onClose]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (!featureEntries.length) return;
        const delta = event.key === "ArrowDown" ? 1 : -1;
        const next = Math.max(0, Math.min(featureEntries.length - 1, entryFocusIndex + delta));
        const entry = featureEntries[next];
        if (entry) getEntry(entry.id)?.focus();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        // Close the panel without also sending the global Escape to the command bar.
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        event.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled])"),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === event.currentTarget)
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [featureEntries, entryFocusIndex, getEntry, onClose],
  );

  return (
    <motion.aside
      ref={featureAsideRef}
      className="feature-aside"
      style={{ top: featureAnchorY ?? "50%" }}
      initial={reduceMotion ? false : { opacity: 0, x: 14, y: "-50%" }}
      animate={{ opacity: 1, x: 0, y: "-50%" }}
      transition={{ type: "spring", stiffness: 520, damping: 36 }}
      aria-label={`${featureMeta[featurePanel].frame.title} entries`}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      <div className="feature-aside-heading">
        <span>{featureMeta[featurePanel].glyph}</span>
        <b>{featureMeta[featurePanel].frame.title}</b>
        <button type="button" aria-label="Close feature entries" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="feature-entry-list">
        {onCreate && (
          <button type="button" className="feature-new" onClick={onCreate}>
            <span className="feature-entry-index">+</span>
            <span className="feature-entry-copy">
              <b>New {featureMeta[featurePanel].frame.title}</b>
              <small>{featureMeta[featurePanel].description}</small>
            </span>
          </button>
        )}
        {featureEntries.length
          ? featureEntries.map((frame, index) => (
              <button
                key={frame.id}
                ref={(node) => {
                  registerEntry(frame.id, node);
                }}
                type="button"
                className={index === entryFocusIndex ? "entry-selected" : ""}
                onFocus={() => {}}
                onClick={() => onEntryClick(frame)}
              >
                <span className="feature-entry-index">{String(index + 1).padStart(2, "0")}</span>
                <span className="feature-entry-copy">
                  <b>{frame.title}</b>
                  <small>{frame.description}</small>
                </span>
              </button>
            ))
          : featureMeta[featurePanel].frame.details.map((entry, index) => (
              <button key={entry} type="button">
                <span className="feature-entry-index">{String(index + 1).padStart(2, "0")}</span>
                <span className="feature-entry-copy">
                  <b>{entry}</b>
                  <small>New entry</small>
                </span>
              </button>
            ))}
      </div>
    </motion.aside>
  );
}
