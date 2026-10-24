import { useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import {
  addTodoItem,
  createTodoItem,
  cyclePriority,
  deleteTodoItem,
  openTodoCount,
  parseTodoInput,
  toggleTodoItem,
  type TodoItem,
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

export function TodoFrame({
  items,
  onChange,
}: {
  items: TodoItem[];
  onChange: (items: TodoItem[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const [dismissedToken, setDismissedToken] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  const token = currentToken(draft);
  const sigil = token.charAt(0);
  const prefix = token.slice(1).toLowerCase();
  const pool =
    sigil === "!"
      ? PRIORITY_SUGGESTIONS
      : sigil === "@"
        ? dateSuggestions(new Date())
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

  // Rows are keyed by their check button, which is also the keyboard stop for each row.
  const handleListKey = (event: KeyboardEvent<HTMLUListElement>) => {
    const checks = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>(".todo-check") ?? []);
    const index = checks.indexOf(document.activeElement as HTMLButtonElement);
    if (index === -1) return;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      checks[index + (event.key === "ArrowDown" ? 1 : -1)]?.focus();
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      const neighbour = checks[index + 1] ?? checks[index - 1];
      onChange(deleteTodoItem(items, items[index].id));
      neighbour?.focus();
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

      <ul ref={listRef} className="todo-list" aria-label="Todo items" onKeyDown={handleListKey}>
        {items.map((item, index) => (
          <li key={item.id} className={item.done ? "todo-row is-done" : "todo-row"}>
            <button
              type="button"
              className="todo-check"
              data-autofocus={index === 0 ? "" : undefined}
              aria-pressed={item.done}
              aria-label={`${item.done ? "Mark not done" : "Mark done"}: ${item.text}`}
              onClick={() => onChange(toggleTodoItem(items, item.id))}
            >
              {item.done ? "☑" : "☐"}
            </button>
            <span className="todo-text">{item.text}</span>
            <small className="todo-due">{item.due ?? ""}</small>
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
        ))}
      </ul>

      {items.length === 0 && <p className="frame-foot">No items yet. Type above and press Enter.</p>}
      <p className="frame-foot">{openTodoCount(items)} open</p>
    </>
  );
}
