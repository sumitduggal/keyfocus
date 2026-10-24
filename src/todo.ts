export type TodoPriority = "high" | "medium" | "low";

export interface TodoItem {
  id: string;
  text: string;
  done: boolean;
  priority: TodoPriority;
  due: string | null; // "YYYY-MM-DD" or null
  parentId: string | null; // the id of the item this step belongs to; null at the top level
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

// Removes done items, and every step under a removed item.
export function clearCompletedTodos(items: TodoItem[]): TodoItem[] {
  const removed = new Set<string>();
  for (const item of items.filter((candidate) => candidate.done)) {
    subtreeIds(items, item.id).forEach((id) => removed.add(id));
  }
  return items.filter((item) => !removed.has(item.id));
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

// Ids of an item and every step under it, at any depth.
function subtreeIds(items: TodoItem[], id: string): Set<string> {
  const ids = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const item of items) {
      if (item.parentId !== null && ids.has(item.parentId) && !ids.has(item.id)) {
        ids.add(item.id);
        grew = true;
      }
    }
  }
  return ids;
}

// Deleting an item also deletes its steps, at every depth.
export function deleteTodoItem(items: TodoItem[], id: string): TodoItem[] {
  const removed = subtreeIds(items, id);
  return items.filter((item) => !removed.has(item.id));
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

// Items in the order they are shown: each top-level item, then its steps depth-first.
function displayRows(items: TodoItem[]): { item: TodoItem; depth: number }[] {
  const ids = new Set(items.map((item) => item.id));
  const walk = (parentId: string | null, depth: number): { item: TodoItem; depth: number }[] =>
    items
      .filter((item) => (parentId === null ? item.parentId === null || !ids.has(item.parentId) : item.parentId === parentId))
      .flatMap((item) => [{ item, depth }, ...walk(item.id, depth + 1)]);
  return walk(null, 0);
}

function displayOrder(items: TodoItem[]): TodoItem[] {
  return displayRows(items).map((row) => row.item);
}

// True when `candidate` sits inside `ancestor`'s subtree.
function isInside(items: TodoItem[], candidate: string, ancestor: string): boolean {
  let current: string | null = candidate;
  const seen = new Set<string>();
  while (current !== null && !seen.has(current)) {
    if (current === ancestor) return true;
    seen.add(current);
    current = items.find((item) => item.id === current)?.parentId ?? null;
  }
  return false;
}

// Nests an item (with its own steps) under the item shown directly above it.
// Refused when that item is one of the item's own steps, since that would make a cycle.
export function nestTodoItem(items: TodoItem[], id: string, shownIds?: string[]): TodoItem[] {
  // `shownIds` is the order on screen (it may differ when sorted or filtered); defaults to the saved order.
  const shown = shownIds ?? displayOrder(items).map((item) => item.id);
  const position = shown.indexOf(id);
  if (position <= 0) return items;
  const above = items.find((item) => item.id === shown[position - 1]);
  if (!above) return items;
  if (isInside(items, above.id, id)) return items;
  return items.map((item) => (item.id === id ? { ...item, parentId: above.id } : item));
}


// Moves an item up one level: it becomes a sibling of its parent.
export function unnestTodoItem(items: TodoItem[], id: string): TodoItem[] {
  const target = items.find((item) => item.id === id);
  if (!target || target.parentId === null) return items;
  const parent = items.find((item) => item.id === target.parentId);
  const grandparentId = parent?.parentId ?? null;
  return items.map((item) => (item.id === id ? { ...item, parentId: grandparentId } : item));
}

export type TodoFilter = "all" | "open" | "overdue";
export type TodoSort = "manual" | "priority" | "due";
export interface TodoView {
  filter: TodoFilter;
  sort: TodoSort;
}
export interface TodoGroup {
  parent: TodoItem;
  children: TodoItem[]; // every step under the parent, depth-first
  rows: { item: TodoItem; depth: number }[]; // the parent and its steps, with indentation depth
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
    .map((parent) => {
      const rows = displayRows(
        items.filter((item) => item.id === parent.id || isInside(items, item.id, parent.id)),
      );
      return { parent, rows, children: rows.slice(1).map((row) => row.item) };
    })
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
// A parent must exist and must not be the item itself. An item whose parents loop back to it is made top-level.
function withValidParents(items: TodoItem[]): TodoItem[] {
  const ids = new Set(items.map((item) => item.id));
  const parentOf = new Map(
    items.map((item) => [
      item.id,
      typeof item.parentId === "string" && item.parentId !== item.id && ids.has(item.parentId)
        ? item.parentId
        : null,
    ]),
  );
  for (const item of items) {
    const seen = new Set([item.id]);
    let current = parentOf.get(item.id) ?? null;
    while (current !== null && !seen.has(current)) {
      seen.add(current);
      current = parentOf.get(current) ?? null;
    }
    if (current !== null) parentOf.set(item.id, null);
  }
  return items.map((item) => ({ ...item, parentId: parentOf.get(item.id) ?? null }));
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

// Moves an item before or after a target row. It takes the target's parent. An item cannot be dropped inside its own steps.
export function moveTodoItemTo(
  items: TodoItem[],
  id: string,
  targetId: string,
  placement: "before" | "after",
): TodoItem[] {
  if (id === targetId) return items;
  const moving = items.find((item) => item.id === id);
  const target = items.find((item) => item.id === targetId);
  if (!moving || !target || isInside(items, targetId, id)) return items;
  const rest = items.filter((item) => item.id !== id);
  const index = rest.findIndex((item) => item.id === targetId) + (placement === "after" ? 1 : 0);
  const moved = { ...moving, parentId: target.parentId };
  return [...rest.slice(0, index), moved, ...rest.slice(index)];
}

export type TodoViewState = TodoView;
export const TODO_VIEWS_KEY = "focus-space-todo-views";

const FILTERS: TodoFilter[] = ["all", "open", "overdue"];
const SORTS: TodoSort[] = ["manual", "priority", "due"];

// Sort and filter per list, so each list opens the way it was left.
export function loadTodoViews(storage: Pick<Storage, "getItem">): Record<string, TodoViewState> {
  try {
    const raw = storage.getItem(TODO_VIEWS_KEY);
    if (raw === null) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    const views: Record<string, TodoViewState> = {};
    for (const [frameId, value] of Object.entries(parsed as Record<string, unknown>)) {
      const view = value as Partial<TodoViewState> | null;
      if (view && FILTERS.includes(view.filter as TodoFilter) && SORTS.includes(view.sort as TodoSort)) {
        views[frameId] = { filter: view.filter as TodoFilter, sort: view.sort as TodoSort };
      }
    }
    return views;
  } catch {
    return {};
  }
}

export function saveTodoViews(
  storage: Pick<Storage, "setItem">,
  views: Record<string, TodoViewState>,
): void {
  try {
    storage.setItem(TODO_VIEWS_KEY, JSON.stringify(views));
  } catch {
    // Storage can be full or blocked; the view simply resets on reload.
  }
}

// Open items due before today, including steps.
export function overdueCount(items: TodoItem[], today: Date): number {
  return items.filter((item) => isOverdue(item, today)).length;
}

// Sets an item's due date. A null (or empty) value clears it. Malformed dates are ignored.
export function setTodoDue(items: TodoItem[], id: string, due: string | null): TodoItem[] {
  if (due !== null && !ISO_DATE.test(due)) return items;
  return items.map((item) => (item.id === id ? { ...item, due } : item));
}
