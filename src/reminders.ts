// Reminders: a time to alert, optional repeat rules, and a list of what is overdue and done.
// Times are local wall-clock stamps written as YYYY-MM-DDTHH:MM, so they sort and compare as strings
// and a repeating reminder keeps its clock time in whatever time zone the device is in.
import { addDays, dayKey } from "./habits";
import { isIcon } from "./icons";

export type Repeat =
  | { kind: "daily"; every: number }
  | { kind: "weekly"; every: number; weekdays: number[] }
  | { kind: "monthly"; every: number; monthDay: number }
  | { kind: "monthly-nth"; every: number; nth: number; weekday: number } // nth is 1 to 4, or -1 for last
  | { kind: "yearly"; every: number };

export type ReminderPriority = "high" | "medium" | "low";

export interface Reminder {
  id: string;
  text: string;
  priority: ReminderPriority;
  icon?: string; // chosen by the person; a default shows until then
  due: string; // the next regular time
  repeat: Repeat | null;
  snoozedUntil: string | null; // an extra one-off time for a repeating reminder
  firedAt: string | null; // the occurrence that fired and still needs an answer
}

export interface DoneEntry {
  id: string;
  text: string;
  at: string;
  doneAt: string;
}

export interface RemindersData {
  reminders: Reminder[];
  done: DoneEntry[];
}

export const REMINDERS_KEY = "focus-space-reminders";
export const EMPTY_REMINDERS: RemindersData = { reminders: [], done: [] };
const DEFAULT_TIME = "09:00";
const GUARD = 20000; // stops a loop that would otherwise walk years of occurrences

const pad = (value: number) => String(value).padStart(2, "0");

export function toStamp(date: Date): string {
  return `${dayKey(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function toDate(stamp: string): Date {
  const [day, time] = stamp.split("T");
  const [year, month, date] = day.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(year, month - 1, date, hours, minutes);
}

const dayOf = (stamp: string) => stamp.slice(0, 10);
const timeOf = (stamp: string) => stamp.slice(11, 16);
const weekdayOf = (day: string) => toDate(`${day}T00:00`).getDay();
const daysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

// Days from one date to another, ignoring daylight saving.
function daysBetween(from: string, to: string): number {
  const utc = (day: string) => {
    const [y, m, d] = day.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((utc(to) - utc(from)) / 86_400_000);
}

// The date of the nth (or last, with -1) given weekday in a month.
function nthWeekday(year: number, month: number, nth: number, weekday: number): string {
  if (nth > 0) {
    const first = new Date(year, month - 1, 1).getDay();
    const day = 1 + ((weekday - first + 7) % 7) + 7 * (nth - 1);
    return dayKey(new Date(year, month - 1, day));
  }
  const last = new Date(year, month, 0);
  const back = (last.getDay() - weekday + 7) % 7;
  return dayKey(new Date(year, month - 1, last.getDate() - back));
}

function monthShift(day: string, months: number): { year: number; month: number } {
  const [year, month] = day.split("-").map(Number);
  const index = year * 12 + (month - 1) + months;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

// The first time on or after `stamp` that fits the rule, for a reminder that has no date of its own.
export function firstOnOrAfter(repeat: Repeat, stamp: string): string {
  const day = dayOf(stamp);
  const time = timeOf(stamp);
  if (repeat.kind === "weekly") {
    for (let offset = 0; offset < 7; offset++) {
      const candidate = addDays(day, offset);
      if (repeat.weekdays.includes(weekdayOf(candidate))) return `${candidate}T${time}`;
    }
  }
  if (repeat.kind === "monthly" || repeat.kind === "monthly-nth") {
    for (let step = 0; step < 2; step++) {
      const { year, month } = monthShift(day, step);
      const candidate =
        repeat.kind === "monthly"
          ? dayKey(new Date(year, month - 1, Math.min(repeat.monthDay, daysInMonth(year, month))))
          : nthWeekday(year, month, repeat.nth, repeat.weekday);
      if (candidate >= day) return `${candidate}T${time}`;
    }
  }
  return stamp;
}

// The next time after `due` that the rule gives.
export function nextDue(repeat: Repeat, due: string): string {
  const day = dayOf(due);
  const time = timeOf(due);
  const every = Math.max(1, repeat.every);
  switch (repeat.kind) {
    case "daily":
      return `${addDays(day, every)}T${time}`;
    case "weekly": {
      const weekStart = addDays(day, -weekdayOf(day));
      for (let offset = 1; offset <= 7 * every + 7; offset++) {
        const candidate = addDays(day, offset);
        if (!repeat.weekdays.includes(weekdayOf(candidate))) continue;
        const weeks = daysBetween(weekStart, addDays(candidate, -weekdayOf(candidate))) / 7;
        if (weeks % every === 0) return `${candidate}T${time}`;
      }
      return `${addDays(day, 7 * every)}T${time}`;
    }
    case "monthly": {
      const { year, month } = monthShift(day, every);
      const date = Math.min(repeat.monthDay, daysInMonth(year, month));
      return `${dayKey(new Date(year, month - 1, date))}T${time}`;
    }
    case "monthly-nth": {
      const { year, month } = monthShift(day, every);
      return `${nthWeekday(year, month, repeat.nth, repeat.weekday)}T${time}`;
    }
    case "yearly": {
      const [year, month, date] = day.split("-").map(Number);
      const target = year + every;
      return `${dayKey(new Date(target, month - 1, Math.min(date, daysInMonth(target, month))))}T${time}`;
    }
  }
}

// The first occurrence strictly after `now`, starting from `due`.
function firstAfter(repeat: Repeat, due: string, now: string): { next: string; latestPast: string } {
  let latestPast = due;
  let next = due;
  for (let guard = 0; next <= now && guard < GUARD; guard++) {
    latestPast = next;
    next = nextDue(repeat, next);
  }
  return { next, latestPast };
}

// When this reminder next needs attention, or null when it is waiting for an answer.
export function nextTrigger(reminder: Reminder): string | null {
  if (reminder.firedAt !== null && !reminder.repeat) return reminder.snoozedUntil;
  const times = [reminder.due, reminder.snoozedUntil].filter((time): time is string => time !== null);
  return times.sort()[0] ?? null;
}

export function isOverdue(reminder: Reminder): boolean {
  return reminder.firedAt !== null;
}

// Fires everything that has come due. Repeating reminders move on to their next time, and several
// missed times collapse into the latest one. `fired` lists reminders that newly need an answer.
export function tick(data: RemindersData, now: Date): { data: RemindersData; fired: Reminder[] } {
  const nowStamp = toStamp(now);
  const fired: Reminder[] = [];
  let changed = false;
  const reminders = data.reminders.map((reminder) => {
    let next = reminder;
    if (next.snoozedUntil !== null && next.snoozedUntil <= nowStamp) {
      next = { ...next, snoozedUntil: null, firedAt: next.firedAt ?? next.snoozedUntil };
    }
    if (next.due <= nowStamp) {
      if (next.repeat) {
        const { next: due, latestPast } = firstAfter(next.repeat, next.due, nowStamp);
        next = { ...next, due, firedAt: latestPast };
      } else if (next.firedAt === null) {
        next = { ...next, firedAt: next.due };
      }
    }
    if (next === reminder) return reminder;
    changed = true;
    if (reminder.firedAt === null && next.firedAt !== null) fired.push(next);
    return next;
  });
  return { data: changed ? { ...data, reminders } : data, fired };
}

export function addReminder(data: RemindersData, reminder: Reminder): RemindersData {
  return { ...data, reminders: [...data.reminders, reminder] };
}

export function createReminder(parsed: ParsedReminder, id: string): Reminder {
  return { id, text: parsed.text, priority: parsed.priority, due: parsed.due, repeat: parsed.repeat, snoozedUntil: null, firedAt: null };
}

export function editReminder(
  data: RemindersData,
  id: string,
  changes: Pick<Reminder, "text" | "due" | "repeat">,
): RemindersData {
  const text = changes.text.trim();
  if (!text) return data;
  return {
    ...data,
    reminders: data.reminders.map((reminder) => {
      if (reminder.id !== id) return reminder;
      // Only a new time or repeat starts the reminder over. A text fix keeps it overdue or snoozed,
      // so editing does not set the alert off again.
      const rescheduled =
        changes.due !== reminder.due || JSON.stringify(changes.repeat) !== JSON.stringify(reminder.repeat);
      return rescheduled
        ? { ...reminder, ...changes, text, firedAt: null, snoozedUntil: null }
        : { ...reminder, text };
    }),
  };
}

export function setReminderIcon(data: RemindersData, id: string, icon: string): RemindersData {
  return {
    ...data,
    reminders: data.reminders.map((reminder) => (reminder.id === id ? { ...reminder, icon } : reminder)),
  };
}

const NEXT_PRIORITY: Record<ReminderPriority, ReminderPriority> = { high: "medium", medium: "low", low: "high" };

export function cyclePriority(data: RemindersData, id: string): RemindersData {
  return {
    ...data,
    reminders: data.reminders.map((reminder) =>
      reminder.id === id ? { ...reminder, priority: NEXT_PRIORITY[reminder.priority] } : reminder,
    ),
  };
}

export function deleteReminder(data: RemindersData, id: string): RemindersData {
  return { ...data, reminders: data.reminders.filter((reminder) => reminder.id !== id) };
}

// Marks the current occurrence done. A repeating reminder stays, on its next time.
export function completeReminder(data: RemindersData, id: string, now: Date): RemindersData {
  const reminder = data.reminders.find((candidate) => candidate.id === id);
  if (!reminder) return data;
  const doneAt = toStamp(now);
  const entry: DoneEntry = { id: `${id}@${doneAt}`, text: reminder.text, at: reminder.firedAt ?? reminder.due, doneAt };
  if (!reminder.repeat) {
    return { reminders: data.reminders.filter((candidate) => candidate.id !== id), done: [entry, ...data.done] };
  }
  const due = reminder.firedAt === null ? nextDue(reminder.repeat, reminder.due) : reminder.due;
  return {
    reminders: data.reminders.map((candidate) =>
      candidate.id === id ? { ...candidate, due, firedAt: null, snoozedUntil: null } : candidate,
    ),
    done: [entry, ...data.done],
  };
}

export function snoozeReminder(data: RemindersData, id: string, until: string): RemindersData {
  return {
    ...data,
    reminders: data.reminders.map((reminder) => {
      if (reminder.id !== id) return reminder;
      return reminder.repeat
        ? { ...reminder, snoozedUntil: until, firedAt: null }
        : { ...reminder, due: until, firedAt: null };
    }),
  };
}

export function deleteDoneEntry(data: RemindersData, id: string): RemindersData {
  return { ...data, done: data.done.filter((entry) => entry.id !== id) };
}

export type SnoozeChoice = "15m" | "30m" | "4h" | "tomorrow";

export const SNOOZE_CHOICES: { choice: SnoozeChoice; label: string }[] = [
  { choice: "15m", label: "15 min" },
  { choice: "30m", label: "30 min" },
  { choice: "4h", label: "4 hr" },
  { choice: "tomorrow", label: "Tomorrow" },
];

// 15 minutes, 30 minutes and 4 hours from now, or 9:00 the next morning.
export function snoozeTime(choice: SnoozeChoice, now: Date): string {
  if (choice === "tomorrow") return `${addDays(dayKey(now), 1)}T${DEFAULT_TIME}`;
  const minutes = { "15m": 15, "30m": 30, "4h": 240 }[choice];
  return toStamp(new Date(now.getTime() + minutes * 60_000));
}

export interface ReminderGroup {
  key: "overdue" | "today" | "tomorrow" | "week" | "later";
  label: string;
  items: Reminder[];
}

// Overdue first, then by day. Only groups that have something in them are returned.
export function groupReminders(data: RemindersData, now: Date): ReminderGroup[] {
  const today = dayKey(now);
  const tomorrow = addDays(today, 1);
  const weekEnd = addDays(today, 7);
  const groups: ReminderGroup[] = [
    { key: "overdue", label: "Overdue", items: [] },
    { key: "today", label: "Today", items: [] },
    { key: "tomorrow", label: "Tomorrow", items: [] },
    { key: "week", label: "This week", items: [] },
    { key: "later", label: "Later", items: [] },
  ];
  // By time, and at the same time the higher priority first.
  const rank = { high: 0, medium: 1, low: 2 };
  const sorted = [...data.reminders].sort(
    (a, b) =>
      (nextTrigger(a) ?? a.firedAt ?? "").localeCompare(nextTrigger(b) ?? b.firedAt ?? "") ||
      rank[a.priority] - rank[b.priority],
  );
  for (const reminder of sorted) {
    const when = dayOf(nextTrigger(reminder) ?? reminder.due);
    const key = isOverdue(reminder)
      ? "overdue"
      : when <= today
        ? "today"
        : when === tomorrow
          ? "tomorrow"
          : when < weekEnd
            ? "week"
            : "later";
    groups.find((group) => group.key === key)?.items.push(reminder);
  }
  return groups.filter((group) => group.items.length > 0);
}

// The soonest upcoming time across lists, and how many reminders wait for an answer.
export function summarise(lists: RemindersData[]): { next: Reminder | null; overdue: number } {
  let next: Reminder | null = null;
  let overdue = 0;
  for (const list of lists) {
    for (const reminder of list.reminders) {
      if (isOverdue(reminder)) overdue++;
      const trigger = nextTrigger(reminder);
      if (trigger !== null && (next === null || trigger < (nextTrigger(next) ?? "~"))) next = reminder;
    }
  }
  return { next, overdue };
}

// --- Typing a sentence ---

export interface ParsedReminder {
  text: string;
  priority: ReminderPriority;
  due: string;
  repeat: Repeat | null;
}

const WEEKDAY_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const MONTH_NAMES = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const NTH_WORDS: Record<string, number> = {
  "1st": 1, first: 1, "2nd": 2, second: 2, "3rd": 3, third: 3, "4th": 4, fourth: 4, last: -1,
};
const WD = "(?:sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:rs?|rsday)?|fri(?:day)?|sat(?:urday)?)";
const weekdayIndex = (word: string) => WEEKDAY_NAMES.indexOf(word.slice(0, 3).toLowerCase());
const monthIndex = (word: string) => MONTH_NAMES.indexOf(word.slice(0, 3).toLowerCase());

// Takes the first match of a pattern out of the text.
function take(text: string, pattern: RegExp): { text: string; match: RegExpMatchArray | null } {
  const match = text.match(pattern);
  return match ? { text: text.replace(pattern, " "), match } : { text, match: null };
}

function parseRepeat(input: string): { text: string; repeat: Repeat | null; explicitDay: number | null } {
  let text = input;
  let found = take(text, new RegExp(`\\bevery\\s+(1st|2nd|3rd|4th|first|second|third|fourth|last)\\s+(${WD})\\b`, "i"));
  if (found.match) {
    return {
      text: found.text,
      repeat: { kind: "monthly-nth", every: 1, nth: NTH_WORDS[found.match[1].toLowerCase()], weekday: weekdayIndex(found.match[2]) },
      explicitDay: null,
    };
  }
  found = take(text, /\bevery\s+(\d+)\s+(day|week|month|year)s?\b/i);
  if (found.match) {
    const every = Math.max(1, Number(found.match[1]));
    const unit = found.match[2].toLowerCase();
    text = found.text;
    if (unit === "day") return { text, repeat: { kind: "daily", every }, explicitDay: null };
    if (unit === "week") return { text, repeat: { kind: "weekly", every, weekdays: [] }, explicitDay: null };
    if (unit === "month") return { text, repeat: { kind: "monthly", every, monthDay: 0 }, explicitDay: null };
    return { text, repeat: { kind: "yearly", every }, explicitDay: null };
  }
  found = take(text, /\bevery\s+weekday\b/i);
  if (found.match) return { text: found.text, repeat: { kind: "weekly", every: 1, weekdays: [1, 2, 3, 4, 5] }, explicitDay: null };
  found = take(text, new RegExp(`\\bevery\\s+(${WD}(?:\\s*(?:,|and|&)\\s*${WD})*)\\b`, "i"));
  if (found.match) {
    const weekdays = [...new Set(found.match[1].split(/\s*(?:,|and|&)\s*/i).map(weekdayIndex))].sort();
    return { text: found.text, repeat: { kind: "weekly", every: 1, weekdays }, explicitDay: null };
  }
  found = take(text, /\b(daily|every\s+day)\b/i);
  if (found.match) return { text: found.text, repeat: { kind: "daily", every: 1 }, explicitDay: null };
  found = take(text, /\b(weekly|every\s+week)\b/i);
  if (found.match) return { text: found.text, repeat: { kind: "weekly", every: 1, weekdays: [] }, explicitDay: null };
  found = take(text, /\b(monthly|every\s+month)\b/i);
  if (found.match) {
    const onDay = take(found.text, /\bon\s+the\s+(\d{1,2})(?:st|nd|rd|th)\b/i);
    return {
      text: onDay.text,
      repeat: { kind: "monthly", every: 1, monthDay: 0 },
      explicitDay: onDay.match ? Number(onDay.match[1]) : null,
    };
  }
  found = take(text, /\b(yearly|annually|every\s+year)\b/i);
  if (found.match) return { text: found.text, repeat: { kind: "yearly", every: 1 }, explicitDay: null };
  return { text, repeat: null, explicitDay: null };
}

function parseTime(input: string): { text: string; time: string | null } {
  let found = take(input, /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (found.match) {
    const hour = Number(found.match[1]) % 12 + (found.match[3].toLowerCase() === "pm" ? 12 : 0);
    return { text: found.text, time: `${pad(hour)}:${found.match[2] ?? "00"}` };
  }
  found = take(input, /\b(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (found.match) return { text: found.text, time: `${pad(Number(found.match[1]))}:${found.match[2]}` };
  found = take(input, /\bnoon\b/i);
  if (found.match) return { text: found.text, time: "12:00" };
  return { text: input, time: null };
}

function parseDate(input: string, today: string): { text: string; day: string | null } {
  let found = take(input, /\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (found.match) return { text: found.text, day: found.match[0] };
  found = take(input, /\btoday\b/i);
  if (found.match) return { text: found.text, day: today };
  found = take(input, /\btomorrow\b/i);
  if (found.match) return { text: found.text, day: addDays(today, 1) };
  found = take(input, new RegExp(`\\b(?:(next)\\s+)?(?:on\\s+)?(${WD})\\b`, "i"));
  if (found.match) {
    const target = weekdayIndex(found.match[2]);
    let offset = (target - weekdayOf(today) + 7) % 7;
    if (found.match[1] && offset === 0) offset = 7;
    return { text: found.text, day: addDays(today, offset) };
  }
  const months = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
  found = take(input, new RegExp(`\\b(?:on\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s+(${months})\\b`, "i"));
  const dayFirst = found.match !== null;
  if (!found.match) found = take(input, new RegExp(`\\b(?:on\\s+)?(${months})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, "i"));
  if (found.match) {
    const date = Number(dayFirst ? found.match[1] : found.match[2]);
    const month = monthIndex(dayFirst ? found.match[2] : found.match[1]);
    const [year] = today.split("-").map(Number);
    let candidate = dayKey(new Date(year, month, date));
    if (candidate < today) candidate = dayKey(new Date(year + 1, month, date));
    return { text: found.text, day: candidate };
  }
  return { text: input, day: null };
}

// Turns "call mum tomorrow 9am" or "stand up every weekday 9:30" into a reminder.
export function parseReminder(raw: string, now: Date): ParsedReminder {
  const today = dayKey(now);
  const nowStamp = toStamp(now);
  // "!high" sets the priority; "@friday" and "@12 nov" are the same as the plain words.
  let priority: ReminderPriority = "medium";
  let text = raw
    .replace(/(^|\s)!(high|medium|low)\b/gi, (_match, space: string, level: string) => {
      priority = level.toLowerCase() as ReminderPriority;
      return space;
    })
    .replace(/(^|\s)@(?=\S)/g, "$1")
    .trim();

  const relative = take(text, /\bin\s+(\d+)\s*(min(?:ute)?s?|hours?|hrs?|days?|weeks?)\b/i);
  const repeatResult = parseRepeat(relative.match ? relative.text : text);
  text = repeatResult.text;
  let repeat = repeatResult.repeat;
  const timeResult = parseTime(text);
  const dateResult = parseDate(timeResult.text, today);
  text = dateResult.text
    .replace(/^\s*remind me( to)?\b/i, " ")
    .replace(/^\s*(to|at|on|in)\b|\b(at|on|in|to|every)\s*$/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  let due: string;
  if (relative.match) {
    const amount = Number(relative.match[1]);
    const unit = relative.match[2].toLowerCase();
    const minutes = unit.startsWith("min") ? amount : unit.startsWith("h") ? amount * 60 : unit.startsWith("d") ? amount * 1440 : amount * 10080;
    due = toStamp(new Date(now.getTime() + minutes * 60_000));
  } else {
    const time = timeResult.time ?? DEFAULT_TIME;
    due = `${dateResult.day ?? today}T${time}`;
    if (dateResult.day === null && due <= nowStamp) due = `${addDays(today, 1)}T${time}`;
  }

  if (repeat) {
    const startDay = dayOf(due);
    if (repeat.kind === "weekly" && repeat.weekdays.length === 0) repeat = { ...repeat, weekdays: [weekdayOf(startDay)] };
    if (repeat.kind === "monthly") {
      repeat = { ...repeat, monthDay: repeatResult.explicitDay ?? Number(startDay.slice(8, 10)) };
    }
    due = firstOnOrAfter(repeat, due);
    if (dateResult.day === null && due <= nowStamp) due = nextDue(repeat, due);
  }

  return { text: text || "Reminder", priority, due, repeat };
}

function ordinal(value: number): string {
  const suffix = value % 100 >= 11 && value % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][value % 10] ?? "th");
  return `${value}${suffix}`;
}

// "every 2 weeks on Mon, Wed" style summary for the list.
export function describeRepeat(repeat: Repeat | null): string {
  if (!repeat) return "";
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const every = repeat.every > 1 ? `every ${repeat.every} ` : "every ";
  switch (repeat.kind) {
    case "daily":
      return repeat.every > 1 ? `${every}days` : "daily";
    case "weekly": {
      if (repeat.weekdays.join() === "1,2,3,4,5" && repeat.every === 1) return "every weekday";
      const days = repeat.weekdays.map((day) => names[day]);
      if (repeat.every === 1) return `every ${days.join(" and ")}`;
      return `${every}weeks on ${days.join(", ")}`;
    }
    case "monthly":
      return `${repeat.every > 1 ? `${every}months` : "monthly"} on the ${ordinal(repeat.monthDay)}`;
    case "monthly-nth":
      return `${every}${repeat.nth === -1 ? "last" : ["", "1st", "2nd", "3rd", "4th"][repeat.nth]} ${names[repeat.weekday]}`;
    case "yearly":
      return repeat.every > 1 ? `${every}years` : "yearly";
  }
}

// --- Saving ---

function isRepeat(value: unknown): value is Repeat {
  if (typeof value !== "object" || value === null) return false;
  const repeat = value as Record<string, unknown>;
  const number = (field: string, min: number, max: number) =>
    Number.isInteger(repeat[field]) && (repeat[field] as number) >= min && (repeat[field] as number) <= max;
  if (!number("every", 1, 1000)) return false;
  switch (repeat.kind) {
    case "daily":
    case "yearly":
      return true;
    case "weekly":
      return (
        Array.isArray(repeat.weekdays) &&
        repeat.weekdays.length > 0 &&
        repeat.weekdays.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)
      );
    case "monthly":
      return number("monthDay", 1, 31);
    case "monthly-nth":
      return (number("nth", 1, 4) || repeat.nth === -1) && number("weekday", 0, 6);
    default:
      return false;
  }
}

const isStamp = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value);

function isReminder(value: unknown): value is Reminder {
  if (typeof value !== "object" || value === null) return false;
  const reminder = value as Partial<Reminder>;
  return (
    typeof reminder.id === "string" &&
    typeof reminder.text === "string" &&
    ["high", "medium", "low"].includes(String(reminder.priority)) &&
    (reminder.icon === undefined || isIcon(reminder.icon)) &&
    isStamp(reminder.due) &&
    (reminder.repeat === null || isRepeat(reminder.repeat)) &&
    (reminder.snoozedUntil === null || isStamp(reminder.snoozedUntil)) &&
    (reminder.firedAt === null || isStamp(reminder.firedAt))
  );
}

// Reminders saved before priority existed are medium.
function withPriority(value: unknown): unknown {
  if (typeof value !== "object" || value === null) return value;
  const reminder = value as { priority?: unknown };
  return ["high", "medium", "low"].includes(String(reminder.priority)) ? value : { ...reminder, priority: "medium" };
}

function isDoneEntry(value: unknown): value is DoneEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Partial<DoneEntry>;
  return typeof entry.id === "string" && typeof entry.text === "string" && isStamp(entry.at) && isStamp(entry.doneAt);
}

export function loadReminders(storage: Pick<Storage, "getItem">): Record<string, RemindersData> {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(REMINDERS_KEY) ?? "null");
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    const lists: Record<string, RemindersData> = {};
    for (const [frameId, data] of Object.entries(parsed)) {
      const { reminders, done } = (data ?? {}) as { reminders?: unknown; done?: unknown };
      lists[frameId] = {
        reminders: Array.isArray(reminders)
          ? reminders.map(withPriority).filter(isReminder)
          : [],
        done: Array.isArray(done) ? done.filter(isDoneEntry) : [],
      };
    }
    return lists;
  } catch {
    return {};
  }
}

export function saveReminders(storage: Pick<Storage, "setItem">, lists: Record<string, RemindersData>): void {
  try {
    storage.setItem(REMINDERS_KEY, JSON.stringify(lists));
  } catch {
    // Storage may be unavailable or full; the in-memory state remains authoritative.
  }
}
