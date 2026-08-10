-- Persist task completion and assignment in the existing week planner.
-- All changes are additive; existing entries retain safe defaults.

alter table public.week_plans
  add column if not exists assigned_to text not null default 'both',
  add column if not exists is_done boolean not null default false,
  add column if not exists completed_at timestamptz null;

comment on column public.week_plans.assigned_to is
  'User UUID responsible for the planned task, or both';
comment on column public.week_plans.is_done is
  'Completion state for task entries; meal entries keep the default false';
comment on column public.week_plans.completed_at is
  'Timestamp of the latest task completion';

create index if not exists week_plans_calendar_week_type_day_idx
on public.week_plans (calendar_id, week_start, entry_type, day_of_week, sort_order);
