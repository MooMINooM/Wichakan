-- LINE OA receives the exact averaged mark (e.g. 74.5), not its rounded integer.
CREATE OR REPLACE FUNCTION public.line_parent_portal_data(p_line_user_id text, p_student_id uuid DEFAULT NULL::uuid, p_year uuid DEFAULT NULL::uuid, p_term integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_students jsonb;v_grades jsonb;v_school uuid;v_ready int;v_pending int;
begin
 if auth.role()<>'service_role' or p_line_user_id is null
    or length(p_line_user_id) not between 10 and 255
 then raise exception 'forbidden';end if;

 select coalesce(jsonb_agg(distinct jsonb_build_object(
    'id',s.id,'name',coalesce(s.name_prefix_th,'')||s.first_name_th||' '||s.last_name_th,
    'student_no',s.student_no
 )),'[]'::jsonb)
 into v_students
 from public.line_guardian_accounts a
 join public.student_guardians sg on sg.guardian_id=a.guardian_id and sg.school_id=a.school_id
 join public.students s on s.id=sg.student_id and s.school_id=sg.school_id and s.status='active'
 where a.line_user_id=p_line_user_id;

 if p_student_id is null or p_year is null or p_term is null or p_term not in (1,2) then
   return jsonb_build_object('students',v_students,'grades','[]'::jsonb,'published',false);
 end if;

 select a.school_id into v_school
 from public.line_guardian_accounts a
 join public.student_guardians sg on sg.guardian_id=a.guardian_id and sg.school_id=a.school_id
 join public.students s on s.id=sg.student_id and s.school_id=a.school_id and s.status='active'
 join public.academic_years y on y.id=p_year and y.school_id=a.school_id
 join public.line_grade_publications pub on pub.school_id=a.school_id
    and pub.academic_year_id=y.id and pub.term_no=p_term and pub.published_at is not null
 where a.line_user_id=p_line_user_id and sg.student_id=p_student_id
 limit 1;

 if v_school is null then
   return jsonb_build_object('students',v_students,'grades','[]'::jsonb,'published',false);
 end if;

 select coalesce(jsonb_agg(jsonb_build_object(
   'subject',r.subject,'subject_code',r.subject_code,
   'grade',case when r.state='ready' then r.grade else 'รอผล' end,
   'total',case when r.state='ready'
    then coalesce(pair.exact_total,r.total::numeric) else null end,
   'state',case when r.state='ready' then 'ready' else 'pending' end
 ) order by r.subject_code),'[]'::jsonb),
 count(*) filter(where r.state='ready')::integer,
 count(*) filter(where r.state<>'ready')::integer
 into v_grades,v_ready,v_pending
 from private.line_grade_rows(v_school,p_year,p_term,p_student_id) r
 left join lateral (
  -- A reported primary course may average to x.5; retain that exact score in JSON.
  select (first_half.total+second_half.total)::numeric/2 as exact_total
  from private.line_grade_rows_source(v_school,p_year,p_term,p_student_id) first_half
  join private.line_grade_rows_source(v_school,p_year,p_term,p_student_id) second_half
   on second_half.student_id=first_half.student_id
    and second_half.subject_code=substring(first_half.subject_code from 1 for 3)||'102'
  where r.subject_code ~ '^[พศ]1[1-6]101

 return jsonb_build_object(
  'students',v_students,'grades',v_grades,'published',true,
  'completed_count',v_ready,'pending_count',v_pending
 );
end $function$

   and first_half.student_id=r.student_id and first_half.subject_code=r.subject_code
   and first_half.total is not null and second_half.total is not null
   and first_half.state='ready' and second_half.state='ready'
 ) pair on true;

 return jsonb_build_object(
  'students',v_students,'grades',v_grades,'published',true,
  'completed_count',v_ready,'pending_count',v_pending
 );
end $function$;
