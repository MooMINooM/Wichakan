-- Select recurring host periods automatically, in weekday/period order.
-- Read through the caller's RLS; never copy or manufacture attendance marks.
create view public.course_attendance_slots with (security_invoker=true) as
with ranked as (
 select i.school_id,i.term_id,i.integrated_offering_id as course_offering_id,
        i.host_offering_id as source_offering_id,h.name_th as source_subject_name,
        ts.weekday_no,ts.period_no,
        row_number() over(partition by i.integrated_offering_id order by ts.weekday_no,ts.period_no) as ordinal,
        count(*) over(partition by i.integrated_offering_id) as available,
        s.learning_hours / case s.hour_basis when 'year' then 40 when 'term' then 20 end as required
 from public.timetable_course_integrations i
 join public.course_offerings o on o.id=i.integrated_offering_id and o.school_id=i.school_id and o.term_id=i.term_id
 join public.course_offerings ho on ho.id=i.host_offering_id and ho.school_id=i.school_id and ho.term_id=i.term_id and ho.classroom_id=o.classroom_id
 join public.subjects s on s.id=o.subject_id and s.school_id=i.school_id
 join public.subjects h on h.id=ho.subject_id and h.school_id=i.school_id
 join public.timetable_slots ts on ts.course_offering_id=ho.id and ts.school_id=i.school_id and ts.term_id=i.term_id
 where s.hour_basis in ('year','term') and s.learning_hours>0
   and s.learning_hours % case s.hour_basis when 'year' then 40 when 'term' then 20 end=0
   and ts.weekday_no between 1 and 5
   and not exists(select 1 from public.timetable_course_integrations chain where chain.integrated_offering_id=ho.id)
)
select ts.school_id,ts.term_id,ts.course_offering_id,ts.course_offering_id as source_offering_id,
       s.name_th as source_subject_name,ts.weekday_no,ts.period_no
from public.timetable_slots ts
join public.course_offerings o on o.id=ts.course_offering_id and o.school_id=ts.school_id and o.term_id=ts.term_id
join public.subjects s on s.id=o.subject_id and s.school_id=ts.school_id
where not exists(select 1 from public.timetable_course_integrations i where i.integrated_offering_id=ts.course_offering_id)
union all
select school_id,term_id,course_offering_id,source_offering_id,source_subject_name,weekday_no,period_no
from ranked where required<=available and ordinal<=required;
revoke all on public.course_attendance_slots from public,anon;
grant select on public.course_attendance_slots to authenticated;

create view public.effective_course_attendance with (security_invoker=true) as
select a.school_id,a.course_offering_id,a.student_id,a.class_date,a.session_no,a.attendance_status
from public.course_attendance_records a
where not exists(select 1 from public.timetable_course_integrations i where i.integrated_offering_id=a.course_offering_id)
union all
select slots.school_id,slots.course_offering_id,a.student_id,a.class_date,a.session_no,a.attendance_status
from public.course_attendance_slots slots
join public.course_attendance_records a on a.school_id=slots.school_id and a.course_offering_id=slots.source_offering_id
 and extract(isodow from a.class_date)=slots.weekday_no and a.session_no=slots.period_no
join public.terms t on t.id=slots.term_id and t.school_id=slots.school_id
join public.course_offerings o on o.id=slots.course_offering_id and o.school_id=slots.school_id
where slots.course_offering_id<>slots.source_offering_id
 and a.class_date between t.starts_on and t.ends_on
 and a.class_date<=(now() at time zone 'Asia/Bangkok')::date
 and exists(select 1 from public.enrollments e where e.school_id=slots.school_id and e.student_id=a.student_id
   and e.classroom_id=o.classroom_id and e.academic_year_id=t.academic_year_id
   and e.status in ('active','completed') and (e.started_on is null or e.started_on<=a.class_date)
   and (e.ended_on is null or e.ended_on>=a.class_date));
revoke all on public.effective_course_attendance from public,anon;
grant select on public.effective_course_attendance to authenticated;

-- Keep integrated attendance read-only, including legacy RPC callers.
create or replace function public.save_course_attendance(p_offering uuid,p_student uuid,p_date date,p_session integer,p_status text)
returns void language plpgsql security definer set search_path='' as $$
declare v_school uuid;v_room uuid;v_year uuid;
begin
 select o.school_id,o.classroom_id,t.academic_year_id into v_school,v_room,v_year from public.course_offerings o join public.terms t on t.id=o.term_id where o.id=p_offering;
 if v_school is null or auth.uid() is null or not (
  private.has_school_role(v_school,array['school_admin','academic']) or
  exists(select 1 from public.teaching_assignments a where a.school_id=v_school and a.course_offering_id=p_offering and a.teacher_user_id=auth.uid())
 ) then raise exception 'No attendance permission';end if;
 if exists(select 1 from public.timetable_course_integrations where integrated_offering_id=p_offering) then raise exception 'Integrated attendance is read from the selected host periods; record the host course instead';end if;
 if not exists(select 1 from public.enrollments e where e.student_id=p_student and e.classroom_id=v_room and e.school_id=v_school and e.academic_year_id=v_year and e.status in ('active','completed') and (e.started_on is null or e.started_on<=p_date) and (e.ended_on is null or e.ended_on>=p_date)) then raise exception 'Student is not enrolled in this class on this date';end if;
 if p_date is null or p_session not between 1 and 20 or p_status not in ('present','absent','late','leave') then raise exception 'Invalid attendance';end if;
 insert into public.course_attendance_records(school_id,course_offering_id,student_id,class_date,session_no,attendance_status,recorded_by)
 values(v_school,p_offering,p_student,p_date,p_session,p_status,auth.uid())
 on conflict(course_offering_id,student_id,class_date,session_no) do update set attendance_status=excluded.attendance_status,recorded_by=auth.uid(),updated_at=now();
end $$;
revoke all on function public.save_course_attendance(uuid,uuid,date,integer,text) from public,anon;
grant execute on function public.save_course_attendance(uuid,uuid,date,integer,text) to authenticated;
