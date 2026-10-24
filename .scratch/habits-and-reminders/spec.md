Status: ready-for-agent

## Problem Statement

The app has Todo and Notes but nothing for things that repeat or need to happen at a set time. A person who wants to build a weekly habit, or be told at 9:00 to call someone, has to use another app.

## Solution

Two new frames. Habits tracks things the person wants to do a number of times a week and encourages them without ever punishing a miss. Reminders alerts the person at a date and time, with full repeat rules, and keeps a list of what is overdue and what is done. One scheduler for the whole app fires alerts whichever frame is open.

## User Stories

### Habits

1. As a person, I want one Habits frame to hold a list of habits, so that I can track several at once. I can also have more than one Habits frame.
2. As a person, I want each habit to have a name and a weekly target such as 4, with no fixed days, so that I can do it on any days.
3. As a person, I want to tick a habit for today and for the last few days only, so that I can fix a forgotten tick without rewriting history.
4. As a person, I want to see this week's progress (for example 3 of 4), so that I know where I stand.
5. As a person, I want to see my best week and personal bests, so that I feel encouraged.
6. As a person, I want to see next week's target, so that I know what to aim for.
7. As a person, I want a calendar heat map of the days I did the habit, with missed days left blank and never red, so that I see my pattern without guilt.
8. As a person, I want a missed week to change nothing, so that I am never punished.
9. As a person, I want an optional daily nudge time on a habit, so that I get a Reminder-style alert that is skipped once the habit is done that day.
10. As a person, I want to archive a habit and delete individual archived entries, so that old habits leave the list.

### Reminders

11. As a person, I want to create a reminder by typing a sentence such as "call mum tomorrow 9am", so that adding one is fast.
12. As a person, I want to edit a reminder's text, date, time and repeat with fields, so that I can fix what the sentence got wrong.
13. As a person, I want full repeat rules (daily, weekly on chosen days, monthly by date or weekday, every N, custom such as every 2nd Tuesday), so that any routine can be expressed.
14. As a person, I want a banner, a sound and a browser notification when a reminder is due, so that I notice it.
15. As a person, I want alerts to fire from any frame, so that I do not miss one because I switched.
16. As a person, I want to snooze a firing reminder with fixed choices, so that it comes back later.
17. As a person, I want reminders that came due while the app was closed to show as overdue when I next open it, with snooze and done, and no replayed alert.
18. As a person, I want completed reminders kept in a Done list where I can delete individual entries, so that I have a history I control.
19. As a person, I want the browser permission requested the first time I save a reminder, so that it is asked in context.

### Around the frames

20. As a person, I want the top-right HUD line to show the next reminder (for example "Next: Call mum 9:00") with the overdue count in the accent colour, so that I see it without opening anything.
21. As a person, I want Habits and Reminders in the dock and command palette like the other features.

## Implementation Decisions

- Habits and Reminders are two separate features, added the way Todo and Notes are (feature list, dock entry, palette entry, frame component, storage under their own keys).
- Data stays in localStorage only. The shape is plain JSON with ids, so a backend could be added later.
- Habit: id, name, weekly target, optional nudge time, archived flag, and the list of days done as dates. A week is a calendar week starting on the system locale's first day. Each week remembers the target it was judged against, so changing a target applies from now and past weeks keep theirs.
- Backfill window is today and the last two days.
- Reminder: id, text, next due time, repeat rule, state (active, done), and snooze-until. A repeating reminder advances to its next occurrence on its own when it fires. Missed occurrences collapse: only the latest missed one shows as overdue. Completing an occurrence logs it in Done.
- Repeat rules: build whichever is smaller after checking what the todo code already has. Either a small in-house engine or an iCalendar rule library; decide when implementing.
- Quick add reuses the todo input parser where it fits; fields edit afterwards.
- One scheduler lives outside the frames, like the music player. It owns the timers, the banner, the sound and the notification, and recomputes on load so missed items become overdue instead of replaying.
- Browser notification permission is requested once, the first time a reminder is saved. A refusal leaves banner and sound working.
- Repeating reminders fire at the same wall-clock time in whatever time zone the device is in.
- Snooze choices are 15 minutes, 30 minutes, 4 hours and tomorrow (9:00 next morning), plus a custom day and time.
- The banner stays until dismissed or snoozed, while the tab is visible. The browser notification covers the hidden-tab case. Several reminders firing together show as one stacked banner with a snooze and done for each, and one sound.
- The Reminders frame is grouped by day: Overdue first (accent colour), then Today, Tomorrow, This week, Later, with Done collapsed.
- The habit heat map switches between the last 12 weeks and a year. Missed days stay blank.
- A missed habit nudge goes into the Overdue list like a reminder, until ticked or dismissed.
- Alert sound reuses the audio the app already plays.
- Done reminders and archived habits stay in a Done or Archived section with per-entry delete. Deleting an active item goes to Recently deleted with undo, as todos do.
- HUD: the weather line keeps its place; the next-reminder line is added beside or under it and does not replace it.
- Pure logic (week counting, best week, heat map data, next occurrence, overdue detection, sentence parsing) lives in its own modules with unit tests. The frames and the scheduler are checked in the browser.

## Testing Decisions

- Unit tests cover: weekly progress and best week, next week's target, the backfill window, next occurrence for each repeat kind including month ends and daylight saving changes, overdue detection after a gap, and snooze.
- Behaviour is tested through the module interfaces, not through React internals.
- Browser check: create, fire, snooze, miss while closed, then reopen.

## Out of Scope

- Sync across devices, accounts, sharing.
- Streak penalties of any kind.
- Fixed days of the week on a habit.
- Sending reminders by email or phone push when the app is closed.

## Open Questions

- Which sound the alert plays (the app has no chime yet).
- Whether a custom snooze reuses the reminder's date and time picker.
