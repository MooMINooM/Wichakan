create table if not exists public.timetable_course_preferences(
 school_id uuid not null references public.schools(id),
 term_id uuid not null references public.terms(id),
 course_offering_id uuid primary key references public.course_offerings(id),
 double_period boolean not null default false,
 updated_at timestamptz not null default now(),
 updated_by uuid not null
);
alter table public.timetable_course_preferences enable row level security;
create policy timetable_preferences_select on public.timetable_course_preferences for select to authenticated using (exists(select 1 from public.school_memberships m where m.school_id=timetable_course_preferences.school_id and m.user_id=auth.uid() and m.active));
grant select on public.timetable_course_preferences to authenticated;
create or replace function public.set_timetable_double_period(p_offering_id uuid,p_double boolean)
returns void language plpgsql security definer set search_path='' as $$
declare v_school uuid;v_term uuid;
begin
 select school_id,term_id into v_school,v_term from public.course_offerings where id=p_offering_id;
 if not found or auth.uid() is null or not private.has_school_role(v_school,array['school_admin','academic']) then raise exception 'ไม่มีสิทธิ์ตั้งคาบคู่';end if;
 insert into public.timetable_course_preferences(school_id,term_id,course_offering_id,double_period,updated_by)
 values(v_school,v_term,p_offering_id,p_double,auth.uid())
 on conflict(course_offering_id) do update set double_period=excluded.double_period,updated_at=now(),updated_by=auth.uid();
end $$;
revoke all on function public.set_timetable_double_period(uuid,boolean) from public,anon;
grant execute on function public.set_timetable_double_period(uuid,boolean) to authenticated;