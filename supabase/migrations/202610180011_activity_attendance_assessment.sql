create table if not exists public.school_activity_schedules (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id),
 term_id uuid not null references public.terms(id),
 classroom_id uuid not null references public.classrooms(id),
 activity_type text not null check(activity_type in ('sss','guidance','ethics','club','scout')),
 weekday_no int not null check(weekday_no between 1 and 7),
 period_no int not null check(period_no between 1 and 20),
 teacher_user_id uuid,
 updated_at timestamptz not null default now(),
 unique(term_id,classroom_id,activity_type,weekday_no,period_no),
 check ((activity_type in ('sss','guidance','ethics') and teacher_user_id is not null) or (activity_type in ('club','scout') and teacher_user_id is null))
);
create index if not exists activity_schedule_term on public.school_activity_schedules(term_id,weekday_no,period_no);
create table if not exists public.school_activity_attendance (
 id uuid primary key default gen_random_uuid(),
 schedule_id uuid not null references public.school_activity_schedules(id) on delete cascade,
 school_id uuid not null references public.schools(id),
 student_id uuid not null references public.students(id),
 class_date date not null,
 status text not null check(status in ('present','absent','late','leave')),
 recorded_by uuid not null,
 updated_at timestamptz not null default now(),
 unique(schedule_id,student_id,class_date)
);
create table if not exists public.school_activity_assessments (
 id uuid primary key default gen_random_uuid(),
 schedule_id uuid not null references public.school_activity_schedules(id) on delete cascade,
 school_id uuid not null references public.schools(id),
 student_id uuid not null references public.students(id),
 result text not null check(result in ('pending','pass','fail')),
 comment text not null default '',
 recorded_by uuid not null,
 updated_at timestamptz not null default now(),
 unique(schedule_id,student_id)
);
alter table public.school_activity_schedules enable row level security;
alter table public.school_activity_attendance enable row level security;
alter table public.school_activity_assessments enable row level security;
create policy activity_schedules_read on public.school_activity_schedules for select to authenticated using(exists(select 1 from public.school_memberships m where m.school_id=school_activity_schedules.school_id and m.user_id=auth.uid() and m.active));
create policy activity_attendance_read on public.school_activity_attendance for select to authenticated using(exists(select 1 from public.school_memberships m where m.school_id=school_activity_attendance.school_id and m.user_id=auth.uid() and m.active));
create policy activity_assessments_read on public.school_activity_assessments for select to authenticated using(exists(select 1 from public.school_memberships m where m.school_id=school_activity_assessments.school_id and m.user_id=auth.uid() and m.active));
grant select on public.school_activity_schedules,public.school_activity_attendance,public.school_activity_assessments to authenticated;
create or replace function public.save_activity_schedule(p_term uuid,p_room uuid,p_kind text,p_day int,p_period int,p_teacher uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_school uuid;v_year uuid;v_id uuid;v_role boolean;
begin
 select t.school_id,t.academic_year_id into v_school,v_year from public.terms t where t.id=p_term;
 if v_school is null or auth.uid() is null or not private.has_school_role(v_school,array['school_admin','academic']) then raise exception 'Not allowed to manage activity schedules';end if;
 if not exists(select 1 from public.classrooms r where r.id=p_room and r.school_id=v_school and r.academic_year_id=v_year) then raise exception 'Classroom does not belong to the selected school year';end if;
 if p_kind not in ('sss','guidance','ethics','club','scout') or p_day not between 1 and 7 or p_period not between 1 and 20 then raise exception 'Invalid activity or schedule';end if;
 if p_kind in ('sss','guidance','ethics') then
  if p_teacher is null or not exists(select 1 from public.school_memberships m where m.school_id=v_school and m.user_id=p_teacher and m.active) then raise exception 'Select active teacher for the activity';end if;
 else
  if p_teacher is not null then raise exception 'Club and scouts are assigned to both homeroom teachers';end if;
 end if;
 perform pg_advisory_xact_lock(hashtext(p_term::text));
 if exists(select 1 from public.timetable_slots ts join public.course_offerings o on o.id=ts.course_offering_id where ts.term_id=p_term and o.classroom_id=p_room and ts.weekday_no=p_day and ts.period_no=p_period) then raise exception 'Regular subject already occupies this classroom slot';end if;
 if exists(select 1 from public.school_activity_schedules sa where sa.term_id=p_term and sa.classroom_id=p_room and sa.weekday_no=p_day and sa.period_no=p_period and sa.activity_type<>p_kind) then raise exception 'Another activity occupies the classroom slot';end if;
 insert into public.school_activity_schedules(school_id,term_id,classroom_id,activity_type,weekday_no,period_no,teacher_user_id)
 values(v_school,p_term,p_room,p_kind,p_day,p_period,p_teacher)
 on conflict(term_id,classroom_id,activity_type,weekday_no,period_no) do update set teacher_user_id=excluded.teacher_user_id,updated_at=now()
 returning id into v_id;
 return v_id;
end $$;
create or replace function public.save_school_activity_record(p_schedule uuid,p_student uuid,p_date date,p_status text,p_result text default null,p_comment text default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_row public.school_activity_schedules%rowtype;v_year uuid;v_authorized boolean;
begin
 select * into v_row from public.school_activity_schedules where id=p_schedule;
 if not found or auth.uid() is null then raise exception 'Activity not found or unauthenticated';end if;
 select academic_year_id into v_year from public.terms where id=v_row.term_id;
 v_authorized:=private.has_school_role(v_row.school_id,array['school_admin','academic']) or
  (v_row.activity_type in ('sss','guidance','ethics') and v_row.teacher_user_id=auth.uid()) or
  (v_row.activity_type in ('club','scout') and exists(select 1 from public.homeroom_assignments h where h.school_id=v_row.school_id and h.classroom_id=v_row.classroom_id and h.teacher_user_id=auth.uid()));
 if not v_authorized then raise exception 'You cannot record this activity';end if;
 if not exists(select 1 from public.enrollments e where e.school_id=v_row.school_id and e.academic_year_id=v_year and e.classroom_id=v_row.classroom_id and e.student_id=p_student and e.status in ('active','completed') and (p_date is null or ((e.started_on is null or e.started_on<=p_date) and (e.ended_on is null or e.ended_on>=p_date)))) then raise exception 'Student not enrolled in this classroom';end if;
 if p_status is not null then
  if p_date is null or p_status not in ('present','absent','late','leave') then raise exception 'Invalid attendance record';end if;
  if extract(isodow from p_date)::int<>v_row.weekday_no then raise exception 'Attendance date does not match the activity weekday';end if;
  insert into public.school_activity_attendance(schedule_id,school_id,student_id,class_date,status,recorded_by)
  values(p_schedule,v_row.school_id,p_student,p_date,p_status,auth.uid())
  on conflict(schedule_id,student_id,class_date) do update set status=excluded.status,recorded_by=auth.uid(),updated_at=now();
 end if;
 if p_result is not null then
  if p_result not in ('pending','pass','fail') then raise exception 'Invalid assessment';end if;
  insert into public.school_activity_assessments(schedule_id,school_id,student_id,result,comment,recorded_by)
  values(p_schedule,v_row.school_id,p_student,p_result,left(coalesce(p_comment,''),500),auth.uid())
  on conflict(schedule_id,student_id) do update set result=excluded.result,comment=excluded.comment,recorded_by=auth.uid(),updated_at=now();
 end if;
end $$;
revoke all on function public.save_activity_schedule(uuid,uuid,text,int,int,uuid),public.save_school_activity_record(uuid,uuid,date,text,text,text) from public,anon;
grant execute on function public.save_activity_schedule(uuid,uuid,text,int,int,uuid),public.save_school_activity_record(uuid,uuid,date,text,text,text) to authenticated;