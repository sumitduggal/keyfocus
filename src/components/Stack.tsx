import { useCallback } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { WorkspaceFrame } from "../types";
import { featureMeta } from "../constants";

// Distance in pixels from one card to the next. A card is about 90px tall, so the rest is the gap.
const CARD_STEP = 112;

interface StackProps {
  stackedFrames: WorkspaceFrame[];
  stackFocusIndex: number;
  registerStack: (id: string, node: HTMLElement | null) => void;
  reduceMotion: boolean;
  collapsed?: boolean;
  onSelect: (index: number) => void;
  onPromote: (index: number) => void;
}

export function Stack({
  stackedFrames,
  stackFocusIndex,
  registerStack,
  reduceMotion,
  collapsed = false,
  onSelect,
  onPromote,
}: StackProps) {
  const handleFocus = useCallback(
    (index: number) => {
      onSelect(index);
    },
    [onSelect],
  );

  // Collapsed, the stack is a slim rail: a count, then one icon per frame. Frames keep their names
  // for screen readers and as tooltips, and register for focus like the full cards do.
  if (collapsed) {
    return (
      <div className="stack-rail">
        <span className="stack-rail-count" aria-label={`${stackedFrames.length} stacked frames`}>
          {String(stackedFrames.length).padStart(2, "0")}
        </span>
        <ol>
          {stackedFrames.map((frame, index) => (
            <li key={frame.id}>
              <button
                type="button"
                ref={(node) => {
                  registerStack(frame.id, node);
                }}
                className={index === stackFocusIndex ? "is-previewed" : undefined}
                aria-label={`Frame: ${frame.title}`}
                title={frame.title}
                tabIndex={-1}
                onFocus={() => handleFocus(index)}
                onClick={() => onPromote(index)}
              >
                {featureMeta[frame.feature].glyph}
              </button>
            </li>
          ))}
        </ol>
      </div>
    );
  }

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

      {/* A frame joining or leaving the stack fades and slides toward the main frame, so promoting one
          reads as a move, not a swap. */}
      <AnimatePresence initial={false}>
      {stackedFrames.map((frame, index) => (
        <motion.div
          className={index === stackFocusIndex ? "stack-item previewed" : "stack-item"}
          key={frame.id}
          initial={reduceMotion ? false : { opacity: 0, y: index * CARD_STEP, x: -24, rotateY: 22, scale: 0.94 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 48, scale: 0.92, transition: { duration: 0.18, ease: "easeIn" } }}
          animate={{
            // Depth, scale and a sideways step are left out, so every card is the same width and lines up.
            y: index * CARD_STEP,
            x: 0,
            z: 0,
            rotateX: 0,
            rotateY: 22,
            scale: 1,
            opacity: 1 - Math.min(index, 4) * 0.08,
          }}
          transition={
            reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 32 }
          }
          style={{ zIndex: stackedFrames.length - index }}
        >
          <div
            ref={(node) => {
              registerStack(frame.id, node);
            }}
            className="stack-frame"
            aria-label={`Frame: ${frame.title}`}
            role="button"
            tabIndex={-1}
            onFocus={() => handleFocus(index)}
            onClick={() => onPromote(index)}
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
      </AnimatePresence>
    </div>
  );
}
