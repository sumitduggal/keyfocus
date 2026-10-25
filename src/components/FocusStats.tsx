import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { usePopup } from "../motion";
import {
  averageSeconds,
  bestDay,
  dailySeries,
  focusHeatMap,
  formatDuration,
  totals,
  type FocusTotals,
} from "../focus-log";
import { getFocusLog, subscribeFocusLog } from "../focus-log-store";

const dayName = (day: string) =>
  new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });

// Width of the chart popup, which opens beside its button.
const POPUP_WIDTH = 300;

// Heat map shade from one day's focus time: under a quarter hour, under an hour, an hour or more.
const level = (seconds: number) => (seconds === 0 ? 0 : seconds < 900 ? 1 : seconds < 3600 ? 2 : 3);

function Tile({ label, value }: { label: string; value: FocusTotals }) {
  return (
    <div className="focus-tile">
      <span>{label}</span>
      <b>{formatDuration(value.completedSeconds)}</b>
      <small>
        {value.sessions} {value.sessions === 1 ? "session" : "sessions"}
      </small>
      {value.partialSeconds >= 60 && <small className="focus-partial">+ {formatDuration(value.partialSeconds)} partial</small>}
    </div>
  );
}

// Totals, a daily chart and a heat map of the time spent in the timer. Completed sessions are the
// headline; time from sessions that were reset or abandoned is shown apart from them.
export function FocusStats() {
  const log = useSyncExternalStore(subscribeFocusLog, getFocusLog);
  const [now, setNow] = useState(() => new Date());
  // The chart slot shows the last 7 or 30 days as bars, or the 12-week heat map. One at a time.
  const [view, setView] = useState<7 | 30 | "heat">(7);
  // The chart opens in a popup, so the section stays short under the timer.
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [anchor, setAnchor] = useState({ top: 0, left: 0 });
  const popupRef = useRef<HTMLDivElement | null>(null);
  const popup = usePopup("top left");

  // Keeps "today" right when the app stays open past midnight.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  // A click outside the chart closes it.
  useEffect(() => {
    if (!open) return;
    popupRef.current?.focus({ preventScroll: true });
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!wrapRef.current?.contains(target) && !popupRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [open]);

  const closeOnEscape = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape") return;
    // Close without also sending the global Escape to the command bar, and return focus to the button.
    event.preventDefault();
    event.stopPropagation();
    setOpen(false);
    wrapRef.current?.querySelector<HTMLButtonElement>(".focus-chart-trigger")?.focus();
  };

  if (log.length === 0) {
    return (
      <section className="focus-stats" aria-label="Focus log">
        <h2>Focus log</h2>
        <p className="focus-empty">No sessions yet. Finish one, or run a minute or more, and it shows here.</p>
      </section>
    );
  }

  const summary = totals(log, now);
  const range = view === "heat" ? 7 : view;
  const series = dailySeries(log, now, range);
  const peak = Math.max(1, ...series.map((day) => day.completedSeconds + day.partialSeconds));
  const best = bestDay(series);

  return (
    <section className="focus-stats" aria-label="Focus log">
      <h2>Focus log</h2>
      <div className="focus-tiles">
        <Tile label="Today" value={summary.today} />
        <Tile label="Last 7 days" value={summary.week} />
        <Tile label="All time" value={summary.all} />
      </div>

      <div className="focus-chart-wrap" ref={wrapRef}>
        <button
          ref={triggerRef}
          type="button"
          className="focus-chart-trigger"
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => {
            if (!open && triggerRef.current) {
              // Beside the button: on the right if it fits in the window, otherwise on the left.
              const box = triggerRef.current.getBoundingClientRect();
              const right = box.right + 12 + POPUP_WIDTH <= window.innerWidth;
              setAnchor({ top: box.top, left: right ? box.right + 12 : box.left - 12 - POPUP_WIDTH });
            }
            setOpen(!open);
          }}
        >
          {open ? "Hide chart" : "Show chart"}
        </button>
        {open &&
          // Drawn at the page's top level, so the panels around it cannot clip or move it.
          createPortal(

            <motion.div
              {...popup}
              style={{ ...popup.style, top: anchor.top, left: anchor.left }}
              ref={popupRef}
              className="focus-popup"
              role="dialog"
              aria-label="Focus chart"
              tabIndex={-1}
              onKeyDown={closeOnEscape}
            >
              <div className="focus-chart-head">
                <span>
                  {view === "heat"
                    ? "Last 12 weeks"
                    : `${best ? `Best day ${dayName(best.day)} · ${formatDuration(best.completedSeconds + best.partialSeconds)}` : "No focus in this range"} · ${formatDuration(averageSeconds(series))} a day`}
                </span>
                <div className="habit-toggle" role="group" aria-label="Chart view">
                  <button type="button" aria-pressed={view === 7} onClick={() => setView(7)}>
                    7 days
                  </button>
                  <button type="button" aria-pressed={view === 30} onClick={() => setView(30)}>
                    30 days
                  </button>
                  <button type="button" aria-pressed={view === "heat"} onClick={() => setView("heat")}>
                    12 weeks
                  </button>
                </div>
              </div>

              {view === "heat" ? (
                <div className="habit-map focus-heat" role="img" aria-label="Focus by day over the last 12 weeks">
                  {focusHeatMap(log, now, 12).map((week) => (
                    <div key={week[0].day} className="habit-map-week">
                      {week.map((cell) => (
                        <span
                          key={cell.day}
                          title={`${dayName(cell.day)}: ${formatDuration(cell.seconds)}`}
                          className={`habit-cell focus-cell level-${level(cell.seconds)}${cell.future ? " is-future" : ""}`}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div
                    className="focus-chart"
                    role="img"
                    aria-label={`Focus time over the last ${range} days. ${series.map((day) => `${dayName(day.day)}: ${formatDuration(day.completedSeconds + day.partialSeconds)}`).join(". ")}`}
                  >
                    {series.map((day) => (
                      <div key={day.day} className="focus-bar" title={`${dayName(day.day)}: ${formatDuration(day.completedSeconds)} completed${day.partialSeconds ? `, ${formatDuration(day.partialSeconds)} partial` : ""}`}>
                        <span className="focus-bar-done" style={{ height: `${(day.completedSeconds / peak) * 100}%` }} />
                        <span className="focus-bar-partial" style={{ height: `${(day.partialSeconds / peak) * 100}%` }} />
                      </div>
                    ))}
                  </div>
                  <p className="focus-legend">
                    <i className="is-done" /> Completed <i className="is-partial" /> Partial
                  </p>
                </>
              )}
            </motion.div>,
            document.body,
          )}
      </div>
    </section>
  );
}
