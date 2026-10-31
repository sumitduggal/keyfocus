# Bookmarks (Raindrop.io-style) — PRD

Status: built. Differences from the plan below:
- Trash is a `trashedAt` flag inside the bookmarks library (purged after 7 days), not the todo-typed `TRASH_KEY`.
- Bookmark reminders do not use the persistent Reminder Notice. A bookmark's `remindAt` shows in a Reminders view, highlights when due, and fires a browser notification if allowed.
- BFF lives in `api/_og.ts` (Vercel wrapper `api/og.ts`, Vite middleware in `vite.config.ts`).

## Goal
A **bookmarks** feature: a new frame kind (Dock + command palette, like todo/habits/reminders) that saves links and organizes them like Raindrop.io. Keyboard-first like the rest of the focus space.

## Decisions
| Area | Decision |
|---|---|
| Scope | Full clone, minus sharing, permanent copy and page-rendered highlights |
| Placement | New `bookmarks` frame |
| Organization | Nested collections + free-form tags |
| Views | List, grid, headlines, masonry |
| Highlights | Manual quote snippets attached to a bookmark |
| Extras | Favorites, trash (reuse `TRASH_KEY`), bookmark reminders (Reminders view and browser notification), duplicate detection, broken-link check, bulk select/move/tag |
| Search | Free text over title/url/note/tags plus Raindrop operators: `#tag`, `type:`, `created:`, favorite filter |
| Storage | localStorage, same pattern as other frames |
| Import | Browser HTML (Netscape), CSV (Raindrop columns), JSON (lossless own format) |
| Export | Same three formats |
| Import duplicates | Ask per import: skip (match on normalized URL) or import all |
| Sharing | Dropped. A "copy collection as Markdown" button is out of scope too |

## BFF
- One handler, `GET /api/og?url=` → `{ title, description, image, favicon, siteName }` from OpenGraph/`<title>`.
- Also `HEAD`-style check mode (`/api/og?url=&check=1`) for broken-link detection.
- Runs as Vite dev middleware locally and as a Vercel-style function (`api/og.ts`) in prod; handler is a plain `(url) => Response` function so it ports to Cloudflare.
- Security: http/https only, block private/loopback/link-local IPs (SSRF), redirect and size/time limits.
- Failure is non-fatal: the bookmark saves with the domain as its title.

## Out of scope (v1)
Sharing, permanent copy, auto-highlights from page content, browser extension, sync across devices.

## Tests
Vitest for: HTML/CSV/JSON import and export round-trips, URL normalization and dedupe, search-operator parsing, SSRF guard.

## Open questions
- Collection nesting depth limit?
- Reminders: one-off datetime only, or reuse the repeat options?
