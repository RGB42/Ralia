-- Additive product foundations for organizer, money and user preferences.
-- This migration intentionally does not delete, rename or rewrite existing rows.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create or replace function private.current_calendar_id()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p.partner_id is null then p.id::text
    else least(p.id::text, p.partner_id::text) || '_' || greatest(p.id::text, p.partner_id::text)
  end
  from public.profiles p
  where p.id = (select auth.uid());
$$;

create or replace function private.is_current_calendar_user(candidate uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and (candidate = p.id or candidate = p.partner_id)
  );
$$;

revoke all on function private.current_calendar_id() from public, anon;
revoke all on function private.is_current_calendar_user(uuid) from public, anon;
grant execute on function private.current_calendar_id() to authenticated, service_role;
grant execute on function private.is_current_calendar_user(uuid) to authenticated, service_role;

create or replace function private.keep_created_by()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'created_by_is_immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function private.keep_created_by() from public, anon, authenticated;

create table public.app_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  solo_mode boolean not null default false,
  week_start text not null default 'mo' check (week_start in ('mo', 'so')),
  locale text not null default 'de' check (locale in ('de', 'en')),
  notification_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_preferences enable row level security;

create policy app_preferences_select_own
on public.app_preferences for select
to authenticated
using (user_id = (select auth.uid()));

create policy app_preferences_insert_own
on public.app_preferences for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy app_preferences_update_own
on public.app_preferences for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy app_preferences_delete_own
on public.app_preferences for delete
to authenticated
using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.app_preferences to authenticated;

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  calendar_id text not null,
  name text not null check (length(trim(name)) between 1 and 60),
  color text null check (color is null or color ~ '^#[0-9A-Fa-f]{6}$'),
  monthly_limit numeric(12, 2) null check (monthly_limit is null or monthly_limit >= 0),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index expense_categories_calendar_name_unique
on public.expense_categories (calendar_id, lower(name));

create index expense_categories_created_by_idx
on public.expense_categories (created_by);

create trigger expense_categories_keep_created_by
before update on public.expense_categories
for each row execute function private.keep_created_by();

alter table public.expense_categories enable row level security;

create policy expense_categories_select_calendar
on public.expense_categories for select
to authenticated
using (calendar_id = (select private.current_calendar_id()));

create policy expense_categories_insert_calendar
on public.expense_categories for insert
to authenticated
with check (
  calendar_id = (select private.current_calendar_id())
  and created_by = (select auth.uid())
);

create policy expense_categories_update_calendar
on public.expense_categories for update
to authenticated
using (calendar_id = (select private.current_calendar_id()))
with check (calendar_id = (select private.current_calendar_id()));

create policy expense_categories_delete_calendar
on public.expense_categories for delete
to authenticated
using (calendar_id = (select private.current_calendar_id()));

grant select, insert, update, delete on public.expense_categories to authenticated;

create table public.expense_budgets (
  id uuid primary key default gen_random_uuid(),
  calendar_id text not null,
  month_start date not null check (extract(day from month_start) = 1),
  amount numeric(12, 2) not null check (amount >= 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (calendar_id, month_start)
);

create index expense_budgets_created_by_idx
on public.expense_budgets (created_by);

create trigger expense_budgets_keep_created_by
before update on public.expense_budgets
for each row execute function private.keep_created_by();

alter table public.expense_budgets enable row level security;

create policy expense_budgets_select_calendar
on public.expense_budgets for select
to authenticated
using (calendar_id = (select private.current_calendar_id()));

create policy expense_budgets_insert_calendar
on public.expense_budgets for insert
to authenticated
with check (
  calendar_id = (select private.current_calendar_id())
  and created_by = (select auth.uid())
);

create policy expense_budgets_update_calendar
on public.expense_budgets for update
to authenticated
using (calendar_id = (select private.current_calendar_id()))
with check (calendar_id = (select private.current_calendar_id()));

create policy expense_budgets_delete_calendar
on public.expense_budgets for delete
to authenticated
using (calendar_id = (select private.current_calendar_id()));

grant select, insert, update, delete on public.expense_budgets to authenticated;

create table public.expense_splits (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.shared_expenses(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  amount numeric(12, 2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (expense_id, user_id)
);

create index expense_splits_user_id_idx on public.expense_splits (user_id);

alter table public.expense_splits enable row level security;

create policy expense_splits_select_calendar
on public.expense_splits for select
to authenticated
using (
  exists (
    select 1
    from public.shared_expenses e
    where e.id = expense_id
      and e.calendar_id = (select private.current_calendar_id())
  )
);

create policy expense_splits_insert_calendar
on public.expense_splits for insert
to authenticated
with check (
  (select private.is_current_calendar_user(user_id))
  and exists (
    select 1
    from public.shared_expenses e
    where e.id = expense_id
      and e.calendar_id = (select private.current_calendar_id())
  )
);

create policy expense_splits_update_calendar
on public.expense_splits for update
to authenticated
using (
  exists (
    select 1
    from public.shared_expenses e
    where e.id = expense_id
      and e.calendar_id = (select private.current_calendar_id())
  )
)
with check (
  (select private.is_current_calendar_user(user_id))
  and exists (
    select 1
    from public.shared_expenses e
    where e.id = expense_id
      and e.calendar_id = (select private.current_calendar_id())
  )
);

create policy expense_splits_delete_calendar
on public.expense_splits for delete
to authenticated
using (
  exists (
    select 1
    from public.shared_expenses e
    where e.id = expense_id
      and e.calendar_id = (select private.current_calendar_id())
  )
);

grant select, insert, update, delete on public.expense_splits to authenticated;

create table public.expense_settlements (
  id uuid primary key default gen_random_uuid(),
  calendar_id text not null,
  from_user_id uuid not null references public.profiles(id),
  to_user_id uuid not null references public.profiles(id),
  amount numeric(12, 2) not null check (amount > 0),
  settled_at date not null default current_date,
  notes text null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  check (from_user_id <> to_user_id)
);

create index expense_settlements_calendar_date_idx
on public.expense_settlements (calendar_id, settled_at desc);
create index expense_settlements_from_user_idx on public.expense_settlements (from_user_id);
create index expense_settlements_to_user_idx on public.expense_settlements (to_user_id);
create index expense_settlements_created_by_idx on public.expense_settlements (created_by);

alter table public.expense_settlements enable row level security;

create policy expense_settlements_select_calendar
on public.expense_settlements for select
to authenticated
using (calendar_id = (select private.current_calendar_id()));

create policy expense_settlements_insert_calendar
on public.expense_settlements for insert
to authenticated
with check (
  calendar_id = (select private.current_calendar_id())
  and created_by = (select auth.uid())
  and (select private.is_current_calendar_user(from_user_id))
  and (select private.is_current_calendar_user(to_user_id))
);

create policy expense_settlements_delete_calendar
on public.expense_settlements for delete
to authenticated
using (
  calendar_id = (select private.current_calendar_id())
  and created_by = (select auth.uid())
);

grant select, insert, delete on public.expense_settlements to authenticated;

create or replace function public.rename_notes_todo_group(
  p_calendar_id text,
  p_group_id uuid,
  p_current_name text,
  p_new_name text
)
returns public.notes_todo_groups
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_group public.notes_todo_groups%rowtype;
  v_new_name text := trim(p_new_name);
begin
  if v_new_name = '' or length(v_new_name) > 60 then
    raise exception 'invalid_group_name' using errcode = '22023';
  end if;

  select * into v_group
  from public.notes_todo_groups
  where id = p_group_id
    and calendar_id = p_calendar_id
    and name = p_current_name
  for update;

  if not found then
    raise exception 'group_not_found' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from public.notes_todo_groups
    where calendar_id = p_calendar_id
      and lower(name) = lower(v_new_name)
      and id <> p_group_id
  ) then
    raise exception 'group_name_exists' using errcode = '23505';
  end if;

  update public.notes_todo_groups
  set name = v_new_name
  where id = p_group_id
  returning * into v_group;

  update public.notes_todos
  set group_name = v_new_name,
      updated_at = now()
  where calendar_id = p_calendar_id
    and group_name = p_current_name;

  return v_group;
end;
$$;

create or replace function public.delete_notes_todo_group(
  p_calendar_id text,
  p_group_id uuid,
  p_group_name text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.notes_todos
    where calendar_id = p_calendar_id
      and group_name = p_group_name
  ) then
    raise exception 'group_is_not_empty' using errcode = '23503';
  end if;

  delete from public.notes_todo_groups
  where id = p_group_id
    and calendar_id = p_calendar_id
    and name = p_group_name;

  if not found then
    raise exception 'group_not_found' using errcode = 'P0002';
  end if;

  return p_group_id;
end;
$$;

create or replace function public.reorder_notes_todos(
  p_calendar_id text,
  p_group_name text,
  p_positions jsonb,
  p_updated_at timestamptz default now()
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_expected integer;
  v_updated integer;
begin
  if jsonb_typeof(p_positions) <> 'array' then
    raise exception 'positions_must_be_an_array' using errcode = '22023';
  end if;

  v_expected := jsonb_array_length(p_positions);
  if v_expected > 500 then
    raise exception 'too_many_positions' using errcode = '22023';
  end if;

  if (
    select count(*) <> count(distinct item.id)
    from jsonb_to_recordset(p_positions) as item(id uuid, sort_order integer)
  ) then
    raise exception 'duplicate_item_ids' using errcode = '22023';
  end if;

  update public.notes_todos todo
  set sort_order = item.sort_order,
      updated_at = p_updated_at
  from jsonb_to_recordset(p_positions) as item(id uuid, sort_order integer)
  where todo.id = item.id
    and todo.calendar_id = p_calendar_id
    and todo.group_name = p_group_name
    and item.sort_order >= 0;

  get diagnostics v_updated = row_count;
  if v_updated <> v_expected then
    raise exception 'one_or_more_items_not_found' using errcode = 'P0002';
  end if;

  return v_updated;
end;
$$;

revoke all on function public.rename_notes_todo_group(text, uuid, text, text) from public, anon;
revoke all on function public.delete_notes_todo_group(text, uuid, text) from public, anon;
revoke all on function public.reorder_notes_todos(text, text, jsonb, timestamptz) from public, anon;
grant execute on function public.rename_notes_todo_group(text, uuid, text, text) to authenticated;
grant execute on function public.delete_notes_todo_group(text, uuid, text) to authenticated;
grant execute on function public.reorder_notes_todos(text, text, jsonb, timestamptz) to authenticated;

alter function public.generate_invite_code() set search_path = '';

create index if not exists events_created_by_idx on public.events (created_by);
create index if not exists events_parent_event_id_idx on public.events (parent_event_id);
create index if not exists notes_todo_groups_created_by_idx on public.notes_todo_groups (created_by);
create index if not exists notes_todos_created_by_idx on public.notes_todos (created_by);
create index if not exists profiles_partner_id_idx on public.profiles (partner_id);
create index if not exists recurring_event_exceptions_created_by_idx
  on public.recurring_event_exceptions (created_by);
create index if not exists recurring_task_logs_created_by_idx
  on public.recurring_task_logs (created_by);
create index if not exists recurring_task_logs_task_id_idx
  on public.recurring_task_logs (task_id);
create index if not exists recurring_tasks_created_by_idx on public.recurring_tasks (created_by);
create index if not exists shared_expenses_paid_by_idx on public.shared_expenses (paid_by);
create index if not exists week_plans_created_by_idx on public.week_plans (created_by);
