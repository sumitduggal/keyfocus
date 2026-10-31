import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

export type NoticePresentation = "banner" | "toast" | "inline";
export type NoticeTone = "neutral" | "accent" | "warning";
export type NoticeAnnouncement = "off" | "polite" | "assertive";

interface NoticeProps {
  presentation: NoticePresentation;
  tone?: NoticeTone;
  placement?: "top" | "header" | "bottom" | "inline";
  announcement?: NoticeAnnouncement;
  durationMs?: number | null;
  timeoutKey?: unknown;
  ariaLabel?: string;
  animate?: boolean;
  className?: string;
  onDismiss?: () => void;
  children: ReactNode;
}

export function Notice({
  presentation,
  tone = "neutral",
  placement = "inline",
  announcement = "off",
  durationMs = null,
  timeoutKey,
  ariaLabel,
  animate = false,
  className = "",
  onDismiss,
  children,
}: NoticeProps) {
  const reduceMotion = useReducedMotion();
  const dismissRef = useRef(onDismiss);
  const fadeTimerRef = useRef<number | null>(null);
  const canDismiss = Boolean(onDismiss);
  const [fadingNotice, setFadingNotice] = useState<{ key: unknown; durationMs: number } | null>(null);
  const fading =
    fadingNotice !== null &&
    fadingNotice.key === timeoutKey &&
    fadingNotice.durationMs === durationMs;

  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (durationMs === null || durationMs < 0 || !canDismiss) return;
    const timer = window.setTimeout(() => {
      setFadingNotice({ key: timeoutKey, durationMs });
      fadeTimerRef.current = window.setTimeout(() => dismissRef.current?.(), 180);
    }, durationMs);
    return () => {
      window.clearTimeout(timer);
      if (fadeTimerRef.current !== null) window.clearTimeout(fadeTimerRef.current);
    };
  }, [durationMs, timeoutKey, canDismiss]);

  const motionProps = animate
    ? {
        layout: reduceMotion ? false : ("position" as const),
        initial: reduceMotion ? false : { opacity: 0, y: -24, scale: 0.97 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: reduceMotion ? { opacity: 0 } : { opacity: 0, y: -16 },
        transition: reduceMotion ? { duration: 0 } : ({ type: "spring", stiffness: 420, damping: 32 } as const),
      }
    : durationMs !== null && canDismiss
      ? {
          initial: false,
          animate: fading ? { opacity: 0, y: presentation === "toast" ? 6 : 0 } : { opacity: 1, y: 0 },
          transition: reduceMotion ? { duration: 0 } : { duration: 0.18, ease: "easeOut" as const },
        }
      : {};
  const announcementProps =
    announcement === "assertive"
      ? { role: "alert" as const }
      : announcement === "polite"
        ? { role: "status" as const }
        : {};

  return (
    <motion.div
      {...motionProps}
      {...announcementProps}
      aria-label={ariaLabel}
      className={`notice notice--${presentation} notice--${tone} notice--${placement} ${className}`.trim()}
    >
      {children}
    </motion.div>
  );
}
