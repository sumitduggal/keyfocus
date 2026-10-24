import { useCallback } from "react";
import { motion } from "motion/react";
import type { WorkspaceFrame } from "../types";
import { featureMeta } from "../constants";

interface StackProps {
  stackedFrames: WorkspaceFrame[];
  stackFocusIndex: number;
  stackRefs: Record<string, HTMLElement | null>;
  reduceMotion: boolean;
  onSelect: (index: number) => void;
}

export function Stack({
  stackedFrames,
  stackFocusIndex,
  stackRefs,
  reduceMotion,
  onSelect,
}: StackProps) {
  const handleFocus = useCallback(
    (index: number) => {
      onSelect(index);
    },
    [onSelect],
  );

  return (
    <div className="frame-stack">
      {stackedFrames.length === 0 && (
        <div className="stack-empty" aria-hidden="true">
          <span className="stack-empty-scope" />
          <b>No stacked frames</b>
          <small>Promote a frame from the command palette to build context here.</small>
          <span className="stack-empty-code">STACK // 00</span>
        </div>
      )}

      {stackedFrames.map((frame, index) => (
        <motion.div
          className={index === stackFocusIndex ? "stack-item previewed" : "stack-item"}
          key={frame.id}
          animate={{
            y: index * 104,
            x: index * 5,
            opacity: 1 - Math.min(index, 4) * 0.08,
          }}
          transition={
            reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 32 }
          }
          style={{ zIndex: stackedFrames.length - index }}
        >
          <div
            ref={(node) => {
              stackRefs[frame.id] = node;
            }}
            className="stack-frame"
            aria-label={`Frame: ${frame.title}`}
            role="button"
            tabIndex={-1}
            onFocus={() => handleFocus(index)}
            onClick={() => handleFocus(index)}
          >
            <span className="stack-line">
              <span className="stack-index">{String(index + 1).padStart(2, "0")}</span>
              <span className="stack-feature">
                <i aria-hidden="true">{featureMeta[frame.feature].glyph}</i>
                {frame.feature}
              </span>
              <span className="stack-target" aria-hidden="true">
                ◎
              </span>
            </span>
            <b>{frame.title}</b>
            <small>{frame.description}</small>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
