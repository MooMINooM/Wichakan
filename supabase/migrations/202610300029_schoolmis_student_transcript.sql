-- Read-only, permission-checked cumulative transcript across SchoolMIS history and Wichakan.
-- Missing years, uncertain weights and incomplete current scores must NOT become official GPAX.
create or replace function public.schoolmis_student_transcript(p_school uuid,p_student uuid)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare v_result jsonb;
begin
 if auth.uid() is null or not exists(
   select 1 from public.school_memberships m
   where m.school_id=p_school and m.user_id=auth.uid() and m.active
     and m.role in ('school_admin','registrar'))
 then raise exception 'schoolmis_not_authorized';end if;
 if not exists(select 1 from public.students s where s.id=p_student and s.school_id=p_school)
 then raise exception 'schoolmis_student_not_found';end if;
 with current_year as (
   select y.id,y.year_be from public.academic_years y
   where y.school_id=p_school and y.is_active order by y.year_be desc limit 1
 ), current_grade as (
   select c.level_code,cy.year_be,cy.id as year_id
   from public.enrollments e
   join current_year cy on cy.id=e.academic_year_id
   join public.classrooms c on c.id=e.classroom_id and c.school_id=e.school_id
   where e.school_id=p_school and e.student_id=p_student
     and e.status in ('active','completed')
   order by case when e.status='active' then 0 else 1 end
   limit 1
 ), historic as (
   select g.academic_year_be as year_be,g.level_code,g.term_no,g.subject_code,g.subject_name,
      g.subject_group as group_name,g.grade_value,g.result_text,
      g.weight_units,g.weight_confirmed,g.is_activity,
      case when g.is_activity then 'activity'
       when g.grade_value is null then 'missing_result'
       when not g.weight_confirmed or g.weight_units is null then 'missing_weight'
       else 'ready' end as status,
      'SchoolMIS'::text as source,
      i.file_name as provenance
   from public.schoolmis_grade_history g
   join public.schoolmis_history_imports i on i.id=g.source_import_id
   where g.school_id=p_school and g.student_id=p_student
 ), live_source as (
   select l.student_id,l.subject_code,l.subject,l.total,l.grade,l.state,
     cg.year_be,cg.level_code,
     case when cg.level_code like 'ป.%' then 0 else period.term_no end as term_no
   from current_grade cg
   cross join lateral (select case when cg.level_code like 'ป.%' then 2 else 1 end as term_no
     union all select 2 where cg.level_code like 'ม.%') period
   cross join lateral private.line_grade_rows(p_school,cg.year_id,period.term_no,p_student) l
 ), live_enriched as (
   select l.*, subj.learning_hours, subj.category,
      case when l.level_code like 'ป.%' and l.subject_code ~ '^[พศ]1[1-6]101$'
       then subj.learning_hours + coalesce(comp.learning_hours,0)
       else subj.learning_hours end as official_hours,
      case substring(l.subject_code from 1 for 1)
       when 'ท' then 'ภาษาไทย'
       when 'ค' then 'คณิตศาสตร์'
       when 'ว' then 'วิทยาศาสตร์และเทคโนโลยี'
       when 'ส' then 'สังคมศึกษา ศาสนาและวัฒนธรรม'
       when 'พ' then 'สุขศึกษาและพลศึกษา'
       when 'ศ' then 'ศิลปะ'
       when 'ง' then 'การงานอาชีพ'
       when 'อ' then 'ภาษาต่างประเทศ'
       else 'อื่น ๆ' end as group_name
   from live_source l
   left join lateral (
     select s.learning_hours,s.category
     from public.subjects s
     join public.course_offerings o on o.subject_id=s.id and o.school_id=p_school
     join public.classrooms c on c.id=o.classroom_id and c.school_id=p_school
     join public.academic_years y on y.id=c.academic_year_id and y.year_be=l.year_be
     where s.school_id=p_school and s.subject_code=l.subject_code and c.level_code=l.level_code
       and exists(select 1 from public.enrollments e
           where e.school_id=p_school and e.student_id=p_student and e.classroom_id=c.id)
     order by s.id limit 1
   ) subj on true
   left join lateral (
     select s.learning_hours from public.subjects s
     where s.school_id=p_school and s.grade_level=l.level_code
       and s.subject_code=substring(l.subject_code from 1 for 3)||'102'
     limit 1
   ) comp on true
 ), current_records as (
   select l.year_be,l.level_code,l.term_no,l.subject_code,l.subject as subject_name,
     l.group_name,
     case when l.state='ready' and l.grade ~ '^(0|[1-3]([.]5)?|4)$'
       then l.grade::numeric else null end as grade_value,
     l.grade as result_text,
     case when l.category in ('basic','additional') and l.official_hours>0
       then l.official_hours::numeric/40 else null end as weight_units,
     l.official_hours>0 and l.category in ('basic','additional') as weight_confirmed,
     false as is_activity,
     case when l.state='ready' and l.grade ~ '^(0|[1-3]([.]5)?|4)$'
        and l.official_hours>0 and l.category in ('basic','additional') then 'ready'
      when l.state='ready' and l.grade ~ '^(0|[1-3]([.]5)?|4)$' then 'missing_weight'
      else 'missing_result' end as status,
     'WICHAKAN'::text as source,
     null::text as provenance
   from live_enriched l
 ), all_records as (
   select * from historic
   union all
   select * from current_records
   where not exists(select 1 from historic h
     where h.year_be=current_records.year_be
       and h.term_no=current_records.term_no
       and h.subject_code=current_records.subject_code)
 ), graded as (
   select * from all_records where not is_activity
 ), overall as (
   select count(*)::int as subject_count,
     count(*) filter(where status='ready')::int as ready_count,
     count(*) filter(where status<>'ready')::int as pending_count,
     sum(grade_value*weight_units) filter(where status='ready') as weighted,
     sum(weight_units) filter(where status='ready') as weight
   from graded
 ), coverage as (
   select case when cg.level_code like 'ป.%' then
      substring(cg.level_code from 3)::integer
    when cg.level_code like 'ม.%' then substring(cg.level_code from 3)::integer*2
    else 0 end as expected_periods,
    (select count(*)::integer from (
       select distinct year_be,term_no from graded where status='ready'
     ) v) as covered_periods
   from current_grade cg
 ), by_year as (
   select year_be,level_code,term_no,
     count(*)::int as subjects,
     count(*) filter(where status<>'ready')::int as pending,
     case when count(*)>0 and count(*) filter(where status<>'ready')=0
       and sum(weight_units)>0
       then round(sum(grade_value*weight_units)/sum(weight_units),2) else null end as gpa
   from graded group by year_be,level_code,term_no
 ), by_group as (
   select group_name,
     count(*)::int as subjects,
     count(*) filter(where status<>'ready')::int as pending,
     case when count(*)>0 and count(*) filter(where status<>'ready')=0
       and sum(weight_units)>0
       then round(sum(grade_value*weight_units)/sum(weight_units),2) else null end as gpa
   from graded group by group_name
 )
 select jsonb_build_object(
  'rows',coalesce((select jsonb_agg(jsonb_build_object(
     'year_be',r.year_be,'level_code',r.level_code,'term_no',r.term_no,
     'subject_code',r.subject_code,'subject_name',r.subject_name,
     'group_name',r.group_name,'grade',r.result_text,'weight',r.weight_units,
     'weight_confirmed',r.weight_confirmed,'status',r.status,
     'is_activity',r.is_activity,'source',r.source,'provenance',r.provenance)
     order by r.year_be,r.term_no,r.subject_code) from all_records r),'[]'::jsonb),
  'by_year',coalesce((select jsonb_agg(to_jsonb(y) order by y.year_be,y.term_no) from by_year y),'[]'::jsonb),
  'by_group',coalesce((select jsonb_agg(to_jsonb(g) order by g.group_name) from by_group g),'[]'::jsonb),
  'counts',(select to_jsonb(o) from overall o),
  'coverage',(select to_jsonb(c) from coverage c),
  'gpax',(select case
    when o.subject_count>0 and o.pending_count=0 and o.weight>0
      and c.covered_periods=c.expected_periods and c.expected_periods>0
      then round(o.weighted/o.weight,2) else null end
    from overall o cross join coverage c),
  'status',(select case
    when o.subject_count=0 then 'no_data'
    when o.pending_count>0 then 'incomplete_results'
    when c.covered_periods<>c.expected_periods then 'incomplete_history'
    when o.weight is null or o.weight<=0 then 'missing_weights'
    else 'complete' end
    from overall o left join coverage c on true)
 ) into v_result;
 return v_result;
end $fn$;
revoke all on function public.schoolmis_student_transcript(uuid,uuid) from public,anon;
grant execute on function public.schoolmis_student_transcript(uuid,uuid) to authenticated;
