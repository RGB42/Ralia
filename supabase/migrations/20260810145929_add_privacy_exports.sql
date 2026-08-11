-- Privacy exports require explicit partner approval. Account deletion is
-- intentionally limited to accounts without current or historical pair data.

create table public.data_export_requests (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  partner_user_id uuid not null references auth.users(id) on delete cascade,
  calendar_id text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  expires_at timestamptz not null default (now() + interval '48 hours'),
  created_at timestamptz not null default now(),
  resolved_at timestamptz null,
  check (requester_user_id <> partner_user_id)
);

create index data_export_requests_participant_idx
  on public.data_export_requests (requester_user_id, partner_user_id, created_at desc);
create unique index data_export_requests_one_pending_request_idx
  on public.data_export_requests (requester_user_id, partner_user_id, calendar_id)
  where status = 'pending';

alter table public.data_export_requests enable row level security;

create policy data_export_requests_select_participant
on public.data_export_requests for select
to authenticated
using (
  requester_user_id = (select auth.uid())
  or partner_user_id = (select auth.uid())
);

grant select on public.data_export_requests to authenticated;

create or replace function private.is_user_pair_calendar(
  p_calendar_id text,
  p_user_id uuid
)
returns boolean
language sql
immutable
security definer
set search_path = ''
as $$
  select p_calendar_id is not null
    and (
      p_calendar_id like p_user_id::text || E'\\_%' escape E'\\'
      or p_calendar_id like E'%\\_' || p_user_id::text escape E'\\'
    );
$$;

create or replace function private.has_shared_calendar_data(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  return exists (
    select 1 from public.events where private.is_user_pair_calendar(calendar_id, p_user_id)
    union all
    select 1 from public.event_reminder_jobs where private.is_user_pair_calendar(calendar_id, p_user_id)
    union all
    select 1 from public.notes_todo_groups where private.is_user_pair_calendar(calendar_id, p_user_id)
    union all
    select 1 from public.notes_todos where private.is_user_pair_calendar(calendar_id, p_user_id)
    union all
    select 1 from public.recurring_tasks where private.is_user_pair_calendar(calendar_id, p_user_id)
    union all
    select 1 from public.recurring_task_logs where private.is_user_pair_calendar(calendar_id, p_user_id)
    union all
    select 1 from public.recurring_event_exceptions where private.is_user_pair_calendar(calendar_id, p_user_id)
    union all
    select 1 from public.shared_expenses where private.is_user_pair_calendar(calendar_id, p_user_id)
    union all
    select 1 from public.week_plans where private.is_user_pair_calendar(calendar_id, p_user_id)
    union all
    select 1 from public.expense_categories where private.is_user_pair_calendar(calendar_id, p_user_id)
    union all
    select 1 from public.expense_budgets where private.is_user_pair_calendar(calendar_id, p_user_id)
    union all
    select 1 from public.expense_settlements where private.is_user_pair_calendar(calendar_id, p_user_id)
  );
end;
$$;

create or replace function public.account_deletion_status(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
begin
  select * into v_profile
  from public.profiles
  where id = p_user_id;

  if not found then return 'not_found'; end if;
  if v_profile.ls_subscription_id is not null
    and v_profile.plan_status in ('active', 'on_trial') then
    return 'active_subscription';
  end if;
  if v_profile.partner_id is not null
    or exists (select 1 from public.profiles where partner_id = p_user_id)
    or private.has_shared_calendar_data(p_user_id) then
    return 'shared_data';
  end if;
  return 'ready';
end;
$$;

create or replace function private.delete_solo_profile_data()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.account_deletion_status(old.id) <> 'ready' then
    raise exception 'account_deletion_not_allowed'
      using errcode = '42501', detail = public.account_deletion_status(old.id);
  end if;

  delete from public.sent_event_reminders where recipient_user_id = old.id;
  delete from public.event_reminder_jobs where calendar_id = old.id::text or recipient_user_id = old.id;
  delete from public.recurring_event_exceptions where calendar_id = old.id::text;
  delete from public.events where calendar_id = old.id::text;
  delete from public.recurring_task_logs where calendar_id = old.id::text;
  delete from public.recurring_tasks where calendar_id = old.id::text;
  delete from public.notes_todos where calendar_id = old.id::text;
  delete from public.notes_todo_groups where calendar_id = old.id::text;
  delete from public.week_plans where calendar_id = old.id::text;
  delete from public.expense_settlements where calendar_id = old.id::text;
  delete from public.expense_splits
  where expense_id in (select id from public.shared_expenses where calendar_id = old.id::text);
  delete from public.shared_expenses where calendar_id = old.id::text;
  delete from public.expense_categories where calendar_id = old.id::text;
  delete from public.expense_budgets where calendar_id = old.id::text;
  return old;
end;
$$;

drop trigger if exists profiles_delete_solo_data on public.profiles;
create trigger profiles_delete_solo_data
before delete on public.profiles
for each row execute function private.delete_solo_profile_data();

revoke all on function private.is_user_pair_calendar(text, uuid) from public, anon, authenticated;
revoke all on function private.has_shared_calendar_data(uuid) from public, anon, authenticated;
revoke all on function private.delete_solo_profile_data() from public, anon, authenticated;
revoke all on function public.account_deletion_status(uuid) from public, anon, authenticated;
grant execute on function public.account_deletion_status(uuid) to service_role;
