-- Specify a timetable period's duration before converting periods/week into hours/week.
-- Keep separate from annual SAR targets so this can be corrected independently.
create table public.sar_period_durations(
 school_id uuid not null references public.schools(id) on delete cascade,
 academic_year_id uuid not null references public.academic_years(id) on delete cascade,
 minutes_per_period smallint not null check(minutes_per_period between 20 and 120),
 updated_at timestamptz not null default now(),
 primary key(school_id,academic_year_id)
);
alter table public.sar_period_durations enable row level security;
grant select,insert,update on public.sar_period_durations to authenticated;
create policy sar_period_duration_read on public.sar_period_durations for select to authenticated
using(exists(select 1 from public.school_memberships m where m.school_id=sar_period_durations.school_id and m.user_id=(select auth.uid()) and m.active and m.role in ('school_admin','teacher')));
create policy sar_period_duration_insert on public.sar_period_durations for insert to authenticated
with check(exists(select 1 from public.school_memberships m where m.school_id=sar_period_durations.school_id and m.user_id=(select auth.uid()) and m.active and m.role='school_admin')
 and exists(select 1 from public.academic_years y where y.school_id=sar_period_durations.school_id and y.id=sar_period_durations.academic_year_id));
create policy sar_period_duration_update on public.sar_period_durations for update to authenticated
using(exists(select 1 from public.school_memberships m where m.school_id=sar_period_durations.school_id and m.user_id=(select auth.uid()) and m.active and m.role='school_admin'))
with check(exists(select 1 from public.school_memberships m where m.school_id=sar_period_durations.school_id and m.user_id=(select auth.uid()) and m.active and m.role='school_admin'));
