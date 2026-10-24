import { useSyncExternalStore } from "react";
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
  if (items.length === 0 && habitNudges.length === 0) return null;

  return (
    <div className="reminder-banner" role="alert" aria-label="Reminders due">
      {habitNudges.map((nudge) => (
        <div key={`habit:${nudge.habitId}:${nudge.day}`} className="reminder-banner-item">
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
        </div>
      ))}
      {items.map(({ frameId, id, reminder }) => (
        <div key={`${frameId}:${id}`} className="reminder-banner-item">
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
        </div>
      ))}
    </div>
  );
}

// The next reminder and the overdue count, for the top-right readout.
export function HudReminders() {
  const { lists } = useSyncExternalStore(subscribeReminders, getRemindersState);
  const { nudges } = useSyncExternalStore(subscribeReminders, getRemindersState);
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
        <span title={next.text}>
          Next: {next.text} · {when}
        </span>
      )}
    </div>
  );
}
