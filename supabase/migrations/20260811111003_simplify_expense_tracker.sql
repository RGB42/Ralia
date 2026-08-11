-- Store a simple, durable recipient instead of per-expense share rows.
-- NULL means both active calendar members share the expense equally.
alter table public.shared_expenses
  add column for_user_id uuid null references public.profiles(id);

-- Preserve unambiguous 100/0 custom splits. Every other custom split becomes
-- the new 50/50 "both" mode, as agreed for the simplified tracker.
update public.shared_expenses expense
set
  split_type = case
    when exists (
      select 1
      from public.expense_splits split
      where split.expense_id = expense.id
        and split.amount = expense.amount
    ) then 'single'
    else 'shared'
  end,
  for_user_id = (
    select split.user_id
    from public.expense_splits split
    where split.expense_id = expense.id
      and split.amount = expense.amount
    limit 1
  )
where exists (
  select 1 from public.expense_splits split where split.expense_id = expense.id
);

-- Legacy single expenses were entirely for their payer.
update public.shared_expenses
set
  split_type = 'single',
  for_user_id = paid_by
where split_type is distinct from 'shared'
  and for_user_id is null;

update public.shared_expenses
set
  split_type = 'shared',
  for_user_id = null
where split_type = 'shared';

delete from public.expense_splits;

alter table public.shared_expenses
  alter column split_type set not null;

alter table public.shared_expenses
  add constraint shared_expenses_recipient_matches_split_check
  check (
    (split_type = 'shared' and for_user_id is null)
    or (split_type = 'single' and for_user_id is not null)
  );

create index shared_expenses_calendar_paid_at_idx
  on public.shared_expenses (calendar_id, paid_at desc);

drop policy if exists ralia_calendar_insert on public.shared_expenses;
create policy ralia_calendar_insert
on public.shared_expenses for insert to authenticated
with check (
  calendar_id = (select private.current_calendar_id())
  and (select private.is_current_calendar_user(paid_by))
  and (for_user_id is null or (select private.is_current_calendar_user(for_user_id)))
);

drop policy if exists ralia_calendar_update on public.shared_expenses;
create policy ralia_calendar_update
on public.shared_expenses for update to authenticated
using (calendar_id = (select private.current_calendar_id()))
with check (
  calendar_id = (select private.current_calendar_id())
  and (select private.is_current_calendar_user(paid_by))
  and (for_user_id is null or (select private.is_current_calendar_user(for_user_id)))
);
