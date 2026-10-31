import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { usePopup } from "../motion";
import type { FormEvent } from "react";
import { DEFAULT_HABIT_ICON } from "../icons";
import { IconPicker } from "./IconPicker";
import { Notice } from "./Notice";
import { requestNotificationPermission } from "../reminders-store";
import {
  MAX_TARGET,
  addDays,
  archiveHabit,
  bestWeek,
  canTick,
  createHabit,
  currentTarget,
  dayKey,
  deleteHabit,
  heatMap,
  localFirstDay,
  nextWeekTarget,
  renameHabit,
  setHabitIcon,
  setHabitNudge,
  setHabitTarget,
  toggleDay,
  weekProgress,
  weekStart,
  type Habit,
} from "../habits";

interface HabitsFrameProps {
  habits: Habit[];
  onChange: (habits: Habit[]) => void;
  onDeleteList?: () => void;
}

const FIRST_DAY = localFirstDay();

export function HabitsFrame({ habits, onChange, onDeleteList }: HabitsFrameProps) {
  const [today, setToday] = useState(() => new Date());
  const [name, setName] = useState("");
  const [target, setTarget] = useState(3);
  const [openId, setOpenId] = useState<string | null>(null);
  const [yearView, setYearView] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const popup = usePopup("top right");
  const reduceMotion = useReducedMotion();
  const moreRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingHabit, setConfirmingHabit] = useState<string | null>(null);
  // The last deleted habit and where it was, kept for a few seconds so it can be put back.
  const [undo, setUndo] = useState<{ habit: Habit; index: number } | null>(null);

  // Keeps "today" right when the app stays open past midnight.
  useEffect(() => {
    const timer = window.setInterval(() => setToday(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  // Closes the options popup. Escape passes the habit so focus goes back to its More button.
  const closePopup = (returnFocusTo?: string) => {
    setOpenId(null);
    setConfirmingHabit(null);
    if (returnFocusTo) moreRefs.current[returnFocusTo]?.focus();
  };

  // Clicking anywhere outside the popup and its More button closes it.
  useEffect(() => {
    if (!openId) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (popupRef.current?.contains(target) || moreRefs.current[openId]?.contains(target)) return;
      setOpenId(null);
      setConfirmingHabit(null);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [openId]);

  useEffect(() => {
    if (openId) popupRef.current?.focus();
  }, [openId]);

  const remove = (habit: Habit) => {
    setUndo({ habit, index: habits.indexOf(habit) });
    closePopup();
    onChange(deleteHabit(habits, habit.id));
  };

  const active = habits.filter((habit) => !habit.archived);
  const archived = habits.filter((habit) => habit.archived);
  const todayKey = dayKey(today);
  const thisWeek = weekStart(todayKey, FIRST_DAY);
  const weekDays = Array.from({ length: 7 }, (_, offset) => addDays(thisWeek, offset));
  const dayLabel = (day: string) =>
    new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { weekday: "narrow" });

  const add = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    onChange([...habits, createHabit(name, target, crypto.randomUUID(), today, FIRST_DAY)]);
    setName("");
  };

  return (
    <>
      <form className="todo-add habit-add" onSubmit={add}>
        <input
          value={name}
          placeholder="New habit, then Enter"
          aria-label="New habit"
          onChange={(event) => setName(event.target.value)}
        />
        <select
          aria-label="Times per week"
          value={target}
          onChange={(event) => setTarget(Number(event.target.value))}
        >
          {Array.from({ length: MAX_TARGET }, (_, index) => (
            <option key={index + 1} value={index + 1}>
              {index + 1}× a week
            </option>
          ))}
        </select>
      </form>

      <ul className="habit-list">
        {active.map((habit) => {
          const progress = weekProgress(habit, today, FIRST_DAY);
          const open = openId === habit.id;
          return (
            <li key={habit.id} className="habit-row">
              <div className="habit-main">
                <IconPicker
                  icon={habit.icon ?? DEFAULT_HABIT_ICON}
                  label={habit.name}
                  onChange={(icon) => onChange(setHabitIcon(habits, habit.id, icon))}
                />
                <input
                  className="habit-name"
                  aria-label="Habit name"
                  defaultValue={habit.name}
                  onBlur={(event) => {
                    const next = renameHabit(habits, habit.id, event.target.value);
                    if (next === habits) event.target.value = habit.name;
                    else onChange(next);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                  }}
                />
                <span className="habit-progress" aria-label={`${progress.count} of ${progress.target} this week`}>
                  {progress.count}/{progress.target}
                </span>
                <div className="habit-days" role="group" aria-label={`${habit.name} this week`}>
                  {weekDays.map((day) => {
                    const done = habit.done.includes(day);
                    return (
                      <motion.button
                        key={day}
                        initial={false}
                        animate={reduceMotion ? undefined : done ? { scale: [1, 1.25, 1] } : { scale: 1 }}
                        whileTap={reduceMotion ? undefined : { scale: 0.88 }}
                        transition={{ duration: 0.2 }}
                        type="button"
                        className={`habit-day${done ? " is-done" : ""}${day === todayKey ? " is-today" : ""}`}
                        aria-pressed={done}
                        aria-label={`${habit.name}, ${day}`}
                        disabled={!canTick(day, today)}
                        onClick={() => onChange(toggleDay(habits, habit.id, day, today))}
                      >
                        {dayLabel(day)}
                      </motion.button>
                    );
                  })}
                </div>
                <span className="habit-more-wrap">
                  <button
                    ref={(node) => {
                      moreRefs.current[habit.id] = node;
                    }}
                    type="button"
                    className="habit-more"
                    aria-expanded={open}
                    onClick={() => (open ? closePopup() : setOpenId(habit.id))}
                  >
                    More
                  </button>
                  <AnimatePresence>
                  {open && (
                    <motion.div
                      {...popup}
                      ref={popupRef}
                      className="habit-popup habit-options"
                      role="dialog"
                      aria-label={`${habit.name} options`}
                      tabIndex={-1}
                      onKeyDown={(event) => {
                        if (event.key !== "Escape") return;
                        // Close the popup without also sending the global Escape to the command bar.
                        event.preventDefault();
                        event.stopPropagation();
                        closePopup(habit.id);
                      }}
                    >
                      <div className="habit-stats">
                        <div>
                          <span>Best week</span>
                          <b>{bestWeek(habit, FIRST_DAY)}</b>
                        </div>
                        <div>
                          <span>Next week aim</span>
                          <b>{nextWeekTarget(habit)}</b>
                        </div>
                      </div>

                      <label className="habit-popup-row">
                        <span>Target</span>
                        <select
                          value={currentTarget(habit)}
                          onChange={(event) =>
                            onChange(setHabitTarget(habits, habit.id, Number(event.target.value), today, FIRST_DAY))
                          }
                        >
                          {Array.from({ length: MAX_TARGET }, (_, index) => (
                            <option key={index + 1} value={index + 1}>
                              {index + 1}× a week
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="habit-popup-row">
                        <span>Nudge</span>
                        <span className="habit-nudge-field">
                          <input
                            type="time"
                            aria-label={`${habit.name} daily nudge time`}
                            value={habit.nudge ?? ""}
                            onChange={(event) => {
                              if (event.target.value) requestNotificationPermission();
                              onChange(setHabitNudge(habits, habit.id, event.target.value));
                            }}
                          />
                          {habit.nudge && (
                            <button type="button" aria-label="Turn off nudge" onClick={() => onChange(setHabitNudge(habits, habit.id, ""))}>
                              ×
                            </button>
                          )}
                        </span>
                      </label>

                      <div className="habit-history">
                        <div className="habit-popup-row">
                          <span>History</span>
                          <div className="habit-toggle" role="group" aria-label="History range">
                            <button type="button" aria-pressed={!yearView} onClick={() => setYearView(false)}>
                              12 weeks
                            </button>
                            <button type="button" aria-pressed={yearView} onClick={() => setYearView(true)}>
                              Year
                            </button>
                          </div>
                        </div>
                        <div className="habit-map" role="img" aria-label={`${habit.name} history`}>
                          {heatMap(habit, today, FIRST_DAY, yearView ? 52 : 12).map((week, index) => (
                            <motion.div
                              key={week[0].day}
                              className="habit-map-week"
                              initial={reduceMotion ? false : { opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ duration: 0.2, delay: Math.min(index, 20) * 0.012 }}
                            >
                              {week.map((cell) => (
                                <span
                                  key={cell.day}
                                  title={cell.day}
                                  className={`habit-cell${cell.done ? " is-done" : ""}${cell.future ? " is-future" : ""}`}
                                />
                              ))}
                            </motion.div>
                          ))}
                        </div>
                      </div>

                      <div className="habit-popup-foot">
                        {confirmingHabit === habit.id ? (
                          <>
                            <button type="button" className="is-danger" onClick={() => remove(habit)}>
                              Delete for good
                            </button>
                            <button type="button" onClick={() => setConfirmingHabit(null)}>
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                closePopup();
                                onChange(archiveHabit(habits, habit.id, true));
                              }}
                            >
                              Archive
                            </button>
                            <button type="button" className="is-danger" onClick={() => setConfirmingHabit(habit.id)}>
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </motion.div>
                  )}
                  </AnimatePresence>
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      {undo && (
        <Notice
          presentation="inline"
          tone="neutral"
          announcement="polite"
          durationMs={5000}
          timeoutKey={undo}
          onDismiss={() => setUndo(null)}
          className="frame-foot habit-undo"
        >
          Deleted "{undo.habit.name}"{" "}
          <button
            type="button"
            className="notice-action"
            onClick={() => {
              const restored = [...habits];
              restored.splice(Math.min(undo.index, restored.length), 0, undo.habit);
              onChange(restored);
              setUndo(null);
            }}
          >
            Undo
          </button>
        </Notice>
      )}

      {active.length === 0 && <p className="frame-foot">No habits yet. Add one above.</p>}

      {archived.length > 0 && (
        <>
          <button type="button" className="todo-clear" onClick={() => setShowArchived((current) => !current)}>
            {showArchived ? "Hide" : "Show"} archived ({archived.length})
          </button>
          {showArchived && (
            <ul className="habit-list habit-archived">
              {archived.map((habit) => (
                <li key={habit.id} className="habit-row">
                  <span className="habit-name">{habit.name}</span>
                  <button type="button" onClick={() => onChange(archiveHabit(habits, habit.id, false))}>
                    Restore
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${habit.name}`}
                    onClick={() => remove(habit)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {onDeleteList &&
        (confirmingDelete ? (
          <div className="todo-confirm" role="alertdialog" aria-label="Confirm delete habit list">
            <p>Delete this habit list and its {habits.length} habits? You can undo for a few seconds.</p>
            <div>
              <button type="button" className="todo-danger" onClick={onDeleteList}>
                Delete habit list
              </button>
              <button type="button" onClick={() => setConfirmingDelete(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="todo-delete-list" onClick={() => setConfirmingDelete(true)}>
            Delete habit list
          </button>
        ))}
    </>
  );
}
