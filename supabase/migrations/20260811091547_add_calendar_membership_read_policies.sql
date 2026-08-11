create policy shared_calendars_select_active_member
on public.shared_calendars for select
to authenticated
using (
  exists (
    select 1 from public.calendar_memberships membership
    where membership.calendar_id = shared_calendars.calendar_id
      and membership.user_id = (select auth.uid())
      and membership.is_active
  )
);

create policy calendar_memberships_select_own
on public.calendar_memberships for select
to authenticated
using (user_id = (select auth.uid()));
