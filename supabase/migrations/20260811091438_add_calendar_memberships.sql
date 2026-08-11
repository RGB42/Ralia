-- Keep pair-calendar history durable while making access depend on an active,
-- reciprocal membership instead of a UUID substring in calendar_id.

create table public.shared_calendars (
  calendar_id text primary key,
  member_one_id uuid not null references public.profiles(id),
  member_two_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check (member_one_id::text < member_two_id::text),
  unique (member_one_id, member_two_id)
);

create table public.calendar_memberships (
  calendar_id text not null references public.shared_calendars(calendar_id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  is_active boolean not null default true,
  connected_at timestamptz not null default now(),
  disconnected_at timestamptz null,
  primary key (calendar_id, user_id)
);

create unique index calendar_memberships_one_active_calendar_per_user
  on public.calendar_memberships (user_id)
  where is_active;

alter table public.shared_calendars enable row level security;
alter table public.calendar_memberships enable row level security;

-- Existing reciprocal pairs become active memberships. Historical pairs are
-- registered lazily if and when the same two users reconnect.
insert into public.shared_calendars (calendar_id, member_one_id, member_two_id)
select
  p.id::text || '_' || p.partner_id::text,
  p.id,
  p.partner_id
from public.profiles p
join public.profiles partner on partner.id = p.partner_id and partner.partner_id = p.id
where p.id::text < p.partner_id::text
on conflict (calendar_id) do nothing;

insert into public.calendar_memberships (calendar_id, user_id, is_active, connected_at)
select calendar_id, member_one_id, true, now() from public.shared_calendars
union all
select calendar_id, member_two_id, true, now() from public.shared_calendars
on conflict (calendar_id, user_id) do update
set is_active = true,
    connected_at = excluded.connected_at,
    disconnected_at = null;

create or replace function private.current_calendar_id()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select membership.calendar_id
      from public.calendar_memberships membership
      where membership.user_id = (select auth.uid())
        and membership.is_active
      limit 1
    ),
    (select auth.uid())::text
  );
$$;

create or replace function private.is_current_calendar_user(candidate uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select candidate = (select auth.uid())
    or exists (
      select 1
      from public.calendar_memberships membership
      where membership.calendar_id = (select private.current_calendar_id())
        and membership.user_id = candidate
        and membership.is_active
    );
$$;

create or replace function private.keep_partner_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.partner_id is distinct from old.partner_id and current_user <> 'postgres' then
    raise exception 'partner_link_is_rpc_only' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_keep_partner_link on public.profiles;
create trigger profiles_keep_partner_link
before update on public.profiles
for each row execute function private.keep_partner_link();

create or replace function public.connect_partner(p_invite_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_target_id uuid;
  v_me public.profiles%rowtype;
  v_target public.profiles%rowtype;
  v_first uuid;
  v_second uuid;
  v_calendar_id text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select id into v_target_id
  from public.profiles
  where upper(invite_code) = upper(trim(p_invite_code));
  if not found then raise exception 'invalid_code'; end if;
  if v_target_id = v_uid then raise exception 'cant_connect_self'; end if;

  perform 1
  from public.profiles
  where id in (v_uid, v_target_id)
  order by id
  for update;

  select * into v_me from public.profiles where id = v_uid;
  if not found then raise exception 'profile_not_found'; end if;
  select * into v_target from public.profiles where id = v_target_id;
  if not found then raise exception 'invalid_code'; end if;
  if v_me.partner_id is not null then raise exception 'already_connected'; end if;
  if v_target.partner_id is not null then raise exception 'partner_taken'; end if;

  v_first := least(v_uid, v_target_id);
  v_second := greatest(v_uid, v_target_id);
  v_calendar_id := v_first::text || '_' || v_second::text;

  update public.calendar_memberships
  set is_active = false,
      disconnected_at = now()
  where user_id in (v_uid, v_target_id)
    and is_active
    and calendar_id <> v_calendar_id;

  insert into public.shared_calendars (calendar_id, member_one_id, member_two_id)
  values (v_calendar_id, v_first, v_second)
  on conflict (calendar_id) do nothing;

  insert into public.calendar_memberships (calendar_id, user_id, is_active, connected_at)
  values
    (v_calendar_id, v_uid, true, now()),
    (v_calendar_id, v_target_id, true, now())
  on conflict (calendar_id, user_id) do update
  set is_active = true,
      connected_at = excluded.connected_at,
      disconnected_at = null;

  update public.profiles set partner_id = v_target_id where id = v_uid;
  update public.profiles set partner_id = v_uid where id = v_target_id;

  return to_jsonb(v_target);
end;
$$;

create or replace function public.disconnect_partner()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_partner_id uuid;
  v_calendar_id text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select partner_id into v_partner_id
  from public.profiles
  where id = v_uid;
  if v_partner_id is null then raise exception 'not_connected'; end if;

  perform 1
  from public.profiles
  where id in (v_uid, v_partner_id)
  order by id
  for update;

  if not exists (
    select 1 from public.profiles
    where id = v_partner_id and partner_id = v_uid
  ) then
    raise exception 'not_connected';
  end if;

  v_calendar_id := least(v_uid::text, v_partner_id::text) || '_' || greatest(v_uid::text, v_partner_id::text);

  update public.calendar_memberships
  set is_active = false,
      disconnected_at = now()
  where calendar_id = v_calendar_id
    and user_id in (v_uid, v_partner_id);

  update public.profiles set partner_id = null where id in (v_uid, v_partner_id);

  update public.data_export_requests
  set status = 'rejected',
      resolved_at = now()
  where calendar_id = v_calendar_id
    and status in ('pending', 'approved');

  update public.event_reminder_jobs
  set status = 'canceled',
      updated_at = now()
  where calendar_id = v_calendar_id
    and status in ('pending', 'processing', 'failed');
end;
$$;

create or replace function public.set_shared_anniversary(p_date date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_calendar_id text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  v_calendar_id := private.current_calendar_id();

  update public.profiles
  set anniversary_date = p_date
  where id = v_uid
     or id in (
       select user_id
       from public.calendar_memberships
       where calendar_id = v_calendar_id
         and is_active
     );
end;
$$;

do $$
declare
  v_table text;
  v_policy record;
begin
  foreach v_table in array array[
    'events',
    'notes_todo_groups',
    'notes_todos',
    'recurring_tasks',
    'recurring_task_logs',
    'recurring_event_exceptions',
    'shared_expenses',
    'week_plans',
    'expense_categories',
    'expense_budgets',
    'expense_settlements'
  ] loop
    for v_policy in
      select policyname
      from pg_policies
      where schemaname = 'public' and tablename = v_table
    loop
      execute format('drop policy if exists %I on public.%I', v_policy.policyname, v_table);
    end loop;
    execute format(
      'create policy %I on public.%I for select to authenticated using (calendar_id = (select private.current_calendar_id()))',
      'ralia_calendar_select', v_table
    );
    if v_table = 'shared_expenses' then
      execute format(
        'create policy %I on public.%I for insert to authenticated with check (calendar_id = (select private.current_calendar_id()) and (select private.is_current_calendar_user(paid_by)))',
        'ralia_calendar_insert', v_table
      );
    else
      execute format(
        'create policy %I on public.%I for insert to authenticated with check (calendar_id = (select private.current_calendar_id()) and created_by = (select auth.uid()))',
        'ralia_calendar_insert', v_table
      );
    end if;
    execute format(
      'create policy %I on public.%I for update to authenticated using (calendar_id = (select private.current_calendar_id())) with check (calendar_id = (select private.current_calendar_id()))',
      'ralia_calendar_update', v_table
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (calendar_id = (select private.current_calendar_id()))',
      'ralia_calendar_delete', v_table
    );
  end loop;
end;
$$;

do $$
declare
  v_policy record;
begin
  for v_policy in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'expense_splits'
  loop
    execute format('drop policy if exists %I on public.expense_splits', v_policy.policyname);
  end loop;
end;
$$;

create policy ralia_expense_splits_select
on public.expense_splits for select to authenticated
using (
  exists (
    select 1 from public.shared_expenses expense
    where expense.id = expense_id
      and expense.calendar_id = (select private.current_calendar_id())
  )
);

create policy ralia_expense_splits_insert
on public.expense_splits for insert to authenticated
with check (
  (select private.is_current_calendar_user(user_id))
  and exists (
    select 1 from public.shared_expenses expense
    where expense.id = expense_id
      and expense.calendar_id = (select private.current_calendar_id())
  )
);

create policy ralia_expense_splits_update
on public.expense_splits for update to authenticated
using (
  exists (
    select 1 from public.shared_expenses expense
    where expense.id = expense_id
      and expense.calendar_id = (select private.current_calendar_id())
  )
)
with check (
  (select private.is_current_calendar_user(user_id))
  and exists (
    select 1 from public.shared_expenses expense
    where expense.id = expense_id
      and expense.calendar_id = (select private.current_calendar_id())
  )
);

create policy ralia_expense_splits_delete
on public.expense_splits for delete to authenticated
using (
  exists (
    select 1 from public.shared_expenses expense
    where expense.id = expense_id
      and expense.calendar_id = (select private.current_calendar_id())
  )
);

drop policy if exists data_export_requests_select_participant on public.data_export_requests;
create policy data_export_requests_select_active_calendar
on public.data_export_requests for select to authenticated
using (calendar_id = (select private.current_calendar_id()));

revoke all on function private.keep_partner_link() from public, anon, authenticated;
revoke all on function public.connect_partner(text) from public, anon;
revoke all on function public.disconnect_partner() from public, anon;
revoke all on function public.set_shared_anniversary(date) from public, anon;
grant execute on function public.connect_partner(text) to authenticated;
grant execute on function public.disconnect_partner() to authenticated;
grant execute on function public.set_shared_anniversary(date) to authenticated;
