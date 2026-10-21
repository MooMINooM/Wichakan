-- LINE result release: share the exact same grade rules as PP5/PP6, and do not
-- expose missing, duplicate, out-of-range or unfinished results to a parent.
create or replace function private.line_grade_label(p_total integer)
returns text language sql immutable set search_path='' as $$
 select case when p_total is null then '—'
 when p_total>=80 then '4' when p_total>=75 then '3.5' when p_total>=70 then '3'
 when p_total>=65 then '2.5' when p_total>=60 then '2'
 when p_total>=55 then '1.5' when p_total>=50 then '1' else '0' end
$$;
revoke all on function private.line_grade_label(integer) from public,anon,authenticated;
grant execute on function private.line_grade_label(integer) to service_role;

create or replace function private.line_grade_rows(
 p_school uuid,p_year uuid,p_term integer,p_student uuid default null
) returns table(student_id uuid,subject_code text,subject text,total integer,grade text,state text)
 language sql stable security definer set search_path='' as $$
 with roster as (
  select e.student_id,e.classroom_id,c.level_code
  from public.enrollments e
  join public.classrooms c on c.id=e.classroom_id and c.school_id=e.school_id and c.academic_year_id=e.academic_year_id
  join public.students st on st.id=e.student_id and st.school_id=e.school_id and st.status='active'
  where e.school_id=p_school and e.academic_year_id=p_year
    and e.status in ('active','completed')
    and (p_student is null or e.student_id=p_student)
 ),
 expected as (
  select distinct r.student_id,r.classroom_id,r.level_code,s.id as subject_id,
    s.subject_code,s.name_th
  from roster r
  join public.course_offerings o on o.classroom_id=r.classroom_id and o.school_id=p_school
  join public.terms t on t.id=o.term_id and t.school_id=p_school and t.academic_year_id=p_year
  join public.subjects s on s.id=o.subject_id and s.school_id=p_school
    and s.grade_level=r.level_code and s.category in ('basic','additional')
  where (r.level_code not like 'ป.%' or p_term=2 or t.term_no=p_term)
    and (r.level_code like 'ป.%' and p_term=2 or t.term_no=p_term)
 ),
 observations as (
  select e.*,ss.id as setting_id,
    ss.term1_coursework as cap1,ss.term1_midterm as cap2,ss.term1_final as cap3,
    ss.term2_coursework as cap4,ss.term2_midterm as cap5,ss.term2_final as cap6,
    sc.n as recorded,sc.c1,sc.c2,sc.c3,sc.c4,sc.c5,sc.c6,sc.special_result
  from expected e
  left join public.subject_score_settings ss on ss.school_id=p_school
    and ss.academic_year_id=p_year and ss.subject_id=e.subject_id
  left join lateral (
   select count(v.id)::integer as n,
     max(v.term1_coursework) as c1,max(v.term1_midterm) as c2,max(v.term1_final) as c3,
     max(v.term2_coursework) as c4,max(v.term2_midterm) as c5,max(v.term2_final) as c6,
     max(v.special_result) as special_result
   from public.course_offerings o
   join public.terms t on t.id=o.term_id and t.academic_year_id=p_year and t.school_id=p_school
   left join public.student_course_scores v on v.course_offering_id=o.id
     and v.student_id=e.student_id and v.school_id=p_school
   where o.school_id=p_school and o.classroom_id=e.classroom_id and o.subject_id=e.subject_id
    and (e.level_code like 'ป.%' and p_term=2 or t.term_no=p_term)
  ) sc on true
 ),
 validation as (
  select v.*,
   (
    v.setting_id is not null
    and v.cap1>=0 and v.cap2>=0 and v.cap3>=0 and v.cap4>=0 and v.cap5>=0 and v.cap6>=0
    and v.cap1+v.cap2+v.cap3=case when v.level_code like 'ม.%' then 100 else 50 end
    and v.cap4+v.cap5+v.cap6=case when v.level_code like 'ม.%' then 100 else 50 end
    and (v.c1 is null or v.c1 between 0 and v.cap1)
    and (v.c2 is null or v.c2 between 0 and v.cap2)
    and (v.c3 is null or v.c3 between 0 and v.cap3)
    and (v.c4 is null or v.c4 between 0 and v.cap4)
    and (v.c5 is null or v.c5 between 0 and v.cap5)
    and (v.c6 is null or v.c6 between 0 and v.cap6)
   ) as valid_caps,
   (v.c1 is not null and v.c2 is not null and v.c3 is not null) as term1_complete,
   (v.c4 is not null and v.c5 is not null and v.c6 is not null) as term2_complete
  from observations v
 ),
 evaluated as (
  select v.*,
   case when v.recorded=0 then 'missing'
    when v.recorded>1 then 'duplicate'
    when not coalesce(v.valid_caps,false) then 'invalid'
    when v.special_result in ('ร','มส') then 'ready'
    when v.level_code like 'ป.%' and p_term=2 and v.term1_complete and v.term2_complete then 'ready'
    when v.level_code like 'ป.%' and p_term=1 and v.term1_complete then 'ready'
    when v.level_code like 'ม.%' and p_term=1 and v.term1_complete then 'ready'
    when v.level_code like 'ม.%' and p_term=2 and v.term2_complete then 'ready'
    else 'incomplete' end as check_state,
   case when v.level_code like 'ป.%' and p_term=2 then v.c1+v.c2+v.c3+v.c4+v.c5+v.c6
     when p_term=1 then v.c1+v.c2+v.c3
     else v.c4+v.c5+v.c6 end as computed_total
  from validation v
 )
 select v.student_id,v.subject_code,v.name_th,
   case when v.check_state='ready' and v.special_result is null then v.computed_total else null end as total,
   case when v.check_state<>'ready' then '—'
    when v.special_result is not null then v.special_result
    when v.level_code like 'ป.%' and p_term=1 then 'ระหว่างปี'
    else private.line_grade_label(v.computed_total) end as grade,
   v.check_state as state
 from evaluated v
$$;
revoke all on function private.line_grade_rows(uuid,uuid,integer,uuid) from public,anon,authenticated;
grant execute on function private.line_grade_rows(uuid,uuid,integer,uuid) to service_role;

create or replace function public.line_grade_publication_readiness(p_year uuid,p_term integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_school uuid;v_expected integer;v_ready integer;v_missing integer;v_incomplete integer;v_duplicate integer;v_invalid integer;
begin
 select school_id into v_school from public.academic_years where id=p_year;
 if v_school is null or p_term not in (1,2) or not exists(
  select 1 from public.school_memberships m
  where m.school_id=v_school and m.user_id=auth.uid() and m.active and m.role='school_admin'
 ) then raise exception 'not_authorized';end if;
 if not exists(select 1 from public.terms t where t.school_id=v_school and t.academic_year_id=p_year and t.term_no=p_term) then
  return jsonb_build_object('ready',false,'expected',0,'completed',0,'missing',0,'incomplete',0,'duplicate',0,'invalid',0,'reason','term_missing');
 end if;
 select count(*)::integer,count(*) filter(where state='ready')::integer,
    count(*) filter(where state='missing')::integer,
    count(*) filter(where state='incomplete')::integer,
    count(*) filter(where state='duplicate')::integer,
    count(*) filter(where state='invalid')::integer
 into v_expected,v_ready,v_missing,v_incomplete,v_duplicate,v_invalid
 from private.line_grade_rows(v_school,p_year,p_term,null);
 return jsonb_build_object('ready',v_expected>0 and v_expected=v_ready,'expected',v_expected,
    'completed',v_ready,'missing',v_missing,'incomplete',v_incomplete,'duplicate',v_duplicate,'invalid',v_invalid);
end $$;
revoke all on function public.line_grade_publication_readiness(uuid,integer) from public,anon;
grant execute on function public.line_grade_publication_readiness(uuid,integer) to authenticated;

-- Publication cannot bypass readiness simply by invoking the RPC directly.
create or replace function public.set_line_grade_publication(p_year uuid,p_term integer,p_publish boolean)
returns void language plpgsql security definer set search_path='' as $$
declare v_school uuid;v_status jsonb;
begin
 select school_id into v_school from public.academic_years where id=p_year;
 if v_school is null or p_term not in (1,2) or p_publish is null or not exists(
  select 1 from public.school_memberships m
  where m.school_id=v_school and m.user_id=auth.uid() and m.active and m.role='school_admin'
 ) then raise exception 'not_authorized';end if;
 if p_publish then
  v_status=public.line_grade_publication_readiness(p_year,p_term);
  if not coalesce((v_status->>'ready')::boolean,false) then raise exception 'grades_not_ready';end if;
 end if;
 insert into public.line_grade_publications(school_id,academic_year_id,term_no,published_at,published_by)
 values(v_school,p_year,p_term,case when p_publish then now() else null end,auth.uid())
 on conflict(school_id,academic_year_id,term_no)
 do update set published_at=excluded.published_at,published_by=excluded.published_by;
end $$;
revoke all on function public.set_line_grade_publication(uuid,integer,boolean) from public,anon;
grant execute on function public.set_line_grade_publication(uuid,integer,boolean) to authenticated;

-- Keep the verified LINE identity and school/guardian checks at the database boundary.
create or replace function public.line_parent_portal_data(
 p_line_user_id text,p_student_id uuid default null,p_year uuid default null,p_term integer default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_students jsonb;v_grades jsonb;v_school uuid;
begin
 if auth.role()<>'service_role' or p_line_user_id is null or length(p_line_user_id) not between 10 and 255
 then raise exception 'forbidden';end if;
 select coalesce(jsonb_agg(distinct jsonb_build_object(
     'id',s.id,'name',coalesce(s.name_prefix_th,'')||s.first_name_th||' '||s.last_name_th,'student_no',s.student_no
 )),'[]'::jsonb) into v_students
 from public.line_guardian_accounts a
 join public.student_guardians sg on sg.guardian_id=a.guardian_id and sg.school_id=a.school_id
 join public.students s on s.id=sg.student_id and s.school_id=sg.school_id and s.status='active'
 where a.line_user_id=p_line_user_id;
 if p_student_id is null or p_year is null or p_term is null
 then return jsonb_build_object('students',v_students,'grades','[]'::jsonb,'published',false);end if;
 if p_term not in (1,2) then return jsonb_build_object('students',v_students,'grades','[]'::jsonb,'published',false);end if;
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
     'subject',r.subject,'subject_code',r.subject_code,'grade',r.grade,'total',r.total
 ) order by r.subject_code),'[]'::jsonb) into v_grades
 from private.line_grade_rows(v_school,p_year,p_term,p_student_id) r
 where r.state='ready';
 return jsonb_build_object('students',v_students,'grades',v_grades,'published',true);
end $$;
revoke all on function public.line_parent_portal_data(text,uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.line_parent_portal_data(text,uuid,uuid,integer) to service_role;

-- Pure grade-boundary regression assertions, no student data written.
do $$
begin
 if private.line_grade_label(80)<>'4'
 or private.line_grade_label(79)<>'3.5'
 or private.line_grade_label(75)<>'3.5'
 or private.line_grade_label(50)<>'1'
 or private.line_grade_label(49)<>'0'
 then raise exception 'line grade scale regression';end if;
end $$;
