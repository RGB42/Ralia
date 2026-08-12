# Ralia AI Agent Handoff

Last updated: 2026-08-11

## Purpose

This file is the current implementation and product handoff for the next AI agent.
It deliberately does not contain passwords, access tokens, OAuth client values, or service-role secrets.

## Current Git State

- Branch: `main`
- Current checkpoint: `ff7a18b feat(data): preserve pair calendar history`
- Recent checkpoints:
  - `a85ae72 feat(app): add privacy exports`
  - `29a80a4 feat(app): persist core workflows`
  - `08e61f0 feat(app): Fachbereiche an Supabase anbinden`
- Verification at the latest checkpoint: `npm run verify` passed with 69 test files and 858 tests.
- `npm audit --omit=dev` reported 0 vulnerabilities.

## Product Decisions

- Ralia is free for the initial release. No new checkout, portal, or feature gate should be added.
- Historical shared calendars must remain stored after a breakup.
- A historical calendar is inaccessible while the pair is disconnected.
- Reconnecting the same two users restores access to the same historical shared calendar.
- Connecting one former member to another person must not expose the former pair's history.
- Privacy exports are available for personal data. Shared exports require partner approval.
- Account deletion is self-service only for accounts without active shared history.
- Google Calendar belongs in the initial release.
- Google v1 uses one dedicated Google calendar named `Ralia` per Ralia user for bidirectional sync.
- Manual import may copy from other Google calendars into Ralia. Manual export targets the dedicated Ralia Google calendar.
- Google sync runs server-side every 10 minutes and has a manual sync action.
- Google recurrence masters and exceptions are in scope for v1.
- If both Ralia and Google change the same mapped event, the user chooses the resolution. Do not use automatic last-write-wins.
- Public legal pages are deferred until real operator and jurisdiction data are supplied. Do not invent an imprint or privacy-policy controller identity.
- The intended support email is `zutoruffy@gmail.com`.

## Architecture

```text
packages/core     Framework-free calendar, recurrence, money, and IndexedDB outbox logic.
packages/data     Supabase repositories, generated schema types, function clients.
packages/ui       Design system and reusable controls.
apps/app          React/Vite SPA with auth, routing, calendar, planner, todos, money, settings.
supabase/         Versioned forward migrations and versioned Edge Function sources.
```

Important constraints:

- `packages/core` must not import React, DOM APIs, or Supabase.
- UI code must not access Supabase directly outside the data/provider boundary.
- Use additive forward migrations. Never rewrite an already-applied migration.
- The main Supabase project reference is `nyvripddydrzvfuateea`.
- `app-api` remains deployed but its source is not versioned in this repository. New server functionality should be source-controlled under `supabase/functions/`.

## Implemented Product Areas

### Auth and Partnering

- Email/password auth, Google sign-in identity auth, recovery, session restoration, and route guards are implemented.
- Partner connection uses invite codes and Supabase RPCs.
- `AuthProvider` activates the account/calendar outbox scope after session restoration.
- Settings supports partner disconnect and shared anniversary updates.

Relevant files:

- `apps/app/src/auth/AuthProvider.tsx`
- `packages/data/src/auth/session.ts`
- `packages/data/src/repositories/partner-repo.ts`
- `packages/data/src/calendar-id.ts`

### Calendar, Organizer, Planner, and Money

- Calendar CRUD, recurrence expansion, occurrence exceptions, future-series split, multi-day month/week/day rendering, Realtime invalidation, and account-scoped offline event outbox are implemented.
- Organizer has persistent lists, todos, notes, reorder/rename RPCs, and shopping-list support.
- Weekly planner has persistent meals, tasks, assignments, completion state, and shopping integration.
- Money has persistent expenses, categories, budgets, custom splits, settlements, and cent-accurate `BigInt` ledger calculations.

Relevant files:

- `apps/app/src/screens/calendar/CalendarScreen.tsx`
- `apps/app/src/screens/planner/PlannerScreen.tsx`
- `apps/app/src/screens/money/MoneyScreen.tsx`
- `packages/core/src/money/ledger.ts`
- `packages/data/src/outbox/event-outbox-executor.ts`

### Preferences and Privacy

- `AppPreferencesProvider` persists locale, week start, solo mode, and notification settings.
- Settings uses real profile/session data rather than profile fixtures.
- Personal JSON export is implemented.
- Shared export requires a time-limited partner approval request, sends a push when possible, and also appears in-app.
- Solo account deletion is implemented through the JWT-protected `privacy-api` Edge Function.
- Account deletion clears owner-wide local outbox data before sign-out. Browser IndexedDB failures cannot strand a server-deleted account in a signed-in session.

Relevant files:

- `apps/app/src/preferences/AppPreferencesProvider.tsx`
- `apps/app/src/screens/settings/SettingsScreen.tsx`
- `packages/data/src/privacy-api.ts`
- `supabase/functions/privacy-api/index.ts`
- `supabase/migrations/20260810145929_add_privacy_exports.sql`

## Pair Calendar Membership Model

### Required Semantics

The shared calendar identifier stays canonical and stable:

```text
min(user_a_uuid, user_b_uuid) + "_" + max(user_a_uuid, user_b_uuid)
```

Do not add a mutable `profiles.calendar_id` column. The stable pair identifier is what makes reconnection restore the same history.

### Applied Implementation

Remote migrations:

- `20260811091438_add_calendar_memberships`
- `20260811091547_add_calendar_membership_read_policies`

Local sources:

- `supabase/migrations/20260811091438_add_calendar_memberships.sql`
- `supabase/migrations/20260811091547_add_calendar_membership_read_policies.sql`

The migration adds:

- `public.shared_calendars`: canonical pair calendar plus the two members.
- `public.calendar_memberships`: durable active/inactive membership state.
- One active shared calendar per user, enforced by a partial unique index.
- A backfill for currently reciprocal profile pairs.
- Exact active-membership RLS instead of UUID containment in `calendar_id`.

The hardened `private.current_calendar_id()` returns:

- the active pair calendar ID, if one exists;
- otherwise the caller's own UUID string for the solo calendar.

The following tables now use exact current-calendar RLS:

- `events`
- `notes_todo_groups`
- `notes_todos`
- `recurring_tasks`
- `recurring_task_logs`
- `recurring_event_exceptions`
- `shared_expenses`
- `week_plans`
- `expense_categories`
- `expense_budgets`
- `expense_settlements`
- `expense_splits` via its parent expense's exact current calendar
- `data_export_requests`

`connect_partner` and `disconnect_partner` were replaced with source-controlled migration definitions:

- Both lock the two profiles in deterministic UUID order.
- `connect_partner` activates or reactivates the pair membership.
- It does not migrate old solo events into the shared calendar. Automatic re-homing could expose personal history to a new partner.
- `disconnect_partner` deactivates both memberships, clears reciprocal `partner_id` values, rejects pending/approved pair-export requests, and cancels unsent pair reminders.
- Direct client changes to `profiles.partner_id` are rejected by `private.keep_partner_link()`.

### Local Outbox Behavior

`Outbox.purgeOwnerCalendar(ownerUserId, calendarId)` discards unsent mutations for a former pair calendar without touching the account's other calendars.

`AuthProvider.disconnectPartner()` captures the previous pair scope, calls the secure partner RPC, purges that former pair queue, then refreshes the session into the solo scope.

Relevant files:

- `packages/core/src/outbox/outbox.ts`
- `packages/core/src/outbox/outbox.test.ts`
- `apps/app/src/auth/AuthProvider.tsx`

## Supabase Status and Known Warnings

Applied product migrations currently include:

- `20260810110137_add_product_foundations`
- `20260810122218_split_recurring_event_future`
- `20260810132746_week_plan_task_state`
- `20260810145929_add_privacy_exports`
- `20260811091438_add_calendar_memberships`
- `20260811091547_add_calendar_membership_read_policies`

The `privacy-api` Edge Function is deployed and has `verify_jwt: true`.

The latest Supabase Security Advisor still reports pre-existing items:

- `crawled_events` and `event_reminder_jobs` have RLS with no client policies. They are service-only tables; keep them inaccessible to `authenticated`/`anon` unless an explicit product requirement appears.
- `pg_net` and `dblink` are installed in the `public` schema. Move or harden them in a dedicated migration after impact review.
- `connect_partner`, `disconnect_partner`, and `set_shared_anniversary` are intentionally callable `SECURITY DEFINER` functions for authenticated users. They require ongoing function-body review and exact grants.
- Supabase leaked-password protection is disabled. Enable it in Supabase Auth settings before public launch.

## Google OAuth and Sync

### Current State

- The current `/profil/sync` screen is fixture-only. Do not treat it as a working integration.
- Supabase Google sign-in is implemented, but it is not Google Calendar authorization.
- `events.google_event_id` exists but is not a sufficient mapping model.
- The deployed legacy `app-api` contains older Google token and feed routes. Do not build new sync on those routes.

### Legacy Credential Finding

`Ralia_Opus` contains a Google OAuth client configuration file with a plaintext client secret.

- Do not copy the secret into this repository, chat, browser storage, or a new function.
- Rotate the secret in Google Cloud Console.
- Remove the plaintext credential artifact from every shared/versioned deployment environment.
- After rotation, the client identity may be reused only through the new server-side OAuth flow.

### Required Google v1 Design

Create a new, versioned `google-sync-api` Edge Function. It must use:

- Authorization Code OAuth with PKCE, state, nonce, and expiring server-side state.
- Server-only encrypted refresh tokens.
- A dedicated Google calendar named `Ralia` per Ralia user as the bidirectional target.
- Manual import from selected Google calendars into the current Ralia calendar.
- Manual export from the current Ralia calendar into the dedicated Google calendar.
- Server-side incremental polling every 10 minutes plus a manual sync action.
- Google ETags, incremental sync tokens, persisted backoff, and idempotent mappings.
- Recurrence master and exception mapping; never flatten or duplicate series silently.
- Explicit conflict records when both sides changed from the same baseline.
- User decisions for conflicts: Keep Ralia or Keep Google.

Recommended private/service-only data model:

- `google_connections`
- `google_calendar_bindings`
- `google_event_mappings`
- `google_sync_changes`
- `google_sync_runs`
- `google_sync_conflicts`

Do not put token tables in a publicly readable schema, export them, broadcast them, or use them in browser state.

Before implementing Google sync, extend `clearAuthData()` to remove the legacy `googleSyncState` storage key. It is not currently cleared by sign-out.

## Billing and Free Release

The current React app has no active feature gate, checkout button, or billing UI, but the externally deployed `app-api` still advertises `billingEnabled: true` and includes billing routes.

There are no paid users or subscriptions according to the product owner.

Required work:

1. Bring the deployed `app-api` source under version control before changing it.
2. Make `/config` return `billingEnabled: false`.
3. Disable checkout, portal, billing webhook, and external payment provider processing server-side.
4. Keep billing columns in `profiles` for now; do not destructively remove production compatibility fields.
5. Remove the `active_subscription` branch from `account_deletion_status` in a new forward migration once billing is retired.
6. Remove the matching Settings/i18n message and add a regression test that prevents new billing gates in the release app.

## Legal and Support

- Public legal pages are deferred. Do not publish invented legal text or an incomplete imprint.
- Required later input: legal operator name, legal service address, legal form, and jurisdiction.
- The desired support email is `zutoruffy@gmail.com`.
- When legal data is available, add guest-accessible routes outside `RequireAuth` and ideally outside the network-dependent boot gate:
  - `/datenschutz`
  - `/impressum`
  - `/agb`
  - `/support`

## Test Accounts and Live QA

The product owner authorized two existing test accounts for mutable production-project QA. Their names and credentials must not be written to this repository, tests, logs, or documentation.

Rules for using them:

- Create only clearly prefixed `QA:` records.
- Do not use self-service deletion for the paired test accounts; paired-history deletion is intentionally blocked.
- Rotate their passwords after the testing cycle because credentials were previously entered into chat.
- Do not inspect or alter data belonging to other users.

Required live test sequence:

1. Sign in to both accounts in isolated browser profiles.
2. Verify solo calendars are independent.
3. Connect the pair and verify the same canonical shared calendar ID after reload.
4. Create, update, and delete calendar, todo, planner, and money data through both accounts.
5. Disconnect and verify both accounts lose server access to historical pair data.
6. Reconnect the same pair and verify historical pair access returns.
7. Verify the former pair outbox does not resend stale changes after disconnect.
8. After Google sync exists, test OAuth, manual import/export, 10-minute sync, recurrence, exception, deletion, rate-limit retry, and both conflict decisions.

## Next Implementation Order

1. Add database/integration tests for connect -> disconnect -> reconnect RLS semantics using only the approved test accounts and QA-prefixed data.
2. Capture and version the existing `app-api`, then retire billing safely.
3. Scrub legacy Google browser state and add the private Google sync schema.
4. Implement `google-sync-api` OAuth/token custody before any Google UI changes.
5. Implement the deterministic sync engine, mappings, recurrence, deletions, and conflicts.
6. Replace fixture-only Sync UI with real connection, import/export, status, errors, and conflict controls.
7. Complete Google live QA with the two approved test accounts.
8. Add public legal/support routes once real legal operator data is supplied.

## Verification Commands

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm run verify
npm audit --omit=dev
```

Run `npm run verify` before every checkpoint. Inspect `git status`, `git diff --check`, and staged contents before committing. Never commit secrets, browser test credentials, OAuth client secrets, service-role keys, or token fixtures.
