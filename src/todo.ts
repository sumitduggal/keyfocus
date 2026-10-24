export type TodoPriority = "high" | "medium" | "low";

export interface TodoItem {
  id: string;
  text: string;
  done: boolean;
  priority: TodoPriority;
  due: string | null; // "YYYY-MM-DD" or null
}

export interface ParsedTodoInput {
  text: string;
  priority: TodoPriority;
  due: string | null;
}

export const TODO_STORAGE_KEY = "focus-space-todo-lists";

const PRIORITY_TOKENS = new Map<string, TodoPriority>([
  ["!high", "high"],
  ["!medium", "medium"],
  ["!low", "low"],
]);

const WEEKDAYS = new Map<string, number>([
  ["sunday", 0],
  ["monday", 1],
  ["tuesday", 2],
  ["wednesday", 3],
  ["thursday", 4],
  ["friday", 5],
  ["saturday", 6],
]);

const MONTHS = new Map<string, number>([
  ["january", 1],
  ["jan", 1],
  ["february", 2],
  ["feb", 2],
  ["march", 3],
  ["mar", 3],
  ["april", 4],
  ["apr", 4],
  ["may", 5],
  ["june", 6],
  ["jun", 6],
  ["july", 7],
  ["jul", 7],
  ["august", 8],
  ["aug", 8],
  ["september", 9],
  ["sep", 9],
  ["october", 10],
  ["oct", 10],
  ["november", 11],
  ["nov", 11],
  ["december", 12],
  ["dec", 12],
]);

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_NUMBER = /^(\d{1,2})$/;
const YEARS_TO_SEARCH = 9;

function pad(value: number, width = 2): string {
  return String(value).padStart(width, "0");
}

function formatLocalDate(date: Date): string {
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function resolveIsoDate(body: string): string | null {
  const match = ISO_DATE.exec(body);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(year, month - 1, day);
  if (
    candidate.getFullYear() !== year ||
    candidate.getMonth() !== month - 1 ||
    candidate.getDate() !== day
  ) {
    return null;
  }
  return formatLocalDate(candidate);
}

function resolveWeekday(weekday: number, base: Date): string {
  const diff = (weekday - base.getDay() + 7) % 7;
  return formatLocalDate(new Date(base.getFullYear(), base.getMonth(), base.getDate() + diff));
}

function resolveDayMonth(day: number, month: number, base: Date): string | null {
  const daysInMonth = new Date(2000, month, 0).getDate(); // 2000 is a leap year
  if (day < 1 || day > daysInMonth) return null;
  for (let year = base.getFullYear(); year <= base.getFullYear() + YEARS_TO_SEARCH; year++) {
    const candidate = new Date(year, month - 1, day);
    if (candidate.getDate() !== day) continue; // e.g. 29 Feb in a non-leap year
    if (candidate < base) continue; // already passed, try next year
    return formatLocalDate(candidate);
  }
  return null;
}

function resolveSingleToken(body: string, base: Date): string | null {
  if (body === "today") return formatLocalDate(base);
  if (body === "tomorrow") {
    return formatLocalDate(new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1));
  }
  const weekday = WEEKDAYS.get(body);
  if (weekday !== undefined) return resolveWeekday(weekday, base);
  return resolveIsoDate(body);
}

export function parseTodoInput(raw: string, today: Date): ParsedTodoInput {
  const base = startOfDay(today);
  const tokens = raw.split(/\s+/).filter((token) => token.length > 0);
  const kept: string[] = [];
  let priority: TodoPriority = "medium";
  let due: string | null = null;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const lower = token.toLowerCase();

    const priorityValue = PRIORITY_TOKENS.get(lower);
    if (priorityValue !== undefined) {
      priority = priorityValue;
      continue;
    }

    if (!lower.startsWith("@")) {
      kept.push(token);
      continue;
    }

    const body = lower.slice(1);
    const resolved = resolveSingleToken(body, base);
    if (resolved !== null) {
      due = resolved;
      continue;
    }

    const dayMatch = DAY_NUMBER.exec(body);
    const nextToken = tokens[i + 1];
    const month = nextToken === undefined ? undefined : MONTHS.get(nextToken.toLowerCase());
    if (dayMatch && month !== undefined) {
      const dayMonth = resolveDayMonth(Number(dayMatch[1]), month, base);
      if (dayMonth !== null) {
        due = dayMonth;
        i++; // consume the month token as well
        continue;
      }
    }

    kept.push(token);
  }

  return { text: kept.join(" "), priority, due };
}

export function createTodoItem(parsed: ParsedTodoInput, id: string): TodoItem {
  return { id, text: parsed.text, done: false, priority: parsed.priority, due: parsed.due };
}

export function addTodoItem(items: TodoItem[], item: TodoItem): TodoItem[] {
  if (item.text === "") return items;
  return [...items, item];
}

export function toggleTodoItem(items: TodoItem[], id: string): TodoItem[] {
  return items.map((item) => (item.id === id ? { ...item, done: !item.done } : item));
}

export function deleteTodoItem(items: TodoItem[], id: string): TodoItem[] {
  return items.filter((item) => item.id !== id);
}

const NEXT_PRIORITY: Record<TodoPriority, TodoPriority> = {
  high: "medium",
  medium: "low",
  low: "high",
};

export function cyclePriority(items: TodoItem[], id: string): TodoItem[] {
  return items.map((item) =>
    item.id === id ? { ...item, priority: NEXT_PRIORITY[item.priority] } : item,
  );
}

export function openTodoCount(items: TodoItem[]): number {
  return items.filter((item) => !item.done).length;
}

function isTodoItem(value: unknown): value is TodoItem {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.text === "string" &&
    typeof item.done === "boolean" &&
    (item.priority === "high" || item.priority === "medium" || item.priority === "low") &&
    (item.due === null || typeof item.due === "string")
  );
}

export function loadTodoLists(storage: Pick<Storage, "getItem">): Record<string, TodoItem[]> {
  try {
    const raw = storage.getItem(TODO_STORAGE_KEY);
    if (raw === null) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};

    const lists: Record<string, TodoItem[]> = {};
    for (const [frameId, items] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(items)) {
        lists[frameId] = items.filter(isTodoItem);
      }
    }
    return lists;
  } catch {
    return {};
  }
}

export function saveTodoLists(
  storage: Pick<Storage, "setItem">,
  lists: Record<string, TodoItem[]>,
): void {
  try {
    storage.setItem(TODO_STORAGE_KEY, JSON.stringify(lists));
  } catch {
    // Storage may be unavailable or full; the in-memory state remains authoritative.
  }
}
