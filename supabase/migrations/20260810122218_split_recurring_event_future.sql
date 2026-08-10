-- Atomically split or truncate a recurring series from one occurrence onward.
-- Defining this function does not modify existing rows; data changes only when
-- an authenticated user explicitly invokes the RPC.

create or replace function public.split_recurring_event_future(
  p_master_event_id uuid,
  p_original_occurrence_date date,
  p_event_data jsonb,
  p_delete_future boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_master public.events%rowtype;
  v_old_master public.events%rowtype;
  v_new_master public.events%rowtype;
  v_previous_date date := p_original_occurrence_date - 1;
  v_duration integer;
  v_new_start date;
  v_new_end date;
  v_reminder_offsets integer[];
begin
  if p_event_data is null or jsonb_typeof(p_event_data) <> 'object' then
    raise exception 'event_data_must_be_an_object' using errcode = '22023';
  end if;

  select * into v_master
  from public.events
  where id = p_master_event_id
  for update;

  if not found then
    raise exception 'event_not_found' using errcode = 'P0002';
  end if;
  if v_master.recurrence_type is null then
    raise exception 'event_is_not_recurring' using errcode = '22023';
  end if;
  if p_original_occurrence_date <= v_master.start_date then
    raise exception 'first_occurrence_requires_whole_series' using errcode = '22023';
  end if;
  if v_master.recurrence_end_date is not null
     and p_original_occurrence_date > v_master.recurrence_end_date then
    raise exception 'occurrence_after_series_end' using errcode = '22023';
  end if;

  update public.events
  set recurrence_end_date = least(coalesce(recurrence_end_date, v_previous_date), v_previous_date),
      updated_at = now()
  where id = p_master_event_id
  returning * into v_old_master;

  if p_delete_future then
    delete from public.recurring_event_exceptions
    where master_event_id = p_master_event_id
      and original_occurrence_date >= p_original_occurrence_date;

    return jsonb_build_object(
      'oldMaster', to_jsonb(v_old_master),
      'newMaster', null,
      'deletedFuture', true
    );
  end if;

  v_duration := v_master.end_date - v_master.start_date;
  v_new_start := case
    when p_event_data ? 'start_date' then (p_event_data ->> 'start_date')::date
    else p_original_occurrence_date
  end;
  v_new_end := case
    when p_event_data ? 'end_date' then (p_event_data ->> 'end_date')::date
    else v_new_start + v_duration
  end;

  if v_new_end < v_new_start then
    raise exception 'end_date_before_start_date' using errcode = '22023';
  end if;

  v_reminder_offsets := case
    when p_event_data ? 'reminder_offsets'
         and jsonb_typeof(p_event_data -> 'reminder_offsets') = 'array'
      then array(
        select value::integer
        from jsonb_array_elements_text(p_event_data -> 'reminder_offsets') as value
      )
    when p_event_data ? 'reminder_offsets' then null
    else v_master.reminder_offsets
  end;

  insert into public.events (
    calendar_id,
    name,
    location,
    start_date,
    start_time,
    end_date,
    end_time,
    notes,
    belongs_to,
    created_by,
    recurrence_type,
    recurrence_end_date,
    parent_event_id,
    google_event_id,
    recurrence_interval,
    reminder_enabled,
    reminder_offset_minutes,
    reminder_offsets,
    event_type,
    is_special_auto,
    special_key,
    subtitle,
    short_description,
    extended_data,
    category,
    created_at,
    updated_at
  ) values (
    v_master.calendar_id,
    case when p_event_data ? 'name' then p_event_data ->> 'name' else v_master.name end,
    case when p_event_data ? 'location' then p_event_data ->> 'location' else v_master.location end,
    v_new_start,
    case when p_event_data ? 'start_time' then (p_event_data ->> 'start_time')::time else v_master.start_time end,
    v_new_end,
    case when p_event_data ? 'end_time' then (p_event_data ->> 'end_time')::time else v_master.end_time end,
    case when p_event_data ? 'notes' then p_event_data ->> 'notes' else v_master.notes end,
    case when p_event_data ? 'belongs_to' then p_event_data ->> 'belongs_to' else v_master.belongs_to end,
    (select auth.uid()),
    v_master.recurrence_type,
    v_master.recurrence_end_date,
    v_master.id,
    null,
    v_master.recurrence_interval,
    case when p_event_data ? 'reminder_enabled' then (p_event_data ->> 'reminder_enabled')::boolean else v_master.reminder_enabled end,
    case when p_event_data ? 'reminder_offset_minutes' then (p_event_data ->> 'reminder_offset_minutes')::integer else v_master.reminder_offset_minutes end,
    v_reminder_offsets,
    case when p_event_data ? 'event_type' then p_event_data ->> 'event_type' else v_master.event_type end,
    false,
    null,
    case when p_event_data ? 'subtitle' then p_event_data ->> 'subtitle' else v_master.subtitle end,
    case when p_event_data ? 'short_description' then p_event_data ->> 'short_description' else v_master.short_description end,
    case when p_event_data ? 'extended_data' then p_event_data -> 'extended_data' else v_master.extended_data end,
    case when p_event_data ? 'category' then p_event_data ->> 'category' else v_master.category end,
    now(),
    now()
  )
  returning * into v_new_master;

  update public.recurring_event_exceptions
  set master_event_id = v_new_master.id,
      updated_at = now()
  where master_event_id = p_master_event_id
    and original_occurrence_date >= p_original_occurrence_date;

  return jsonb_build_object(
    'oldMaster', to_jsonb(v_old_master),
    'newMaster', to_jsonb(v_new_master),
    'deletedFuture', false
  );
end;
$$;

revoke all on function public.split_recurring_event_future(uuid, date, jsonb, boolean)
from public, anon;
grant execute on function public.split_recurring_event_future(uuid, date, jsonb, boolean)
to authenticated;
