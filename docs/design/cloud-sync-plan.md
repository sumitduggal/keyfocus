# Cloud sync plan

**Status:** Agreed direction; implementation has not started

**Date:** 2026-10-31

## Goal

Keep Keyfocus usable as a local-first app while giving each person a private account that syncs their durable data and preferences across devices. A local change is saved immediately; Cloudflare and Supabase carry it to the person's other devices.

## Decisions

- **Accounts:** one private account per person, with Clerk managing identity and email/Google sign-in. Allow local guest use before sign-in. Use Clerk's Supabase integration so Supabase accepts Clerk session tokens and applies RLS using the authenticated user identity. Link sign-in methods that belong to the same Clerk account rather than creating duplicate workspaces. [Clerk authentication](https://clerk.com/docs/authentication/overview), [Clerk and Supabase](https://clerk.com/docs/integrations/databases/supabase)
- **Region:** Supabase project in Sydney (`ap-southeast-2`). Supabase lists Sydney as a specific project region. [Available regions](https://supabase.com/docs/guides/platform/regions)
- **What syncs:** all durable content and preferences: frames, notes, todos, habits, reminders and completion history, bookmarks and collections, focus log, trash, theme, workspace view, timer duration, music/radio preferences, weather location, and collapsed-rail preferences. The running Pomodoro timer, current playback state, and browser notification permissions stay on the device.
- **Local behavior:** save locally first. Sync discrete changes promptly; debounce text edits for two seconds. Persist unsent work in a durable local outbox and retry on reconnect, app open, and foreground. Keep the app usable offline.
- **Incoming changes:** Supabase Realtime notifies other signed-in devices over a direct WebSocket. Notifications identify changed records; devices fetch record contents through Cloudflare. Use private per-user channels and access rules. Supabase recommends Broadcast for scalable, authorized database change notifications. [Realtime database changes](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes), [Realtime authorization](https://supabase.com/docs/guides/realtime/authorization)
- **Conflicts:** merge different records by ID. If two devices edit the same record, the device edit timestamp wins, including edits made offline. Legacy local records receive a migration timestamp, so they win same-ID conflicts during the first merge. Device clock errors can produce a wrong winner; handle extreme clock skew explicitly during implementation.
- **Deletes:** sync deletions to all devices. Keep deleted records in Recently Deleted for seven days, then permanently purge them from the cloud.
- **First sign-in:** if cloud data is empty, upload local data. If local and cloud data both exist, ask whether to use local, use cloud, or merge. Keep a recoverable local copy until the chosen migration completes.
- **Sign-out:** wait for pending uploads to finish, then clear that account's local cache. Prevent sign-out while changes remain queued; a signed-out person can continue in guest mode.
- **Account deletion:** offer a JSON export, then permanently delete the account and its cloud records. The privileged deletion credential stays server-side.

## Hosting and access

The app is a static Vite SPA. The simplest fit appears to be Cloudflare Pages with Pages Functions for `/api/og` and the authenticated sync API. Pages Functions use a root `functions/` directory to define routes. [Cloudflare Pages Functions](https://developers.cloudflare.com/pages/functions/get-started/)

Routine data reads and writes go through Cloudflare Functions. Each request carries a Clerk session token configured for the Supabase integration; the function validates the token and forwards the user identity to Supabase so row-level security (RLS) checks ownership. Map the Clerk user ID consistently to the database ownership field and RLS policy. Do not put a Supabase service-role key in browser code. Use RLS on every exposed data table and test that one account cannot read or write another account's rows. [Clerk and Supabase](https://clerk.com/docs/integrations/databases/supabase), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)

The current bookmark preview handler at `api/_og.ts` uses Node APIs (`node:http`, `node:net`, and `node:dns/promises`). Port it to the Cloudflare runtime while preserving its private-address and redirect protections; do not assume it can be deployed unchanged.

## Data model candidate

The current app stores durable data in separate local-storage keys. A record-oriented cloud model supports the agreed per-record merge rule:

| Field | Purpose |
| --- | --- |
| `user_id` | Supabase account that owns the record; RLS boundary |
| `record_type` | Frame, note, todo, habit, reminder, bookmark, preference, and other durable types |
| `record_id` | Existing client-generated record ID |
| `parent_id` | Frame, collection, or other containing record when needed |
| `payload` | Versioned record contents |
| `client_updated_at` | Device edit time used for same-record last-write-wins |
| `deleted_at` | Synced tombstone; retained for seven days |
| `schema_version` | Payload migration version |

Use `(user_id, record_type, record_id)` as the unique identity. The exact table layout can be settled against the migration and RLS tests before implementation.

## Rollout

1. **Storage and schema:** inventory every durable local-storage key; add a local repository boundary and durable outbox; create versioned migrations and per-user RLS policies. Preserve the existing storage as the guest cache until migration is verified.
2. **Cloudflare and auth:** deploy the SPA and port `/api/og`; configure Clerk email/Google sign-in, application and redirect URLs, and its Supabase integration. Add a Cloudflare sync Function that validates and forwards Clerk session tokens. Add an account-deletion function for the privileged operation, including Clerk account deletion and Supabase record cleanup.
3. **Sync engine:** upload queued records, fetch server changes, merge by record ID and timestamps, apply tombstones, retry safely, and send Realtime invalidations. Make retries idempotent so a response lost after a successful write does not duplicate or corrupt data.
4. **Guest migration and controls:** add sign-in, the local/cloud/merge chooser, sync state, offline queue feedback, safe sign-out, JSON export, and account deletion.
5. **Release checks:** test guest migration, account isolation, Clerk email and Google login, token validation and RLS claims, offline edits, two-device edits to different and identical records, deletes/restore/expiry, sign-out with pending work, and account export/deletion across Clerk and Supabase. Deploy to a preview domain before production.

## Acceptance checks

- Guests can create and edit data offline as they do today.
- Signing in does not silently replace either an existing local workspace or cloud workspace.
- A record created or edited on one device reaches another device; unrelated record edits survive concurrent sync.
- RLS rejects unauthenticated access and cross-account reads and writes using Clerk user identity claims.
- A pending outbox survives reload and retries after reconnect.
- Sign-out never exposes one account's local data to the next account on the same browser.
- A JSON export can be downloaded before account deletion, and deleted cloud data is removed after the seven-day trash window.

## Known tradeoff

Device edit timestamps preserve the intended ordering while offline but depend on device clocks. A device set far into the future can win a same-record conflict. Detect implausible clock skew and surface the conflict instead of silently discarding the other version.
