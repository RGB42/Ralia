# Ralia
A small synchronized group calendar focused on couples.

## Architecture choice
- **Frontend:** React Native (Expo) so the same code runs on iOS, Android and web. The web folder contains a Vite preview that mirrors the couple calendar flows.
- **Backend:** Supabase is sufficient for the first release (Postgres + Auth + Row Level Security + Edge Functions). A dedicated backend is only needed later for heavy integrations (push aggregation, paid plans, AI scheduling). The lightweight Express server in `/backend` can host webhooks or cron jobs if required.

## Supabase data model (core tables)
- `profiles` (`id uuid` PK references `auth.users`, `display_name text`, `invite_code text unique`, `partner_profile_id uuid`, `created_at timestamptz`).
- `couples` (`id uuid` PK, `user_a uuid` FK profiles, `user_b uuid` FK profiles, `linked_at timestamptz`).
- `categories` (`id uuid` PK, `couple_id uuid` FK couples, `label text`, `color text`, `created_by uuid`).
- `events` (`id uuid` PK, `couple_id uuid` FK couples, `title text`, `description text`, `category_id uuid` FK categories, `location text`, `starts_at timestamptz`, `ends_at timestamptz`, `created_by uuid`, `updated_at timestamptz default now()`).
- `event_participants` (`event_id uuid` FK events, `profile_id uuid` FK profiles, `status text default 'accepted'`, PK (`event_id`, `profile_id`)).

Row Level Security should ensure each profile only sees rows for their couple.

## Supabase helper functions (Edge Functions or SQL RPC)
- `generate_invite_code(user_id uuid)` → returns unique code and upserts it into `profiles.invite_code`.
- `accept_invite(user_id uuid, invite_code text)` → links two profiles, creates/updates the `couples` row, and writes `partner_profile_id`.
- `create_event(payload json)` → inserts into `events` and `event_participants` within one transaction.
- `upsert_category(couple_id uuid, label text, color text)` → reusable categories per couple.
- `set_participation(event_id uuid, profile_id uuid, status text)` → update RSVP for one user.

These functions keep the frontend simple: register/login with Supabase Auth, enter/accept invite code, then read/write events scoped by `couple_id`.
