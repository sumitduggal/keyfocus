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
import { DEFAULT_HABIT_ICON, DEFAULT_REMINDER_ICON } from "../icons";
import { SNOOZE_CHOICES, snoozeTime, summarise, toDate } from "../reminders";
import { Notice } from "./Notice";

// One stacked banner for everything that has just fired. It stays until each reminder is
// answered or dismissed. Dismissing leaves the reminder in the Overdue list.
export function ReminderNotice() {
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
  return (
    <Notice
      presentation="banner"
      tone="accent"
      placement="top"
      announcement="assertive"
      ariaLabel="Reminders due"
      className="notice-stack"
    >
      <AnimatePresence initial={false}>
        {habitNudges.map((nudge) => (
          <Notice
            key={`habit:${nudge.habitId}:${nudge.day}`}
            presentation="banner"
            tone="accent"
            placement="top"
            announcement="off"
            animate
            className="reminder-notice-item"
          >
            <b>
              {nudge.icon ?? DEFAULT_HABIT_ICON} {nudge.name}
            </b>
            <div className="reminder-notice-actions">
              <button type="button" onClick={() => tickNudge(nudge)}>
                Done today
              </button>
              <button type="button" aria-label="Dismiss" onClick={() => dismissBanner(nudge.frameId, nudge.habitId, true, nudge.day)}>
                ×
              </button>
            </div>
          </Notice>
        ))}
        {items.map(({ frameId, id, reminder }) => (
          <Notice
            key={`${frameId}:${id}`}
            presentation="banner"
            tone="accent"
            placement="top"
            announcement="off"
            animate
            className="reminder-notice-item"
          >
            <b>
              {reminder.icon ?? DEFAULT_REMINDER_ICON} {reminder.text}
            </b>
            <div className="reminder-notice-actions">
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
          </Notice>
        ))}
      </AnimatePresence>
    </Notice>
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
