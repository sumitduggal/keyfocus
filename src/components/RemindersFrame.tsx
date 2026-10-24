import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import {
  EMPTY_REMINDERS,
  SNOOZE_CHOICES,
  addReminder,
  createReminder,
  cyclePriority,
  deleteDoneEntry,
  deleteReminder,
  describeRepeat,
  editReminder,
  groupReminders,
  isOverdue,
  nextTrigger,
  parseReminder,
  setReminderIcon,
  snoozeTime,
  toDate,
  toStamp,
  type Reminder,
} from "../reminders";
import {
  finishReminder,
  getRemindersState,
  requestNotificationPermission,
  skipNudge,
  snoozeUntil,
  tickNudge,
  subscribeReminders,
  updateReminders,
} from "../reminders-store";
import { DEFAULT_HABIT_ICON, DEFAULT_REMINDER_ICON } from "../icons";
import { IconPicker } from "./IconPicker";
import { PRIORITY_SUGGESTIONS, currentToken, dateSuggestions } from "../suggestions";

interface RemindersFrameProps {
  frameId: string;
  onDeleteList?: () => void;
}

const format = (stamp: string) =>
  toDate(stamp).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

type Panel = { id: string; kind: "edit" | "snooze" } | null;

export function RemindersFrame({ frameId, onDeleteList }: RemindersFrameProps) {
  const { lists, nudges } = useSyncExternalStore(subscribeReminders, getRemindersState);
  const data = lists[frameId] ?? EMPTY_REMINDERS;
  const [now, setNow] = useState(() => new Date());
  const [text, setText] = useState("");
  const [panel, setPanel] = useState<Panel>(null);
  const [showDone, setShowDone] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const [dismissedToken, setDismissedToken] = useState<string | null>(null);

  // Keeps the day groups right as time passes.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!panel) return;
    popupRef.current?.focus();
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Element;
      if (popupRef.current?.contains(target) || target.closest(".reminder-open")) return;
      setPanel(null);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [panel]);

  const todayDay = toStamp(now).slice(0, 10);
  const preview = text.trim() ? parseReminder(text, now) : null;
  const reminderGroups = groupReminders(data, now);
  // Missed habit nudges are overdue too, so they share the Overdue section.
  const groups =
    nudges.length > 0 && !reminderGroups.some((group) => group.key === "overdue")
      ? [{ key: "overdue" as const, label: "Overdue", items: [] }, ...reminderGroups]
      : reminderGroups;

  // "!" suggests a priority and "@" a date, the same as the todo list.
  const token = currentToken(text);
  const prefix = token.slice(1).toLowerCase();
  const pool = token.startsWith("!") ? PRIORITY_SUGGESTIONS : token.startsWith("@") ? dateSuggestions(now) : [];
  const suggestions = pool.filter((option) => option.label.startsWith(prefix));
  const open = suggestions.length > 0 && dismissedToken !== token;
  const highlighted = suggestions[Math.min(activeSuggestion, suggestions.length - 1)];

  const updateText = (value: string) => {
    setText(value);
    setActiveSuggestion(0);
    setDismissedToken(null);
  };

  const handleInputKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!open || !highlighted) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setActiveSuggestion((current) => (current + delta + suggestions.length) % suggestions.length);
    } else if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      updateText(`${text.slice(0, text.length - token.length)}${highlighted.value} `);
    } else if (event.key === "Escape") {
      // Close the list without letting the global Escape leave the field.
      event.preventDefault();
      event.stopPropagation();
      setDismissedToken(token);
    }
  };

  const add = (event: FormEvent) => {
    event.preventDefault();
    if (!preview) return;
    updateReminders(frameId, (current) => addReminder(current, createReminder(preview, crypto.randomUUID())));
    requestNotificationPermission();
    updateText("");
  };

  return (
    <>
      <form className="todo-add" onSubmit={add}>
        <input
          value={text}
          placeholder="Add reminder · ! priority  @ date"
          aria-label="New reminder"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls="reminder-suggestions"
          onChange={(event) => updateText(event.target.value)}
          onKeyDown={handleInputKey}
        />
        {open && (
          <ul id="reminder-suggestions" role="listbox" className="todo-suggest" aria-label="Suggestions">
            {suggestions.map((option, index) => (
              <li
                key={option.value}
                role="option"
                aria-selected={index === activeSuggestion}
                className={index === activeSuggestion ? "is-highlighted" : undefined}
                onMouseDown={(event) => {
                  event.preventDefault();
                  updateText(`${text.slice(0, text.length - token.length)}${option.value} `);
                }}
              >
                <span>{option.value}</span>
                <small>{option.hint}</small>
              </li>
            ))}
          </ul>
        )}
      </form>
      {preview ? (
        <p className="todo-hint">
          {preview.text} · {format(preview.due)}
          {preview.repeat ? ` · ${describeRepeat(preview.repeat)}` : ""} · {preview.priority}
        </p>
      ) : (
        <p className="todo-hint">call mum tomorrow 9am · every weekday 9:30 · !high · @friday</p>
      )}

      {groups.map((group) => (
        <section key={group.key} className={`reminder-group is-${group.key}`}>
          <h2>{group.label}</h2>
          <ul className="habit-list">
            {group.key === "overdue" &&
              nudges.map((nudge) => (
                <li key={`${nudge.habitId}:${nudge.day}`} className="habit-row reminder-row is-overdue">
                  <div className="habit-main">
                    <span className="icon-static" aria-hidden="true">
                      {nudge.icon ?? DEFAULT_HABIT_ICON}
                    </span>
                    <span className="habit-name">
                      {nudge.name}
                      <small className="reminder-when">Habit · {nudge.day === todayDay ? "today" : nudge.day}</small>
                    </span>
                    <span className="nudge-actions">
                      <button type="button" className="habit-more" onClick={() => tickNudge(nudge)}>
                        Done today
                      </button>
                      <button type="button" className="habit-more" onClick={() => skipNudge(nudge)}>
                        Skip
                      </button>
                    </span>
                  </div>
                </li>
              ))}
            {group.items.map((reminder) => (
              <ReminderRow
                key={reminder.id}
                reminder={reminder}
                panel={panel?.id === reminder.id ? panel.kind : null}
                popupRef={popupRef}
                onPanel={(kind) => setPanel(kind ? { id: reminder.id, kind } : null)}
                onEdit={(changes) => {
                  updateReminders(frameId, (current) => editReminder(current, reminder.id, changes));
                  setPanel(null);
                }}
                onPriority={() => updateReminders(frameId, (current) => cyclePriority(current, reminder.id))}
                onIcon={(icon) => updateReminders(frameId, (current) => setReminderIcon(current, reminder.id, icon))}
                onDone={() => finishReminder(frameId, reminder.id)}
                onSnooze={(until) => {
                  snoozeUntil(frameId, reminder.id, until);
                  setPanel(null);
                }}
                onDelete={() => updateReminders(frameId, (current) => deleteReminder(current, reminder.id))}
                now={now}
              />
            ))}
          </ul>
        </section>
      ))}

      {data.reminders.length === 0 && nudges.length === 0 && <p className="frame-foot">No reminders yet. Type one above.</p>}

      {data.done.length > 0 && (
        <>
          <button type="button" className="todo-clear" onClick={() => setShowDone((current) => !current)}>
            {showDone ? "Hide" : "Show"} done ({data.done.length})
          </button>
          {showDone && (
            <ul className="habit-list habit-archived">
              {data.done.map((entry) => (
                <li key={entry.id} className="habit-row">
                  <span className="habit-name">
                    {entry.text} <small>· {format(entry.doneAt)}</small>
                  </span>
                  <button
                    type="button"
                    aria-label={`Delete ${entry.text} from done`}
                    onClick={() => updateReminders(frameId, (current) => deleteDoneEntry(current, entry.id))}
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
          <div className="todo-confirm" role="alertdialog" aria-label="Confirm delete reminder list">
            <p>Delete this reminder list and its {data.reminders.length} reminders? You can undo for a few seconds.</p>
            <div>
              <button type="button" className="todo-danger" onClick={onDeleteList}>
                Delete reminder list
              </button>
              <button type="button" onClick={() => setConfirmingDelete(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="todo-delete-list" onClick={() => setConfirmingDelete(true)}>
            Delete reminder list
          </button>
        ))}
    </>
  );
}

interface ReminderRowProps {
  reminder: Reminder;
  panel: "edit" | "snooze" | null;
  popupRef: React.RefObject<HTMLDivElement | null>;
  onPanel: (kind: "edit" | "snooze" | null) => void;
  onEdit: (changes: Pick<Reminder, "text" | "due" | "repeat">) => void;
  onDone: () => void;
  onPriority: () => void;
  onIcon: (icon: string) => void;
  onSnooze: (until: string) => void;
  onDelete: () => void;
  now: Date;
}

function ReminderRow({ reminder, panel, popupRef, onPanel, onEdit, onDone, onPriority, onIcon, onSnooze, onDelete, now }: ReminderRowProps) {
  const overdue = isOverdue(reminder);
  const when = reminder.firedAt ?? nextTrigger(reminder) ?? reminder.due;
  const repeat = describeRepeat(reminder.repeat);

  const closeOnEscape = (event: React.KeyboardEvent) => {
    if (event.key !== "Escape") return;
    // Close the popup without also sending the global Escape to the command bar.
    event.preventDefault();
    event.stopPropagation();
    onPanel(null);
  };

  return (
    <li className={`habit-row reminder-row${overdue ? " is-overdue" : ""}`}>
      <div className="habit-main">
        <button type="button" className="todo-check reminder-check" aria-label={`Mark ${reminder.text} done`} onClick={onDone} />
        <IconPicker icon={reminder.icon ?? DEFAULT_REMINDER_ICON} label={reminder.text} onChange={onIcon} />
        <span className="habit-name">
          {reminder.text}
          <small className="reminder-when">
            {format(when)}
            {repeat ? ` · ${repeat}` : ""}
          </small>
        </span>
        <button
          type="button"
          className={`todo-priority is-${reminder.priority}`}
          aria-label={`Priority ${reminder.priority}, change`}
          onClick={onPriority}
        >
          {reminder.priority}
        </button>
        <span className="habit-more-wrap">
          {overdue && (
            <button type="button" className="habit-more reminder-open" onClick={() => onPanel(panel === "snooze" ? null : "snooze")}>
              Snooze
            </button>
          )}{" "}
          <button type="button" className="habit-more reminder-open" onClick={() => onPanel(panel === "edit" ? null : "edit")}>
            Edit
          </button>
          {panel && (
            <div ref={popupRef} className="habit-popup reminder-popup" role="dialog" tabIndex={-1} aria-label={`${reminder.text} options`} onKeyDown={closeOnEscape}>
              {panel === "snooze" ? (
                <SnoozePanel now={now} onSnooze={onSnooze} />
              ) : (
                <EditPanel reminder={reminder} now={now} onEdit={onEdit} onDelete={onDelete} />
              )}
            </div>
          )}
        </span>
      </div>
    </li>
  );
}

function SnoozePanel({ now, onSnooze }: { now: Date; onSnooze: (until: string) => void }) {
  const [custom, setCustom] = useState("");
  return (
    <>
      <div className="habit-actions">
        {SNOOZE_CHOICES.map(({ choice, label }) => (
          <button key={choice} type="button" onClick={() => onSnooze(snoozeTime(choice, new Date()))}>
            {label}
          </button>
        ))}
      </div>
      <label className="habit-target reminder-field">
        Pick a day and time
        <input type="datetime-local" min={toStamp(now)} value={custom} onChange={(event) => setCustom(event.target.value)} />
      </label>
      <div className="habit-actions">
        <button type="button" disabled={!custom} onClick={() => onSnooze(custom)}>
          Snooze until then
        </button>
      </div>
    </>
  );
}

function EditPanel({
  reminder,
  now,
  onEdit,
  onDelete,
}: {
  reminder: Reminder;
  now: Date;
  onEdit: (changes: Pick<Reminder, "text" | "due" | "repeat">) => void;
  onDelete: () => void;
}) {
  const [text, setText] = useState(reminder.text);
  const [due, setDue] = useState(reminder.due);
  const [repeat, setRepeat] = useState(describeRepeat(reminder.repeat));
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  const save = () => {
    // The repeat box takes the same words as the sentence box, for example "every 2nd tuesday".
    const parsed = repeat.trim() ? parseReminder(`${repeat} ${due.slice(0, 10)} ${due.slice(11)}`, now) : null;
    if (repeat.trim() && !parsed?.repeat) {
      setError("Repeat not understood. Try “every weekday” or “every 2nd tuesday”.");
      return;
    }
    onEdit({ text, due: parsed?.due ?? due, repeat: parsed?.repeat ?? null });
  };

  return (
    <>
      <label className="habit-target reminder-field">
        Text
        <input value={text} onChange={(event) => setText(event.target.value)} />
      </label>
      <label className="habit-target reminder-field">
        Day and time
        <input type="datetime-local" value={due} onChange={(event) => setDue(event.target.value)} />
      </label>
      <label className="habit-target reminder-field">
        Repeat (blank for none)
        <input
          value={repeat}
          placeholder="every weekday"
          onChange={(event) => {
            setRepeat(event.target.value);
            setError("");
          }}
        />
      </label>
      {error && (
        <p className="todo-hint" role="alert">
          {error}
        </p>
      )}
      <div className="habit-actions">
        <button type="button" disabled={!text.trim() || !due} onClick={save}>
          Save
        </button>
        {confirming ? (
          <>
            <button type="button" className="todo-danger" onClick={onDelete}>
              Delete for good
            </button>
            <button type="button" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setConfirming(true)}>
            Delete
          </button>
        )}
      </div>
    </>
  );
}
