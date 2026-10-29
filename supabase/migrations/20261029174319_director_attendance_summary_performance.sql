-- Materialize authorized rosters once, and aggregate all courses in one pass.
-- The shared slot view supplies the actual source offering for integrations;
-- timetable dates and enrollment intervals apply before counting stored marks.
create or replace function public.director_attendance_progress(p_year uuid,p_term uuid)
returns table(course_offering_id uuid,expected bigint,saved bigint,issue text)
language plpgsql stable security invoker set search_path='' as $$
declare v_school uuid;v_today date=(now() at time zone 'Asia/Bangkok')::date;
begin
 select y.school_id into v_school from public.academic_years y
 join public.terms t on t.academic_year_id=y.id and t.school_id=y.school_id
 where y.id=p_year and t.id=p_term;
 if v_school is null or not private.has_school_role(v_school,array['director','school_admin']) then
  raise exception 'ไม่มีสิทธิ์ดูข้อมูลปีหรือภาคเรียนนี้';
 end if;
 return query
 with courses as materialized (
  select o.id,o.classroom_id,t.starts_on,t.ends_on
  from public.course_offerings o join public.classrooms c on c.id=o.classroom_id and c.school_id=o.school_id
  join public.terms t on t.id=o.term_id and t.school_id=o.school_id
  where o.school_id=v_school and o.term_id=p_term and c.academic_year_id=p_year
 ), slots as materialized (
  select distinct s.course_offering_id,s.source_offering_id,s.weekday_no,s.period_no
  from public.course_attendance_slots s where s.school_id=v_school and s.term_id=p_term
 ), roster as materialized (
  select e.student_id,e.classroom_id,e.started_on,e.ended_on from public.enrollments e
  where e.school_id=v_school and e.academic_year_id=p_year and e.status in ('active','completed')
 ), lessons as materialized (
  select c.id,c.classroom_id,d.day::date as class_date,s.period_no,s.source_offering_id from courses c
  cross join lateral generate_series(c.starts_on::timestamp,least(c.ends_on,v_today)::timestamp,interval '1 day') d(day)
  join slots s on s.course_offering_id=c.id and s.weekday_no=extract(isodow from d.day)::integer
  where c.starts_on is not null and c.ends_on is not null and c.ends_on>=c.starts_on and extract(isodow from d.day) between 1 and 5
 ), expected_pairs as materialized (
  select distinct l.id,e.student_id,l.class_date,l.period_no,l.source_offering_id from lessons l
  join roster e on e.classroom_id=l.classroom_id and (e.started_on is null or e.started_on<=l.class_date) and (e.ended_on is null or e.ended_on>=l.class_date)
 ), recorded as materialized (
  select distinct a.course_offering_id,a.student_id,a.class_date,a.session_no from public.course_attendance_records a
  where a.school_id=v_school and a.class_date<=v_today and a.attendance_status in ('present','absent','late','leave')
   and exists(select 1 from slots s where s.source_offering_id=a.course_offering_id)
 ), totals as (
  select p.id,count(*) as total,count(a.student_id) as done from expected_pairs p
  left join recorded a on a.course_offering_id=p.source_offering_id and a.student_id=p.student_id and a.class_date=p.class_date and a.session_no=p.period_no
  group by p.id
 )
 select c.id,coalesce(t.total,0),coalesce(t.done,0),
  case when c.starts_on is null or c.ends_on is null or c.ends_on<c.starts_on then 'dates'
   when not exists(select 1 from slots s where s.course_offering_id=c.id) then 'slots'
   when c.starts_on>v_today then 'future'
   when coalesce(t.total,0)=0 then 'no-lessons' else null end
 from courses c left join totals t on t.id=c.id;
end $$;
