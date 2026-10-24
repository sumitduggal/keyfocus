export type TodoPriority = "high" | "medium" | "low";

export interface TodoItem {
  id: string;
  text: string;
  done: boolean;
  priority: TodoPriority;
  due: string | null; // "YYYY-MM-DD" or null
  parentId: string | null; // one level deep: the id of the item this step belongs to
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
  return {
    id,
    text: parsed.text,
    done: false,
    priority: parsed.priority,
    due: parsed.due,
    parentId: null,
  };
}

// Overdue: not done, and due on a day before `today`.
export function isOverdue(item: TodoItem, today: Date): boolean {
  return !item.done && item.due !== null && item.due < formatLocalDate(today);
}

// Removes done items, and any nested items under a removed parent.
export function clearCompletedTodos(items: TodoItem[]): TodoItem[] {
  const removed = new Set(items.filter((item) => item.done).map((item) => item.id));
  return items.filter(
    (item) => !removed.has(item.id) && !(item.parentId !== null && removed.has(item.parentId)),
  );
}

export function progressCounts(items: TodoItem[]): { done: number; total: number } {
  return { done: items.filter((item) => item.done).length, total: items.length };
}

// Blank text is ignored, so the previous text is kept.
export function updateTodoText(items: TodoItem[], id: string, text: string): TodoItem[] {
  const trimmed = text.trim();
  if (trimmed === "") return items;
  return items.map((item) => (item.id === id ? { ...item, text: trimmed } : item));
}

export function addTodoItem(items: TodoItem[], item: TodoItem): TodoItem[] {
  if (item.text === "") return items;
  return [...items, item];
}

export function toggleTodoItem(items: TodoItem[], id: string): TodoItem[] {
  return items.map((item) => (item.id === id ? { ...item, done: !item.done } : item));
}

// Deleting an item also deletes its steps.
export function deleteTodoItem(items: TodoItem[], id: string): TodoItem[] {
  return items.filter((item) => item.id !== id && item.parentId !== id);
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

// Swaps an item with its previous (-1) or next (+1) sibling: items sharing its parent.
export function moveTodoItem(items: TodoItem[], id: string, delta: -1 | 1): TodoItem[] {
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return items;
  const parentId = items[index].parentId;
  let target = index + delta;
  while (target >= 0 && target < items.length && items[target].parentId !== parentId) {
    target += delta;
  }
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

// Items in the order they are shown: each top-level item, followed by its steps.
function displayOrder(items: TodoItem[]): TodoItem[] {
  const ids = new Set(items.map((item) => item.id));
  const tops = items.filter((item) => item.parentId === null || !ids.has(item.parentId));
  return tops.flatMap((top) => [top, ...items.filter((item) => item.parentId === top.id)]);
}

// Nests an item under the group of the item directly above it, as shown on screen.
// A parent with steps cannot be nested, and a step is already nested.
export function nestTodoItem(items: TodoItem[], id: string): TodoItem[] {
  const shown = displayOrder(items);
  const position = shown.findIndex((item) => item.id === id);
  if (position <= 0) return items;
  const target = shown[position];
  if (target.parentId !== null) return items;
  if (items.some((item) => item.parentId === id)) return items;
  const above = shown[position - 1];
  const groupId = above.parentId ?? above.id;
  return items.map((item) => (item.id === id ? { ...item, parentId: groupId } : item));
}

// Puts back items removed since `previous`, in their old order, without dropping items added since.
export function restoreTodoItems(current: TodoItem[], previous: TodoItem[]): TodoItem[] {
  const currentById = new Map(current.map((item) => [item.id, item]));
  const previousIds = new Set(previous.map((item) => item.id));
  const restored = previous.map((item) => currentById.get(item.id) ?? item);
  return [...restored, ...current.filter((item) => !previousIds.has(item.id))];
}

export function unnestTodoItem(items: TodoItem[], id: string): TodoItem[] {
  return items.map((item) => (item.id === id ? { ...item, parentId: null } : item));
}

export type TodoFilter = "all" | "open" | "overdue";
export type TodoSort = "manual" | "priority" | "due";
export interface TodoView {
  filter: TodoFilter;
  sort: TodoSort;
}
export interface TodoGroup {
  parent: TodoItem;
  children: TodoItem[];
}

const PRIORITY_RANK: Record<TodoPriority, number> = { high: 0, medium: 1, low: 2 };

// Top-level groups (an item and its steps) after filtering and sorting.
// A group is shown when its parent or any of its steps matches the filter.
export function visibleTodoGroups(items: TodoItem[], view: TodoView, today: Date): TodoGroup[] {
  const ids = new Set(items.map((item) => item.id));
  const matches = (item: TodoItem) =>
    view.filter === "all" ||
    (view.filter === "open" ? !item.done : isOverdue(item, today));

  const groups: TodoGroup[] = items
    .filter((item) => item.parentId === null || !ids.has(item.parentId))
    .map((parent) => ({
      parent,
      children: items.filter((item) => item.parentId === parent.id),
    }))
    .filter((group) => matches(group.parent) || group.children.some(matches));

  if (view.sort === "priority") {
    groups.sort((a, b) => PRIORITY_RANK[a.parent.priority] - PRIORITY_RANK[b.parent.priority]);
  } else if (view.sort === "due") {
    groups.sort((a, b) => {
      const aDue = a.parent.due ?? "\uffff";
      const bDue = b.parent.due ?? "\uffff";
      return aDue < bDue ? -1 : aDue > bDue ? 1 : 0;
    });
  }
  return groups;
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

// Older items have no parent field; a parent that no longer exists is treated as top-level.
// A parent must exist, must not be the item itself, and must be top-level (steps are one level deep).
function withValidParents(items: TodoItem[]): TodoItem[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const candidate = (item: TodoItem) =>
    typeof item.parentId === "string" && item.parentId !== item.id && byId.has(item.parentId)
      ? item.parentId
      : null;
  return items.map((item) => {
    const parentId = candidate(item);
    const parent = parentId === null ? null : byId.get(parentId)!;
    return { ...item, parentId: parent !== null && candidate(parent) === null ? parentId : null };
  });
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
        lists[frameId] = withValidParents(items.filter(isTodoItem));
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
