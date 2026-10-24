// The "!priority" and "@date" suggestions shared by the todo and reminder inputs.

export interface Suggestion {
  value: string;
  label: string;
  hint: string;
}

export const PRIORITY_SUGGESTIONS: Suggestion[] = [
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
export function dateSuggestions(today: Date): Suggestion[] {
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
export const currentToken = (draft: string) => draft.split(/\s+/).pop() ?? "";
