-- Partial LINE grade publication is an explicit school-admin choice.
-- Missing, incomplete, duplicate or invalid results remain private (no scores or grades).
-- Publishing stays on while teachers update scores; parents see newly completed results on refresh.
create or replace function public.set_line_grade_publication(p_year uuid,p_term integer,p_publish boolean)
returns void language plpgsql security definer set search_path='' as $$
declare v_school uuid;
begin
 select y.school_id into v_school from public.academic_years y where y.id=p_year;
 if v_school is null or p_term not in (1,2) or p_publish is null
 or not exists (
  select 1 from public.school_memberships m
   where m.school_id=v_school and m.user_id=auth.uid()
     and m.active and m.role='school_admin'
 ) then raise exception 'not_authorized'; end if;

 -- Readiness is informational, not a precondition. Admin must explicitly confirm
 -- any partial publication in the UI.
 insert into public.line_grade_publications(school_id,academic_year_id,term_no,published_at,published_by)
 values(v_school,p_year,p_term,case when p_publish then now() else null end,auth.uid())
 on conflict(school_id,academic_year_id,term_no)
 do update set published_at=excluded.published_at,published_by=excluded.published_by;
end $$;
revoke all on function public.set_line_grade_publication(uuid,integer,boolean) from public,anon;
grant execute on function public.set_line_grade_publication(uuid,integer,boolean) to authenticated;

-- Routine grade entry, grade correction, or changes to score caps should not
-- turn off an intentional early release. Structural changes can still revoke.
drop trigger if exists line_revoke_scores on public.student_course_scores;
drop trigger if exists line_revoke_settings on public.subject_score_settings;

-- Parent-facing rows: all scheduled subjects are listed; only rows whose
-- calculation is complete and validated reveal totals/grades. Others read "รอผล".
create or replace function public.line_parent_portal_data(
 p_line_user_id text,p_student_id uuid default null,p_year uuid default null,p_term integer default null
) returns jsonb language plpgsql security definer set search_path='' as $$
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
   'total',case when r.state='ready' then r.total else null end,
   'state',case when r.state='ready' then 'ready' else 'pending' end
 ) order by r.subject_code),'[]'::jsonb),
 count(*) filter(where r.state='ready')::integer,
 count(*) filter(where r.state<>'ready')::integer
 into v_grades,v_ready,v_pending
 from private.line_grade_rows(v_school,p_year,p_term,p_student_id) r;

 return jsonb_build_object(
  'students',v_students,'grades',v_grades,'published',true,
  'completed_count',v_ready,'pending_count',v_pending
 );
end $$;
revoke all on function public.line_parent_portal_data(text,uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.line_parent_portal_data(text,uuid,uuid,integer) to service_role;

do $$
begin
 if has_function_privilege('anon','public.set_line_grade_publication(uuid,integer,boolean)','EXECUTE')
 or has_function_privilege('anon','public.line_parent_portal_data(text,uuid,uuid,integer)','EXECUTE')
 or has_function_privilege('authenticated','public.line_parent_portal_data(text,uuid,uuid,integer)','EXECUTE')
 then raise exception 'insecure_LINE_access'; end if;
end $$;
