-- Preserve the legacy scoring validation, then project only official reporting subjects.
-- SchoolMIS primary: two separate PP5 books -> one averaged-score grade in PP6 / LINE.
-- Secondary computer remains in teacher scores and PP5, excluded from official publications.
CREATE OR REPLACE FUNCTION private.line_grade_rows_source(p_school uuid, p_year uuid, p_term integer, p_student uuid DEFAULT NULL::uuid)
 RETURNS TABLE(student_id uuid, subject_code text, subject text, total integer, grade text, state text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$

revoke all on function private.line_grade_rows_source(uuid,uuid,integer,uuid) from public,anon,authenticated;
grant execute on function private.line_grade_rows_source(uuid,uuid,integer,uuid) to service_role;
create or replace function private.line_grade_rows(p_school uuid,p_year uuid,p_term integer,p_student uuid default null)
returns table (student_id uuid,subject_code text,subject text,total integer,grade text,state text)
language sql stable security definer set search_path='' as $official$
 with rows as (
  select * from private.line_grade_rows_source(p_school,p_year,p_term,p_student)
 ), paired as (
  select r.*,s.total as companion_total,s.state as companion_state
  from rows r
  left join rows s on s.student_id=r.student_id
    and s.subject_code=substring(r.subject_code from 1 for 3)||'102'
    and r.subject_code ~ '^[พศ]1[1-6]101$'
 ), outcome as (
  select p.*,
   (p.subject_code ~ '^[พศ]1[1-6]101$') as is_primary_pair,
   (p.state='ready' and p.companion_state='ready'
     and p.total is not null and p.companion_total is not null) as pair_ready,
   ((p.total+p.companion_total)::numeric/2.0) as mean_score
  from paired p
 )
 select o.student_id,o.subject_code,
 case when o.is_primary_pair and o.subject_code like 'พ%'
      then 'สุขศึกษาและพลศึกษา '||substring(o.subject_code from 3 for 1)
      when o.is_primary_pair and o.subject_code like 'ศ%'
      then 'ศิลปะ ดนตรี นาฏศิลป์ '||substring(o.subject_code from 3 for 1)
      else o.subject end as subject,
 case when o.is_primary_pair
      then case when o.pair_ready then round(o.mean_score)::integer else null end
      else o.total end as total,
 case when o.is_primary_pair then
      case when not o.pair_ready then '—'
           when p_term=1 then 'ระหว่างปี'
           when o.mean_score>=80 then '4'
           when o.mean_score>=75 then '3.5'
           when o.mean_score>=70 then '3'
           when o.mean_score>=65 then '2.5'
           when o.mean_score>=60 then '2'
           when o.mean_score>=55 then '1.5'
           when o.mean_score>=50 then '1'
           else '0' end
      else o.grade end as grade,
 case when o.is_primary_pair then case when o.pair_ready then 'ready' else 'incomplete' end
      else o.state end as state
 from outcome o
 where o.subject_code !~ '^[พศ]1[1-6]102$'
  and not (o.subject_code ~ '^ง2[1-3]20[12]$' and o.subject ~ 'คอมพิวเตอร์')
$official$;
revoke all on function private.line_grade_rows(uuid,uuid,integer,uuid) from public,anon,authenticated;
grant execute on function private.line_grade_rows(uuid,uuid,integer,uuid) to service_role;
