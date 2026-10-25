import { describe, expect, it } from "vitest";
import {
  completeReminder,
  createReminder,
  cyclePriority,
  describeRepeat,
  editReminder,
  groupReminders,
  loadReminders,
  nextDue,
  parseReminder,
  saveReminders,
  setReminderIcon,
  snoozeReminder,
  snoozeTime,
  summarise,
  syncTodoReminders,
  tick,
  type RemindersData,
  type Repeat,
} from "./reminders";

// Wednesday 15 October 2025, 10:00.
const now = new Date(2025, 9, 15, 10, 0);

const data = (...reminders: ReturnType<typeof createReminder>[]): RemindersData => ({ reminders, done: [] });
const oneOff = (due: string, id = "r1") => createReminder({ text: "Call mum", priority: "medium", due, repeat: null }, id);
const repeating = (due: string, repeat: Repeat, id = "r1") => createReminder({ text: "Stand up", priority: "medium", due, repeat }, id);

describe("repeat rules", () => {
  it("steps daily and every N days", () => {
    expect(nextDue({ kind: "daily", every: 1 }, "2025-10-31T09:00")).toBe("2025-11-01T09:00");
    expect(nextDue({ kind: "daily", every: 3 }, "2025-10-30T09:00")).toBe("2025-11-02T09:00");
  });

  it("moves to the next chosen weekday, and skips weeks for every N", () => {
    const weekdays: Repeat = { kind: "weekly", every: 1, weekdays: [1, 2, 3, 4, 5] };
    expect(nextDue(weekdays, "2025-10-17T09:00")).toBe("2025-10-20T09:00"); // Friday to Monday
    const fortnight: Repeat = { kind: "weekly", every: 2, weekdays: [1] };
    expect(nextDue(fortnight, "2025-10-13T09:00")).toBe("2025-10-27T09:00");
    const twoDays: Repeat = { kind: "weekly", every: 2, weekdays: [1, 3] };
    expect(nextDue(twoDays, "2025-10-13T09:00")).toBe("2025-10-15T09:00");
    expect(nextDue(twoDays, "2025-10-15T09:00")).toBe("2025-10-27T09:00");
  });

  it("keeps a month day across short months", () => {
    const rule: Repeat = { kind: "monthly", every: 1, monthDay: 31 };
    expect(nextDue(rule, "2025-01-31T09:00")).toBe("2025-02-28T09:00");
    expect(nextDue(rule, "2025-02-28T09:00")).toBe("2025-03-31T09:00");
  });

  it("finds the nth and last weekday of a month", () => {
    const second: Repeat = { kind: "monthly-nth", every: 1, nth: 2, weekday: 2 };
    expect(nextDue(second, "2025-10-14T09:00")).toBe("2025-11-11T09:00");
    const last: Repeat = { kind: "monthly-nth", every: 1, nth: -1, weekday: 5 };
    expect(nextDue(last, "2025-10-31T09:00")).toBe("2025-11-28T09:00");
  });

  it("handles 29 February", () => {
    expect(nextDue({ kind: "yearly", every: 1 }, "2024-02-29T09:00")).toBe("2025-02-28T09:00");
  });
});

describe("firing", () => {
  it("fires a one-off once it is due", () => {
    const result = tick(data(oneOff("2025-10-15T09:30")), now);
    expect(result.fired).toHaveLength(1);
    expect(result.data.reminders[0].firedAt).toBe("2025-10-15T09:30");
    expect(tick(result.data, now).fired).toHaveLength(0);
  });

  it("does not fire early", () => {
    expect(tick(data(oneOff("2025-10-15T10:01")), now).fired).toHaveLength(0);
  });

  it("collapses missed repeats into the latest one and moves on", () => {
    const result = tick(data(repeating("2025-10-10T09:00", { kind: "daily", every: 1 })), now);
    const [reminder] = result.data.reminders;
    expect(reminder.firedAt).toBe("2025-10-15T09:00");
    expect(reminder.due).toBe("2025-10-16T09:00");
    expect(result.fired).toHaveLength(1);
  });

  it("only alerts when the reminder was not already waiting", () => {
    const first = tick(data(repeating("2025-10-14T09:00", { kind: "daily", every: 1 })), now);
    const later = tick(first.data, new Date(2025, 9, 16, 10, 0));
    expect(later.fired).toHaveLength(0);
    expect(later.data.reminders[0].firedAt).toBe("2025-10-16T09:00");
  });
});

describe("answering", () => {
  it("completes a one-off into the done list", () => {
    const fired = tick(data(oneOff("2025-10-15T09:30")), now).data;
    const result = completeReminder(fired, "r1", now);
    expect(result.reminders).toHaveLength(0);
    expect(result.done[0]).toMatchObject({ text: "Call mum", at: "2025-10-15T09:30", doneAt: "2025-10-15T10:00" });
  });

  it("completing a repeat keeps it on its next time", () => {
    const fired = tick(data(repeating("2025-10-15T09:00", { kind: "daily", every: 1 })), now).data;
    const result = completeReminder(fired, "r1", now);
    expect(result.reminders[0]).toMatchObject({ due: "2025-10-16T09:00", firedAt: null });
    expect(result.done).toHaveLength(1);
  });

  it("snoozes a one-off by moving its time, and fires it again later", () => {
    const fired = tick(data(oneOff("2025-10-15T09:30")), now).data;
    const snoozed = snoozeReminder(fired, "r1", snoozeTime("30m", now));
    expect(snoozed.reminders[0]).toMatchObject({ due: "2025-10-15T10:30", firedAt: null });
    const again = tick(snoozed, new Date(2025, 9, 15, 10, 31));
    expect(again.fired).toHaveLength(1);
  });

  it("snoozes a repeat without losing its schedule", () => {
    const fired = tick(data(repeating("2025-10-15T09:00", { kind: "daily", every: 1 })), now).data;
    const snoozed = snoozeReminder(fired, "r1", "2025-10-15T14:00");
    expect(snoozed.reminders[0]).toMatchObject({ due: "2025-10-16T09:00", snoozedUntil: "2025-10-15T14:00" });
    const again = tick(snoozed, new Date(2025, 9, 15, 14, 0));
    expect(again.fired).toHaveLength(1);
    expect(again.data.reminders[0].snoozedUntil).toBeNull();
  });

  it("offers tomorrow at 9:00", () => {
    expect(snoozeTime("tomorrow", now)).toBe("2025-10-16T09:00");
    expect(snoozeTime("4h", now)).toBe("2025-10-15T14:00");
  });
});

describe("editing", () => {
  it("keeps an overdue reminder overdue when only the text changes", () => {
    const fired = tick(data(oneOff("2025-10-15T09:00")), now).data;
    const edited = editReminder(fired, "r1", { text: "Call mum back", due: "2025-10-15T09:00", repeat: null });
    expect(edited.reminders[0]).toMatchObject({ text: "Call mum back", firedAt: "2025-10-15T09:00" });
    expect(tick(edited, now).fired).toHaveLength(0);
  });

  it("starts over when the time or repeat changes", () => {
    const fired = tick(data(oneOff("2025-10-15T09:00")), now).data;
    const moved = editReminder(fired, "r1", { text: "Call mum", due: "2025-10-16T09:00", repeat: null });
    expect(moved.reminders[0].firedAt).toBeNull();
    const repeated = editReminder(fired, "r1", { text: "Call mum", due: "2025-10-15T09:00", repeat: { kind: "daily", every: 1 } });
    expect(repeated.reminders[0].firedAt).toBeNull();
  });
});

describe("loading repeats", () => {
  const load = (repeat: unknown) =>
    loadReminders({ getItem: () => JSON.stringify({ f1: { reminders: [{ ...oneOff("2025-10-15T09:00"), repeat }], done: [] } }) }).f1.reminders;

  it("keeps a valid repeat and drops ones missing their fields", () => {
    expect(load({ kind: "weekly", every: 1, weekdays: [1, 3] })).toHaveLength(1);
    expect(load({ kind: "weekly", every: 1 })).toHaveLength(0);
    expect(load({ kind: "weekly", every: 1, weekdays: [] })).toHaveLength(0);
    expect(load({ kind: "monthly", every: 1, monthDay: 0 })).toHaveLength(0);
    expect(load({ kind: "monthly-nth", every: 1, nth: 9, weekday: 2 })).toHaveLength(0);
    expect(load({ kind: "monthly-nth", every: 1, nth: -1, weekday: 5 })).toHaveLength(1);
  });
});

describe("grouping", () => {
  it("groups overdue first, then by day", () => {
    const fired = tick(data(oneOff("2025-10-15T09:00", "a")), now).data;
    const all: RemindersData = {
      ...fired,
      reminders: [
        ...fired.reminders,
        oneOff("2025-10-15T18:00", "b"),
        oneOff("2025-10-16T09:00", "c"),
        oneOff("2025-10-18T09:00", "d"),
        oneOff("2025-12-01T09:00", "e"),
      ],
    };
    expect(groupReminders(all, now).map((group) => [group.key, group.items.map((item) => item.id)])).toEqual([
      ["overdue", ["a"]],
      ["today", ["b"]],
      ["tomorrow", ["c"]],
      ["week", ["d"]],
      ["later", ["e"]],
    ]);
  });

  it("summarises the next reminder and the overdue count", () => {
    const fired = tick(data(oneOff("2025-10-15T09:00", "a")), now).data;
    const all: RemindersData = { ...fired, reminders: [...fired.reminders, oneOff("2025-10-16T09:00", "c")] };
    const summary = summarise([all]);
    expect(summary.overdue).toBe(1);
    expect(summary.next?.id).toBe("c");
  });
});

describe("typing a sentence", () => {
  it("reads a day and a time", () => {
    expect(parseReminder("call mum tomorrow 9am", now)).toEqual({ text: "call mum", priority: "medium", due: "2025-10-16T09:00", repeat: null });
    expect(parseReminder("Send the proposal friday at 14:30", now)).toMatchObject({ text: "Send the proposal", due: "2025-10-17T14:30" });
  });

  it("uses today when the time is still ahead, otherwise tomorrow", () => {
    expect(parseReminder("stretch 3pm", now).due).toBe("2025-10-15T15:00");
    expect(parseReminder("stretch 8am", now).due).toBe("2025-10-16T08:00");
  });

  it("reads relative times and calendar dates", () => {
    expect(parseReminder("check the oven in 20 minutes", now)).toMatchObject({ text: "check the oven", due: "2025-10-15T10:20" });
    expect(parseReminder("renew membership 5 nov", now)).toMatchObject({ due: "2025-11-05T09:00" });
    expect(parseReminder("pay rent on 2025-12-01 8am", now).due).toBe("2025-12-01T08:00");
  });

  it("does not mistake other words for weekdays", () => {
    expect(parseReminder("call my friend tomorrow", now).text).toBe("call my friend");
  });

  it("reads repeat rules", () => {
    expect(parseReminder("stand up every weekday 9:30", now).repeat).toEqual({ kind: "weekly", every: 1, weekdays: [1, 2, 3, 4, 5] });
    expect(parseReminder("water plants every 2 weeks", now).repeat).toMatchObject({ kind: "weekly", every: 2, weekdays: [4] });
    expect(parseReminder("team sync every monday and wednesday 10am", now).repeat).toMatchObject({ weekdays: [1, 3] });
    expect(parseReminder("pay rent monthly on the 1st", now)).toMatchObject({
      repeat: { kind: "monthly", monthDay: 1 },
      due: "2025-11-01T09:00",
    });
    expect(parseReminder("review every 2nd tuesday", now).repeat).toEqual({ kind: "monthly-nth", every: 1, nth: 2, weekday: 2 });
    expect(parseReminder("take vitamins daily 8am", now)).toMatchObject({ repeat: { kind: "daily", every: 1 }, due: "2025-10-16T08:00" });
  });

  it("reads a priority and @ dates like the todo list", () => {
    expect(parseReminder("pay invoice !high @friday 2pm", now)).toMatchObject({
      text: "pay invoice",
      priority: "high",
      due: "2025-10-17T14:00",
    });
    expect(parseReminder("book flights @12 nov !low", now)).toMatchObject({ priority: "low", due: "2025-11-12T09:00" });
    expect(parseReminder("water plants @tomorrow", now).due).toBe("2025-10-16T09:00");
  });

  it("cycles priority", () => {
    const cycled = cyclePriority(data(oneOff("2025-10-15T09:00")), "r1");
    expect(cycled.reminders[0].priority).toBe("low");
  });

  it("loads reminders saved without a priority as medium", () => {
    const old = { id: "x", text: "Old", due: "2025-10-15T09:00", repeat: null, snoozedUntil: null, firedAt: null };
    const loaded = loadReminders({ getItem: () => JSON.stringify({ f1: { reminders: [old], done: [] } }) });
    expect(loaded.f1.reminders[0].priority).toBe("medium");
  });

  it("sets an icon that survives saving", () => {
    const withIcon = setReminderIcon(data(oneOff("2025-10-15T09:00")), "r1", "★");
    let saved = "";
    saveReminders({ setItem: (_key, value) => (saved = value) }, { f1: withIcon });
    expect(loadReminders({ getItem: () => saved }).f1.reminders[0].icon).toBe("★");
  });

  it("falls back to a plain reminder", () => {
    expect(parseReminder("remind me to buy milk", now).text).toBe("buy milk");
    expect(parseReminder("", now).text).toBe("Reminder");
  });

  it("describes a repeat", () => {
    expect(describeRepeat(null)).toBe("");
    expect(describeRepeat({ kind: "weekly", every: 1, weekdays: [1, 2, 3, 4, 5] })).toBe("every weekday");
    expect(describeRepeat({ kind: "monthly-nth", every: 1, nth: 2, weekday: 2 })).toBe("every 2nd Tue");
  });
});

describe("saving", () => {
  it("round trips and drops malformed entries", () => {
    let saved = "";
    saveReminders({ setItem: (_key, value) => (saved = value) }, { f1: data(oneOff("2025-10-15T09:00")) });
    expect(loadReminders({ getItem: () => saved }).f1.reminders).toHaveLength(1);
    const broken = JSON.stringify({ f1: { reminders: [oneOff("2025-10-15T09:00"), { id: 1 }], done: "x" } });
    const loaded = loadReminders({ getItem: () => broken });
    expect(loaded.f1.reminders).toHaveLength(1);
    expect(loaded.f1.done).toEqual([]);
    expect(loadReminders({ getItem: () => "nope" })).toEqual({});
  });
});

describe("reminders that belong to todo items", () => {
  const empty: RemindersData = { reminders: [], done: [] };
  const want = (todoId: string, at: string, text = "Send the proposal") => ({ todoId, text, priority: "medium" as const, at });

  it("adds one reminder per item that wants one, and nothing when nothing changed", () => {
    const first = syncTodoReminders(empty, [want("a", "2025-10-16T09:00")]);
    expect(first.reminders).toHaveLength(1);
    expect(first.reminders[0]).toMatchObject({ id: "todo:a", text: "Send the proposal", due: "2025-10-16T09:00", todo: { id: "a", at: "2025-10-16T09:00" } });
    expect(syncTodoReminders(first, [want("a", "2025-10-16T09:00")])).toBe(first);
  });

  it("removes the reminder when its item no longer wants one, and leaves other reminders alone", () => {
    const mine = oneOff("2025-10-16T09:00", "mine");
    const synced = syncTodoReminders(data(mine), [want("a", "2025-10-16T09:00")]);
    expect(synced.reminders.map((reminder) => reminder.id)).toEqual(["mine", "todo:a"]);
    expect(syncTodoReminders(synced, []).reminders.map((reminder) => reminder.id)).toEqual(["mine"]);
  });

  it("renames in place, but a new time starts it over", () => {
    const synced = syncTodoReminders(empty, [want("a", "2025-10-16T09:00")]);
    const snoozed = snoozeReminder(synced, "todo:a", "2025-10-16T09:30");
    const renamed = syncTodoReminders(snoozed, [want("a", "2025-10-16T09:00", "Send the new proposal")]);
    expect(renamed.reminders[0]).toMatchObject({ text: "Send the new proposal", due: "2025-10-16T09:30" });
    const moved = syncTodoReminders(snoozed, [want("a", "2025-10-17T08:00")]);
    expect(moved.reminders[0]).toMatchObject({ due: "2025-10-17T08:00", firedAt: null, todo: { at: "2025-10-17T08:00" } });
  });

  it("does not make a reminder again once it was answered for that time, even after a snooze", () => {
    const synced = syncTodoReminders(empty, [want("a", "2025-10-16T09:00")]);
    const snoozed = snoozeReminder(synced, "todo:a", "2025-10-16T09:30");
    const answered = completeReminder(snoozed, "todo:a", new Date(2025, 9, 16, 9, 31));
    expect(answered.reminders).toEqual([]);
    expect(syncTodoReminders(answered, [want("a", "2025-10-16T09:00")])).toBe(answered);
    expect(syncTodoReminders(answered, [want("a", "2025-10-17T09:00")]).reminders).toHaveLength(1);
  });

  it("survives a save and load with its link", () => {
    const synced = syncTodoReminders(empty, [want("a", "2025-10-16T09:00")]);
    const storage = new Map<string, string>();
    saveReminders({ setItem: (key, value) => void storage.set(key, value) }, { f: synced });
    expect(loadReminders({ getItem: (key) => storage.get(key) ?? null }).f.reminders[0].todo).toEqual({ id: "a", at: "2025-10-16T09:00" });
  });
});
