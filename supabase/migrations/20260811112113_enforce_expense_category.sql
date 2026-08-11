update public.shared_expenses
set category = 'Sonstiges'
where category is null or btrim(category) = '';

alter table public.shared_expenses
  alter column category set default 'Sonstiges',
  alter column category set not null,
  add constraint shared_expenses_category_not_blank_check
    check (length(btrim(category)) > 0);
