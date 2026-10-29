-- Read-only access for active directors of the same school. Existing write
-- policies are intentionally unchanged.
create policy director_read_scores on public.student_course_scores for select to authenticated
 using(private.has_school_role(school_id,array['director']));
create policy director_read_score_settings on public.subject_score_settings for select to authenticated
 using(private.has_school_role(school_id,array['director']));
create policy director_read_course_assessments on public.course_student_assessments for select to authenticated
 using(private.has_school_role(school_id,array['director']));

-- Summarize actual scheduled attendance up to today in Bangkok. This counts
-- recorded statuses, not presence rates, and consumes the shared integration
-- views so integrated courses use only their selected host periods.
create function public.director_attendance_progress(p_year uuid,p_term uuid)
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
  select distinct s.course_offering_id,s.weekday_no,s.period_no from public.course_attendance_slots s
  where s.school_id=v_school and s.term_id=p_term
 ), lessons as materialized (
  select c.id,d.day::date as class_date,s.period_no from courses c
  cross join lateral generate_series(c.starts_on::timestamp,least(c.ends_on,v_today)::timestamp,interval '1 day') d(day)
  join slots s on s.course_offering_id=c.id and s.weekday_no=extract(isodow from d.day)::integer
  where c.starts_on is not null and c.ends_on is not null and c.ends_on>=c.starts_on and extract(isodow from d.day) between 1 and 5
 ), recorded as materialized (
  select distinct a.course_offering_id,a.student_id,a.class_date,a.session_no
  from public.effective_course_attendance a
  where a.school_id=v_school and a.class_date<=v_today
   and a.attendance_status in ('present','absent','late','leave')
   and exists(select 1 from courses c where c.id=a.course_offering_id)
 )
 select c.id,counts.total,counts.done,
  case when c.starts_on is null or c.ends_on is null or c.ends_on<c.starts_on then 'dates'
   when not exists(select 1 from slots s where s.course_offering_id=c.id) then 'slots'
   when c.starts_on>v_today then 'future'
   when counts.total=0 then 'no-lessons' else null end
 from courses c cross join lateral (
  select count(distinct (e.student_id,l.class_date,l.period_no)) as total,count(distinct (a.student_id,a.class_date,a.session_no)) filter(where a.student_id is not null) as done from lessons l
  join public.enrollments e on e.school_id=v_school and e.classroom_id=c.classroom_id and e.academic_year_id=p_year
   and e.status in ('active','completed') and (e.started_on is null or e.started_on<=l.class_date) and (e.ended_on is null or e.ended_on>=l.class_date)
  left join recorded a on a.course_offering_id=c.id and a.student_id=e.student_id and a.class_date=l.class_date and a.session_no=l.period_no
  where l.id=c.id
 ) counts;
end $$;
revoke all on function public.director_attendance_progress(uuid,uuid) from public,anon;
grant execute on function public.director_attendance_progress(uuid,uuid) to authenticated;
