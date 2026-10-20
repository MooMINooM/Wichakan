-- One transaction for a complete attendance grid; reuse existing per-student authorization.
create function public.save_course_attendance_grid(p_offering uuid,p_rows jsonb)
returns void language plpgsql security invoker set search_path='' as $$
declare v_school uuid;v_term uuid;v_start date;v_end date;v_row jsonb;v_date date;v_period integer;v_status text;
begin
 if auth.uid() is null then raise exception 'No attendance permission';end if;
 if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 10000 then raise exception 'Invalid attendance rows';end if;
 select o.school_id,o.term_id,t.starts_on,t.ends_on into v_school,v_term,v_start,v_end
 from public.course_offerings o join public.terms t on t.id=o.term_id and t.school_id=o.school_id where o.id=p_offering;
 if v_school is null or not exists(select 1 from public.school_memberships m where m.school_id=v_school and m.user_id=auth.uid() and m.active and (m.role in ('school_admin','academic') or (m.role='teacher' and exists(select 1 from public.teaching_assignments a where a.school_id=v_school and a.course_offering_id=p_offering and a.teacher_user_id=auth.uid())))) then raise exception 'No attendance permission';end if;
 if v_start is null or v_end is null then raise exception 'Term dates are required';end if;
 perform pg_advisory_xact_lock(hashtext(v_term::text));
 if exists(select 1 from jsonb_array_elements(p_rows) r group by r->>'student_id',r->>'class_date',(r->>'session_no')::integer having count(*)>1) then raise exception 'Duplicate attendance cells';end if;
 for v_row in select * from jsonb_array_elements(p_rows) loop
  v_date=(v_row->>'class_date')::date;v_period=(v_row->>'session_no')::integer;v_status=v_row->>'attendance_status';
  if v_date is null or v_period is null or v_status is null or v_status not in ('present','absent','late','leave') or v_row->>'student_id' is null then raise exception 'Invalid attendance cell';end if;
  if v_date<v_start or v_date>v_end or v_date>(now() at time zone 'Asia/Bangkok')::date then raise exception 'Date outside term or in the future';end if;
  if extract(isodow from v_date) not between 1 and 5 or not exists(select 1 from public.timetable_slots s where s.school_id=v_school and s.term_id=v_term and s.course_offering_id=p_offering and s.weekday_no=extract(isodow from v_date) and s.period_no=v_period) then raise exception 'Date and period do not match the teaching timetable';end if;
  perform public.save_course_attendance(p_offering,(v_row->>'student_id')::uuid,v_date,v_period,v_status);
 end loop;
end $$;
revoke all on function public.save_course_attendance_grid(uuid,jsonb) from public,anon;
grant execute on function public.save_course_attendance_grid(uuid,jsonb) to authenticated;
