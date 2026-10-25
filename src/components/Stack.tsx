import { useCallback } from "react";
import type { WorkspaceFrame } from "../types";
import { featureMeta } from "../constants";
import type { FrameData } from "../frame-summary";
import { frameSummary } from "../frame-summary";
import { FramePreview } from "./FramePreview";

// Distance in pixels from one card to the next. Every card is 122px tall, so the rest, 6px, is the gap.
const CARD_STEP = 128;

interface StackProps {
  stackedFrames: WorkspaceFrame[];
  stackFocusIndex: number;
  registerStack: (id: string, node: HTMLElement | null) => void;
  reduceMotion: boolean;
  // What is inside the frames. Each card draws a small version of its frame from this.
  data: FrameData;
  collapsed?: boolean;
  onSelect: (index: number) => void;
  onPromote: (index: number) => void;
}

export function Stack({
  stackedFrames,
  stackFocusIndex,
  registerStack,
  reduceMotion,
  data,
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
                title={`${frame.title} · ${frameSummary(frame, data)}`}
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

      {/* Cards are placed and moved with plain CSS, not JS springs: those can stall part-way and leave a
          faint ghost or a blank slot. A frame leaving the stack just disappears and the rest slide up. */}
      {stackedFrames.map((frame, index) => (
        <div
          className={index === stackFocusIndex ? "stack-item previewed" : "stack-item"}
          key={frame.id}
          style={
            {
              "--y": `${index * CARD_STEP}px`,
              opacity: 1 - Math.min(index, 4) * 0.08,
              zIndex: stackedFrames.length - index,
              ...(reduceMotion ? { animation: "none", transition: "none" } : {}),
            } as React.CSSProperties
          }
        >
          <div
            ref={(node) => {
              registerStack(frame.id, node);
            }}
            className="stack-frame"
            aria-label={`Frame: ${frame.title}`}
            title={frameSummary(frame, data)}
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
            <div className="stack-preview" aria-hidden="true">
              <FramePreview frame={frame} data={data} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
