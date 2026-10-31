-- All homeroom teachers of the same classroom share a single club/scout result.
-- The canonical row is already keyed by classroom, activity, period, student.
-- This migration changes permissions only, preserving every assessment.
create or replace function private.can_assess_school_activity(p_room uuid,p_kind text,p_period integer)
returns boolean language sql stable security invoker set search_path='' as $$
 with activity as (
  select s.teacher_user_id,t.term_no,c.school_id,c.level_code
  from public.classrooms c
  join public.school_activity_schedules s on s.classroom_id=c.id and s.school_id=c.school_id
  join public.terms t on t.id=s.term_id and t.school_id=s.school_id
   and t.academic_year_id=c.academic_year_id
  where c.id=p_room and s.activity_type=p_kind
   and p_kind in ('sss','guidance','ethics','club','scout')
   and ((c.level_code like 'ป.%' and p_period=0)
      or (c.level_code like 'ม.%' and p_period in (1,2)))
 ), applicable as (
  select * from activity a
  where p_period=0 or a.term_no=p_period
   or not exists(select 1 from activity b where b.term_no=p_period)
 )
 select coalesce(
  private.has_school_role((select school_id from activity limit 1),array['teacher'])
  and (
   (p_kind in ('club','scout')
    and exists(select 1 from applicable)
    and exists(select 1 from public.homeroom_assignments h where h.school_id=(select school_id from activity limit 1) and h.classroom_id=p_room and h.teacher_user_id=auth.uid()))
   or (p_kind in ('sss','guidance','ethics')
    and exists(select 1 from applicable where teacher_user_id=auth.uid()))
  ),false);
$$;

revoke all on function private.can_assess_school_activity(uuid,text,integer) from public,anon;
grant execute on function private.can_assess_school_activity(uuid,text,integer) to authenticated;

-- Keep the legacy attendance/activity RPC under the same permission model.
create or replace function public.save_school_activity_record(p_schedule uuid,p_student uuid,p_date date,p_status text,p_result text default null,p_comment text default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_row public.school_activity_schedules%rowtype;v_year uuid;v_authorized boolean;
begin
 select * into v_row from public.school_activity_schedules where id=p_schedule;
 if not found or auth.uid() is null then raise exception 'Activity not found or unauthenticated';end if;
 select academic_year_id into v_year from public.terms where id=v_row.term_id;
 v_authorized:=private.has_school_role(v_row.school_id,array['teacher']) and
  ((v_row.activity_type in ('sss','guidance','ethics') and v_row.teacher_user_id=auth.uid())
   or (v_row.activity_type in ('club','scout') and exists(
    select 1 from public.homeroom_assignments h
    where h.school_id=v_row.school_id and h.classroom_id=v_row.classroom_id
      and h.teacher_user_id=auth.uid())));
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
revoke all on function public.save_school_activity_record(uuid,uuid,date,text,text,text) from public,anon;
grant execute on function public.save_school_activity_record(uuid,uuid,date,text,text,text) to authenticated;

-- The previous single-recorder nomination is obsolete; no results are removed.
drop function if exists public.assign_activity_homeroom_recorder(uuid,uuid);
drop function if exists private.activity_homeroom_recorder(uuid);
drop policy if exists "academic update activity recorder" on public.homeroom_assignments;
alter table public.homeroom_assignments drop column if exists is_activity_recorder;
