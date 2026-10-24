Status: implemented (round 2)

## Problem Statement

A Todo list is currently a flat list. People cannot clean up finished work in one step, cannot see how far along a list is, cannot tell which items are late, cannot reorder or sort items, cannot fix a typo without deleting the item, cannot break a task into steps, and cannot recover from an accidental delete other than by retyping.

## Solution

Add to each Todo list: clear completed, a progress bar, in-place item editing, overdue highlighting, sort and filter, keyboard reordering, undo for deletes, and one level of subtasks. Everything is keyboard-first and autosaves, matching list-name editing.

## User Stories

1. As a person, I want to clear all completed items in one action, so that I can tidy a list without deleting items one by one.
2. As a person, I want to undo a clear, delete of an item, or delete of a list within a few seconds, so that an accident is recoverable without relying on a confirm box.
3. As a person, I want to see "N of M done" and a bar above the list, so that I know how far along the list is at a glance.
4. As a person, I want to edit an item's text in place, so that I can fix a typo without deleting the item.
5. As a person, I want items due before today and not done to be marked overdue, so that late work stands out.
6. As a person, I want to sort items by priority or by due date, so that I can see what matters first.
7. As a person, I want to filter to open items or overdue items, so that I can focus on what is left.
8. As a person, I want to move an item up or down with Alt+Up and Alt+Down, so that I can set my own order without the mouse.
9. As a person, I want to nest an item under the item above it, so that I can break a task into steps.
10. As a person, I want to un-nest a step, so that I can correct the structure.
11. As a person, I want nested steps to be shown indented under their parent, so that the structure is visible.
12. As a person, I want the progress count and overdue marker to count nested steps too, so that the list reflects all the work.
13. As a person, I want my sort, filter and order to keep working after a reload, so that the list looks the way I left it. (Sort and filter choices are not saved; only item order and nesting are.)
14. As a person, I want old saved lists to keep loading without change, so that nothing I already have breaks.

## Implementation Decisions

- Overdue means: the item is not done and its due date is before today (local date). Due today is not overdue.
- Undo window is 5 seconds. A single toast shows the most recent undoable action with an Undo button. Undo restores the exact previous state of the list (or the deleted list at its previous position). A new undoable action replaces the pending one.
- Undoable actions: delete item, clear completed, delete list. Edit, toggle, priority change, reorder, nest and sort/filter are not undoable.
- Clear completed removes every done item, including nested items under a done parent. It is undoable.
- Progress is counted over all items including nested steps: done count and total.
- Subtasks are one level deep. An item can be nested under the item directly above it at the top level. A nested item cannot itself have children. Nesting an item that already has children is refused. Nesting is toggled with "[" to nest and "]" to un-nest on the focused row, plus a visible control.
- A parent and its children are independent for done state. Done state of a parent does not change its children.
- Sort and filter apply to top-level groups (a parent with its children). A group is shown if the parent or any child matches the filter. Children stay under their parent in manual order.
- Sort by priority: high, then medium, then low; ties keep manual order. Sort by due date: earliest first, items with no due date last; ties keep manual order.
- Sort and filter are view state only and reset to "manual" and "all" on reload.
- Reordering with Alt+Up and Alt+Down swaps an item with its previous or next sibling (same parent). It only works in manual sort. Children move with the order of their siblings, not across parents.
- Editing text: clicking or tabbing into an item's text edits it. Saves on each change. An empty text on leaving the field is reverted to the text it had when focused.
- Stored data: each item gains an optional parent reference. Saved lists without it load as top-level items.
- Seams: the pure todo logic module is the test seam. Public functions are tested directly. UI behaviour is verified in the browser.
- Testing decisions: test only external behaviour of the public functions. Tests use fixed dates. Prior art: the existing todo test file and the migration test file.

## Out of Scope

- Subtasks deeper than one level.
- Drag and drop reordering.
- Undo after a page reload.
- Saving sort or filter choices.
- Due date editing from the item row (the existing @ tokens in the add field stay the only way to set dates).
- Reminders or notifications for overdue items.

## Further Notes

- Keyboard map on a focused row: Alt+Up and Alt+Down reorder; "[" nests under the item above; "]" un-nests; Space and Enter toggle done; Delete and Backspace remove the item when focus is on the row, not in the text field.
- Undo toast appears at the bottom of the screen and dismisses after 5 seconds.

## Round 2 decisions (agreed)

- Subtasks nest without a depth limit. An item can be nested under the item directly above it on screen, together with its own steps. Nesting is refused only when it would put an item under its own step (a cycle).
- "]" moves an item up one level (to its parent's level). Alt+Up/Down still reorder siblings.
- Drag and drop: each row has a drag handle. Dropping an item above or below another row moves it to that row's position and parent. An item cannot be dropped inside its own steps.
- Undo after reload: deleted items and lists go to a Recently deleted area, kept for 7 days, then removed automatically on load. Restoring from it puts the item back as it was. The five-second Undo toast still works as before.
- Sort and filter are remembered per list across reloads.
- Recently deleted is reached from the ⌘K command list when it has entries. Each entry can be restored with Enter.

## Backlog (round 3, not yet specified)

- Due date editing on the row: done. A native date field on each row; clearing it removes the date.
- Overdue reminders (option 1, in-app): done. A dock badge and a dismissible banner show overdue items.
