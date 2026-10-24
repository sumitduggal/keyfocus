import { useSyncExternalStore } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  dismissBanner,
  finishReminder,
  getRemindersState,
  snoozeUntil,
  subscribeReminders,
  tickNudge,
} from "../reminders-store";
import { DEFAULT_HABIT_ICON } from "../icons";
import { DEFAULT_REMINDER_ICON } from "../icons";
import { SNOOZE_CHOICES, snoozeTime, summarise, toDate } from "../reminders";

// One stacked banner for everything that has just fired. It stays until each reminder is
// answered or dismissed. Dismissing leaves the reminder in the Overdue list.
export function ReminderBanner() {
  const { lists, banner, nudges } = useSyncExternalStore(subscribeReminders, getRemindersState);
  const habitNudges = banner.flatMap((item) => {
    const nudge = nudges.find((open) => open.habitId === item.id && open.day === item.day);
    return item.nudge && nudge ? [nudge] : [];
  });
  const items = banner.flatMap((item) => {
    if (item.nudge) return [];
    const reminder = lists[item.frameId]?.reminders.find((candidate) => candidate.id === item.id);
    return reminder ? [{ ...item, reminder }] : [];
  });
  const reduceMotion = useReducedMotion();
  // Each banner slides down from the top edge and back up when answered.
  const slide = {
    layout: reduceMotion ? false : ("position" as const),
    initial: reduceMotion ? false : { opacity: 0, y: -24, scale: 0.97 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: reduceMotion ? { opacity: 0 } : { opacity: 0, y: -16 },
    transition: reduceMotion ? { duration: 0 } : ({ type: "spring", stiffness: 420, damping: 32 } as const),
  };

  return (
    <div className="reminder-banner" role="alert" aria-label="Reminders due">
      <AnimatePresence initial={false}>
      {habitNudges.map((nudge) => (
        <motion.div {...slide} key={`habit:${nudge.habitId}:${nudge.day}`} className="reminder-banner-item">
          <b>
            {nudge.icon ?? DEFAULT_HABIT_ICON} {nudge.name}
          </b>
          <div className="reminder-banner-actions">
            <button type="button" onClick={() => tickNudge(nudge)}>
              Done today
            </button>
            <button type="button" aria-label="Dismiss" onClick={() => dismissBanner(nudge.frameId, nudge.habitId, true, nudge.day)}>
              ×
            </button>
          </div>
        </motion.div>
      ))}
      {items.map(({ frameId, id, reminder }) => (
        <motion.div {...slide} key={`${frameId}:${id}`} className="reminder-banner-item">
          <b>
            {reminder.icon ?? DEFAULT_REMINDER_ICON} {reminder.text}
          </b>
          <div className="reminder-banner-actions">
            <button type="button" onClick={() => finishReminder(frameId, id)}>
              Done
            </button>
            {SNOOZE_CHOICES.map(({ choice, label }) => (
              <button key={choice} type="button" onClick={() => snoozeUntil(frameId, id, snoozeTime(choice, new Date()))}>
                {label}
              </button>
            ))}
            <button type="button" aria-label="Dismiss" onClick={() => dismissBanner(frameId, id)}>
              ×
            </button>
          </div>
        </motion.div>
      ))}
      </AnimatePresence>
    </div>
  );
}

// The next reminder and the overdue count, for the top-right readout.
export function HudReminders() {
  const { lists } = useSyncExternalStore(subscribeReminders, getRemindersState);
  const { nudges } = useSyncExternalStore(subscribeReminders, getRemindersState);
  const reduceMotion = useReducedMotion();
  const summary = summarise(Object.values(lists));
  const next = summary.next;
  const overdue = summary.overdue + nudges.length;
  if (!next && overdue === 0) return null;
  const trigger = next ? (next.snoozedUntil && next.snoozedUntil < next.due ? next.snoozedUntil : next.due) : null;
  const when = trigger
    ? toDate(trigger).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" })
    : "";
  return (
    <div className="hud-status-line hud-reminders">
      {overdue > 0 && <b>{overdue} overdue</b>}
      {next && trigger && (
        <motion.span key={`${next.id}:${when}`} initial={reduceMotion ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} title={next.text}>
          Next: {next.text} · {when}
        </motion.span>
      )}
    </div>
  );
}
