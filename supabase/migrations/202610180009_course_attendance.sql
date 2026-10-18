create table if not exists public.course_attendance_records(
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id),
 course_offering_id uuid not null references public.course_offerings(id),
 student_id uuid not null references public.students(id),
 class_date date not null,
 session_no smallint not null check(session_no between 1 and 20),
 attendance_status text not null check(attendance_status in ('present','absent','late','leave')),
 recorded_by uuid not null,
 updated_at timestamptz not null default now(),
 unique(course_offering_id,student_id,class_date,session_no)
);
create index if not exists course_attendance_lookup on public.course_attendance_records(course_offering_id,class_date);
alter table public.course_attendance_records enable row level security;
create policy course_attendance_read on public.course_attendance_records for select to authenticated using(exists(select 1 from public.school_memberships m where m.school_id=course_attendance_records.school_id and m.user_id=auth.uid() and m.active));
grant select on public.course_attendance_records to authenticated;
create or replace function public.save_course_attendance(p_offering uuid,p_student uuid,p_date date,p_session integer,p_status text)
returns void language plpgsql security definer set search_path='' as $$
declare v_school uuid;v_room uuid;v_year uuid;
begin
 select o.school_id,o.classroom_id,t.academic_year_id into v_school,v_room,v_year from public.course_offerings o join public.terms t on t.id=o.term_id where o.id=p_offering;
 if v_school is null or auth.uid() is null or not (
  private.has_school_role(v_school,array['school_admin','academic']) or
  exists(select 1 from public.teaching_assignments a where a.school_id=v_school and a.course_offering_id=p_offering and a.teacher_user_id=auth.uid())
 ) then raise exception 'No attendance permission';end if;
 if not exists(select 1 from public.enrollments e where e.student_id=p_student and e.classroom_id=v_room and e.school_id=v_school and e.academic_year_id=v_year and e.status in ('active','completed') and (e.started_on is null or e.started_on<=p_date) and (e.ended_on is null or e.ended_on>=p_date)) then raise exception 'Student is not enrolled in this class on this date';end if;
 if p_date is null or p_session not between 1 and 20 or p_status not in ('present','absent','late','leave') then raise exception 'Invalid attendance';end if;
 insert into public.course_attendance_records(school_id,course_offering_id,student_id,class_date,session_no,attendance_status,recorded_by)
 values(v_school,p_offering,p_student,p_date,p_session,p_status,auth.uid())
 on conflict(course_offering_id,student_id,class_date,session_no) do update set attendance_status=excluded.attendance_status,recorded_by=auth.uid(),updated_at=now();
end $$;
revoke all on function public.save_course_attendance(uuid,uuid,date,integer,text) from public,anon;
grant execute on function public.save_course_attendance(uuid,uuid,date,integer,text) to authenticated;