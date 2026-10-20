import { useCallback } from "react";
import { motion } from "motion/react";
import type { WorkspaceFrame } from "../types";
import { StackPreview } from "./Mainframe";

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
      {stackedFrames.map((frame, index) => (
        <motion.div
          className={index === stackFocusIndex ? "stack-item previewed" : "stack-item"}
          key={frame.id}
          animate={{
            y: index * 73,
            rotateY: index % 2 ? -14 : -8,
            rotateZ: index % 2 ? 2 : -2,
            z: -index * 24,
            scale:
              index === stackFocusIndex
                ? index === 0 || index === stackedFrames.length - 2
                  ? 1.5
                  : 3
                : 1,
          }}
          transition={
            reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 330, damping: 30 }
          }
          style={{
            zIndex:
              index === stackFocusIndex ? stackedFrames.length + 1 : stackedFrames.length - index,
          }}
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
            <StackPreview frame={frame} />
          </div>
        </motion.div>
      ))}
    </div>
  );
}
