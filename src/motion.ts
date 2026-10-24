// Shared motion for small interface pieces. Every preset honours the reduced-motion setting, where
// things simply appear and disappear.
import { useReducedMotion } from "motion/react";

const SPRING = { type: "spring", stiffness: 520, damping: 34, mass: 0.7 } as const;

// A popup that grows out of the button it opened from. Spread onto a motion element, and wrap
// the element in AnimatePresence so it also animates out.
export function usePopup(origin = "top right") {
  const reduce = useReducedMotion();
  return {
    initial: reduce ? { opacity: 1 } : { opacity: 0, scale: 0.94, y: -6 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: -4 },
    transition: reduce ? { duration: 0 } : SPRING,
    style: { transformOrigin: origin },
  };
}

// Buttons rise a little under the cursor and press down on click.
export function usePress() {
  const reduce = useReducedMotion();
  return reduce
    ? {}
    : { whileHover: { scale: 1.06 }, whileTap: { scale: 0.92 }, transition: { type: "spring", stiffness: 600, damping: 28 } as const };
}

// Content that fades up when it first appears, optionally after a delay for a staggered list.
export function useFadeUp(delay = 0) {
  const reduce = useReducedMotion();
  return reduce
    ? { initial: false as const }
    : {
        initial: { opacity: 0, y: 6 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.16, ease: "easeOut" as const, delay },
      };
}
