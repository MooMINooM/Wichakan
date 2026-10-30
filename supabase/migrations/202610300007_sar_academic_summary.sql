-- Read-only school-admin SAR achievement summary based on the same grade validation
-- used by PP5/PP6 and LINE result publication. Never infer missing scores as zero.
create function public.sar_admin_academic_summary(p_year uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_school uuid;v_rows jsonb;
begin
 select y.school_id into v_school from public.academic_years y where y.id=p_year;
 if v_school is null or not exists(select 1 from public.school_memberships m
  where m.school_id=v_school and m.user_id=(select auth.uid()) and m.active and m.role='school_admin')
 then raise exception 'not_authorized';end if;
 with report as (
  select t.term_no,r.student_id,r.subject_code,r.state,r.grade,
   c.level_code,
   case when r.grade ~ '^[0-4](\.[05])?$' and r.state='ready' and r.grade<>'ระหว่างปี'
     then r.grade::numeric else null end as numeric_grade
  from public.terms t
  cross join lateral private.line_grade_rows(v_school,p_year,t.term_no,null) r
  join public.enrollments e on e.student_id=r.student_id and e.academic_year_id=p_year and e.school_id=v_school
   and e.status in ('active','completed')
  join public.classrooms c on c.id=e.classroom_id and c.school_id=v_school
  where t.academic_year_id=p_year and t.school_id=v_school
    and (c.level_code like 'ม.%' or t.term_no=2)
 ), summary as (
  select level_code,term_no,subject_code,
   count(*)::integer as expected,
   count(*) filter(where numeric_grade is not null)::integer as recorded,
   count(*) filter(where numeric_grade>=3)::integer as grade3plus
  from report group by level_code,term_no,subject_code
 )
 select coalesce(jsonb_agg(jsonb_build_object(
  'level',level_code,'term',term_no,'subject_code',subject_code,
  'expected',expected,'recorded',recorded,'grade3plus',grade3plus,
  'pct_of_recorded',case when recorded=0 then null else round(100.0*grade3plus/recorded,2) end
 ) order by level_code,term_no,subject_code),'[]'::jsonb)
 into v_rows from summary;
 return jsonb_build_object('rows',v_rows,'method','Grades >=3 among finalized grade records; missing/invalid excluded; incomplete explicitly counted','frozen',false);
end $$;
revoke all on function public.sar_admin_academic_summary(uuid) from public,anon;
grant execute on function public.sar_admin_academic_summary(uuid) to authenticated;
