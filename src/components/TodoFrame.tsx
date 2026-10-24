import { useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import {
  addTodoItem,
  clearCompletedTodos,
  createTodoItem,
  cyclePriority,
  deleteTodoItem,
  isOverdue,
  moveTodoItem,
  nestTodoItem,
  openTodoCount,
  parseTodoInput,
  progressCounts,
  toggleTodoItem,
  unnestTodoItem,
  updateTodoText,
  visibleTodoGroups,
  type TodoFilter,
  type TodoItem,
  type TodoSort,
} from "../todo";

interface Suggestion {
  value: string;
  label: string;
  hint: string;
}

const PRIORITY_SUGGESTIONS: Suggestion[] = [
  { value: "!high", label: "high", hint: "do first" },
  { value: "!medium", label: "medium", hint: "default" },
  { value: "!low", label: "low", hint: "when there is time" },
];

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

const shortDate = (date: Date) =>
  date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

// Today, tomorrow, then the next six weekdays, matching how the parser resolves @weekday.
function dateSuggestions(today: Date): Suggestion[] {
  const suggestions: Suggestion[] = [
    { value: "@today", label: "today", hint: shortDate(today) },
    { value: "@tomorrow", label: "tomorrow", hint: shortDate(addDays(today, 1)) },
  ];
  for (let offset = 2; offset <= 7; offset++) {
    const day = addDays(today, offset);
    const name = WEEKDAYS[day.getDay()];
    suggestions.push({ value: `@${name}`, label: name, hint: shortDate(day) });
  }
  return suggestions;
}

// The token under the cursor: the last whitespace-separated word of the draft.
const currentToken = (draft: string) => draft.split(/\s+/).pop() ?? "";

// Item text is edited in place and saved as you type. The stored text is shown when not editing,
// so undo and other changes always show what is saved. Leaving the field blank keeps the saved text.
function TodoTextInput({ item, onChange }: { item: TodoItem; onChange: (text: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      className="todo-text-input"
      aria-label={`Edit item: ${item.text}`}
      value={draft ?? item.text}
      onFocus={() => setDraft(item.text)}
      onChange={(event) => {
        setDraft(event.target.value);
        if (event.target.value.trim() !== "") onChange(event.target.value);
      }}
      onBlur={() => setDraft(null)}
    />
  );
}

export function TodoFrame({
  items,
  onChange,
  onDeleteList,
}: {
  items: TodoItem[];
  onChange: (items: TodoItem[]) => void;
  onDeleteList?: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const [dismissedToken, setDismissedToken] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [filter, setFilter] = useState<TodoFilter>("all");
  const [sort, setSort] = useState<TodoSort>("manual");
  const listRef = useRef<HTMLUListElement | null>(null);

  const today = new Date();
  const groups = visibleTodoGroups(items, { filter, sort }, today);
  const rows = groups.flatMap((group) => [
    { item: group.parent, step: false },
    ...group.children.map((child) => ({ item: child, step: true })),
  ]);
  const progress = progressCounts(items);
  const completedCount = progress.done;
  // Reordering only makes sense when every item is shown in its saved order.
  const canReorder = sort === "manual" && filter === "all";

  const token = currentToken(draft);
  const sigil = token.charAt(0);
  const prefix = token.slice(1).toLowerCase();
  const pool =
    sigil === "!"
      ? PRIORITY_SUGGESTIONS
      : sigil === "@"
        ? dateSuggestions(today)
        : [];
  const suggestions = pool.filter((option) => option.label.startsWith(prefix));
  const open = suggestions.length > 0 && dismissedToken !== token;
  const highlighted = suggestions[Math.min(activeSuggestion, suggestions.length - 1)];

  const updateDraft = (value: string) => {
    setDraft(value);
    setActiveSuggestion(0);
    setDismissedToken(null);
  };

  const acceptSuggestion = (option: Suggestion) => {
    updateDraft(`${draft.slice(0, draft.length - token.length)}${option.value} `);
  };

  const addItem = () => {
    const parsed = parseTodoInput(draft, new Date());
    if (parsed.text === "") return;
    onChange(addTodoItem(items, createTodoItem(parsed, crypto.randomUUID())));
    updateDraft("");
  };

  const handleInputKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (open && highlighted) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const delta = event.key === "ArrowDown" ? 1 : -1;
        setActiveSuggestion(
          (current) => (current + delta + suggestions.length) % suggestions.length,
        );
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        acceptSuggestion(highlighted);
        return;
      }
      if (event.key === "Escape") {
        // Close the list without letting the global Escape reset focus.
        event.preventDefault();
        event.stopPropagation();
        setDismissedToken(token);
        return;
      }
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      listRef.current?.querySelector<HTMLButtonElement>(".todo-check")?.focus();
    }
  };

  // Keeps keyboard focus on an item's check button after the list re-renders.
  const focusCheck = (id: string) => {
    requestAnimationFrame(() =>
      listRef.current?.querySelector<HTMLButtonElement>(`[data-todo-id="${id}"]`)?.focus(),
    );
  };

  // Rows are keyed by their check button, which is also the keyboard stop for each row.
  const handleListKey = (event: KeyboardEvent<HTMLUListElement>) => {
    const checks = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>(".todo-check") ?? []);
    const index = checks.indexOf(document.activeElement as HTMLButtonElement);
    if (index === -1) return;
    const id = checks[index].dataset.todoId ?? "";

    if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      if (!canReorder) return;
      onChange(moveTodoItem(items, id, event.key === "ArrowUp" ? -1 : 1));
      focusCheck(id);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      checks[index + (event.key === "ArrowDown" ? 1 : -1)]?.focus();
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      const removed = new Set([id, ...items.filter((item) => item.parentId === id).map((item) => item.id)]);
      const survivors = checks.filter((check) => !removed.has(check.dataset.todoId ?? ""));
      const next = survivors.find((check) => checks.indexOf(check) > index) ?? survivors[survivors.length - 1];
      onChange(deleteTodoItem(items, id));
      if (next) focusCheck(next.dataset.todoId ?? "");
    }
    if (event.key === "[") {
      event.preventDefault();
      onChange(nestTodoItem(items, id));
      focusCheck(id);
    }
    if (event.key === "]") {
      event.preventDefault();
      onChange(unnestTodoItem(items, id));
      focusCheck(id);
    }
  };

  return (
    <>
      <form
        className="todo-add"
        onSubmit={(event) => {
          event.preventDefault();
          addItem();
        }}
      >
        <input
          aria-label="New item"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls="todo-suggestions"
          data-autofocus={items.length === 0 ? "" : undefined}
          placeholder="Add item · ! priority  @ date"
          value={draft}
          onChange={(event) => updateDraft(event.target.value)}
          onKeyDown={handleInputKey}
        />
        {open && (
          <ul id="todo-suggestions" role="listbox" className="todo-suggest" aria-label="Suggestions">
            {suggestions.map((option, index) => (
              <li
                key={option.value}
                role="option"
                aria-selected={index === activeSuggestion}
                className={index === activeSuggestion ? "is-highlighted" : undefined}
                onMouseDown={(event) => {
                  event.preventDefault();
                  acceptSuggestion(option);
                }}
              >
                <span>{option.value}</span>
                <small>{option.hint}</small>
              </li>
            ))}
          </ul>
        )}
      </form>
      <p className="todo-hint">!high !medium !low · @today @tomorrow @friday @12 Nov @2026-11-12</p>

      <div className="todo-progress" role="progressbar" aria-label="Progress" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done}>
        <div className="todo-progress-bar" style={{ width: progress.total ? `${(progress.done / progress.total) * 100}%` : "0%" }} />
        <span>{progress.done} of {progress.total} done</span>
      </div>

      <div className="todo-view">
        <div role="group" aria-label="Filter">
          {(["all", "open", "overdue"] as TodoFilter[]).map((value) => (
            <button key={value} type="button" aria-pressed={filter === value} className={filter === value ? "is-selected" : ""} onClick={() => setFilter(value)}>
              {value}
            </button>
          ))}
        </div>
        <label>
          Sort
          <select value={sort} onChange={(event) => setSort(event.target.value as TodoSort)}>
            <option value="manual">manual</option>
            <option value="priority">priority</option>
            <option value="due">due date</option>
          </select>
        </label>
      </div>

      <ul ref={listRef} className="todo-list" aria-label="Todo items" onKeyDown={handleListKey}>
        {rows.map(({ item, step }, index) => {
          const overdue = isOverdue(item, today);
          const classes = ["todo-row"];
          if (item.done) classes.push("is-done");
          if (step) classes.push("is-step");
          if (overdue) classes.push("is-overdue");
          return (
            <li key={item.id} className={classes.join(" ")}>
              <button
                type="button"
                className="todo-check"
                data-todo-id={item.id}
                data-autofocus={index === 0 ? "" : undefined}
                aria-pressed={item.done}
                aria-label={`${item.done ? "Mark not done" : "Mark done"}: ${item.text}`}
                onClick={() => onChange(toggleTodoItem(items, item.id))}
              >
                {item.done ? "☑" : "☐"}
              </button>
              <TodoTextInput item={item} onChange={(text) => onChange(updateTodoText(items, item.id, text))} />
              <small className="todo-due">
                {item.due ?? ""}
                {overdue && <b className="todo-overdue"> overdue</b>}
              </small>
              <button
                type="button"
                className="todo-nest"
                aria-label={step ? `Move out of parent: ${item.text}` : `Nest under the item above: ${item.text}`}
                onClick={() => onChange(step ? unnestTodoItem(items, item.id) : nestTodoItem(items, item.id))}
              >
                {step ? "↰" : "↳"}
              </button>
              <button
                type="button"
                className={`todo-priority is-${item.priority}`}
                aria-label={`Priority ${item.priority}, change`}
                onClick={() => onChange(cyclePriority(items, item.id))}
              >
                {item.priority}
              </button>
              <button
                type="button"
                className="todo-remove"
                aria-label={`Delete ${item.text}`}
                onClick={() => onChange(deleteTodoItem(items, item.id))}
              >
                ×
              </button>
            </li>
          );
        })}
      </ul>

      {items.length === 0 && <p className="frame-foot">No items yet. Type above and press Enter.</p>}
      <p className="frame-foot">{openTodoCount(items)} open</p>

      {completedCount > 0 && (
        <button type="button" className="todo-clear" onClick={() => onChange(clearCompletedTodos(items))}>
          Clear completed ({completedCount})
        </button>
      )}

      {onDeleteList &&
        (confirmingDelete ? (
          <div className="todo-confirm" role="alertdialog" aria-label="Confirm delete list">
            <p>Delete this list and its {items.length} items? You can undo for a few seconds.</p>
            <div>
              <button type="button" className="todo-danger" onClick={onDeleteList}>
                Delete list
              </button>
              <button type="button" onClick={() => setConfirmingDelete(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="todo-delete-list" onClick={() => setConfirmingDelete(true)}>
            Delete list
          </button>
        ))}
    </>
  );
}
