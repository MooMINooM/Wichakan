-- SchoolMIS official result reconciliation. 2026-10-30.
-- Explicit school instruction: trust the numeric zero recorded in SchoolMIS as the final grade.
-- Retain the exact source_raw_value and source_import_id; do not touch current-year teacher scores.
create table if not exists public.schoolmis_grade_decision_audit(
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id),
 student_id uuid not null,
 academic_year_be integer not null,
 level_code text not null,
 term_no integer not null,
 subject_key text not null,
 subject_code text not null,
 source_import_id uuid not null references public.schoolmis_history_imports(id),
 old_result_text text not null,
 old_grade_value numeric,
 new_result_text text not null,
 new_grade_value numeric,
 decision_basis text not null,
 decided_at timestamptz not null default now(),
 foreign key(student_id,school_id) references public.students(id,school_id)
);
create index if not exists schoolmis_grade_decision_audit_school_idx
 on public.schoolmis_grade_decision_audit(school_id,academic_year_be,student_id,decided_at);
alter table public.schoolmis_grade_decision_audit enable row level security;
revoke all on public.schoolmis_grade_decision_audit from anon,authenticated;
grant select on public.schoolmis_grade_decision_audit to authenticated;
create policy schoolmis_grade_decision_admin_read on public.schoolmis_grade_decision_audit
 for select to authenticated using(
 exists(select 1 from public.school_memberships m
 where m.school_id=schoolmis_grade_decision_audit.school_id
  and m.user_id=(select auth.uid()) and m.active
  and m.role in ('school_admin','registrar'))
);
do $finalize_zeros$
declare
 v_school uuid;
 v_count integer;
 v_audited integer;
 v_updated integer;
 v_live_before integer;
 v_hist_before integer;
begin
 select i.school_id into strict v_school
 from public.schoolmis_history_imports i where i.reference_year_be=2569
  and i.current_level_code='ม.3' and i.file_name='คะแนน_ชั้นมัธยมศึกษาปีที่ 3  ห้อง 1.csv'
  and i.imported_rows=1408;
 select count(*) into v_live_before from public.student_course_scores where school_id=v_school;
 select count(*) into v_hist_before from public.schoolmis_grade_history where school_id=v_school;
 select count(*) into v_count from public.schoolmis_grade_history g
 join public.schoolmis_history_imports i on i.id=g.source_import_id
 where g.school_id=v_school and i.reference_year_be=2569 and i.current_level_code='ม.3'
  and g.academic_year_be in (2567,2568) and g.level_code in ('ม.1','ม.2')
  and not g.is_activity and g.source_raw_value='0' and g.result_text=''
  and g.grade_value is null and g.weight_confirmed and g.weight_units>0;
 if v_count<>22 then
   raise exception 'Expected exactly 22 unresolved SchoolMIS numeric-zero results, found %',v_count;
 end if;
 if (select count(distinct g.student_id) from public.schoolmis_grade_history g
  join public.schoolmis_history_imports i on i.id=g.source_import_id
  where g.school_id=v_school and i.current_level_code='ม.3'
    and g.source_raw_value='0' and g.grade_value is null)<>5
 then raise exception 'Expected exactly 5 affected students';end if;
 insert into public.schoolmis_grade_decision_audit(
 school_id,student_id,academic_year_be,level_code,term_no,subject_key,subject_code,
 source_import_id,old_result_text,old_grade_value,new_result_text,new_grade_value,decision_basis
 )
 select g.school_id,g.student_id,g.academic_year_be,g.level_code,g.term_no,g.subject_key,
  g.subject_code,g.source_import_id,g.result_text,g.grade_value,'0',0,
  'SchoolMIS is authoritative: explicitly confirmed in school WICHAKAN conversation on 2026-10-30. Preserve imported numeric grade zero.'
 from public.schoolmis_grade_history g
 join public.schoolmis_history_imports i on i.id=g.source_import_id
 where g.school_id=v_school and i.reference_year_be=2569 and i.current_level_code='ม.3'
  and g.academic_year_be in (2567,2568) and g.level_code in ('ม.1','ม.2')
  and not g.is_activity and g.source_raw_value='0' and g.result_text=''
  and g.grade_value is null and g.weight_confirmed and g.weight_units>0;
 get diagnostics v_audited=row_count;
 update public.schoolmis_grade_history g
 set result_text='0',grade_value=0
 from public.schoolmis_history_imports i
 where g.source_import_id=i.id and g.school_id=v_school
  and i.reference_year_be=2569 and i.current_level_code='ม.3'
  and g.academic_year_be in (2567,2568) and g.level_code in ('ม.1','ม.2')
  and not g.is_activity and g.source_raw_value='0' and g.result_text=''
  and g.grade_value is null and g.weight_confirmed and g.weight_units>0;
 get diagnostics v_updated=row_count;
 if v_audited<>22 or v_updated<>22 then
   raise exception 'Finalized % rows and wrote % audit records, expected 22 each',v_updated,v_audited;
 end if;
 if (select count(*) from public.student_course_scores where school_id=v_school)<>v_live_before
    or (select count(*) from public.schoolmis_grade_history where school_id=v_school)<>v_hist_before
 then raise exception 'Unexpected current-year score count or historical record count change';end if;
end $finalize_zeros$;

-- The importer is consistent with the school's decision for new CSVs.
CREATE OR REPLACE FUNCTION public.schoolmis_import_history(p_school uuid, p_reference_year_be integer, p_current_level text, p_file_name text, p_rows jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_actor uuid := auth.uid(); v_batch uuid; v_row jsonb; v_student uuid;
 v_count integer:=0; v_skipped integer:=0; v_existing record;
 v_level text; v_grade_no integer; v_current_no integer;
 v_term integer; v_year integer; v_code text; v_key text; v_result text;
 v_value numeric; v_activity boolean; v_name text; v_source_name text; v_column integer; v_raw text;
begin
 if v_actor is null or not exists(select 1 from public.school_memberships m where m.user_id=v_actor
 and m.school_id=p_school and m.active and m.role in ('school_admin','registrar'))
 then raise exception 'schoolmis_not_authorized';end if;
 if p_reference_year_be not between 2500 and 2700 or p_current_level !~ '^(ป[.][1-6]|ม[.][1-3])$'
 or p_file_name is null or length(p_file_name) not between 1 and 240
 or jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 5000
 then raise exception 'schoolmis_invalid_request';end if;
 v_current_no := substring(p_current_level from 3)::integer;
 insert into public.schoolmis_history_imports(school_id,reference_year_be,current_level_code,file_name,imported_by)
 values(p_school,p_reference_year_be,p_current_level,p_file_name,v_actor) returning id into v_batch;
 for v_row in select value from jsonb_array_elements(p_rows) loop
  v_code:=v_row->>'subject_code'; v_source_name:=trim(coalesce(v_row->>'subject_name',''));
  v_name:=case
   when v_code='อ21201' and v_source_name='อังกฤษฟัง-พูด1' then 'อังกฤษฟัง-พูด 1'
   when v_code in ('ศ21104','ศ22104','ศ23104') and v_source_name='ดนตรี-นาฎศิลป์' then 'ดนตรี-นาฏศิลป์'
   else v_source_name end;
  v_result:=trim(coalesce(v_row->>'result_text',''));v_raw:=trim(coalesce(v_row->>'source_raw_value',v_result));v_activity:=(v_row->>'is_activity')::boolean;
  -- SchoolMIS is the authoritative historical result: a raw numeric zero is a finalized grade 0.
  -- Accept a legacy preview payload that sent an empty result with source_raw_value='0'.
  if not coalesce(v_activity,false) and v_raw='0' and v_result='' then v_result:='0';end if;
  if v_raw<>v_result then raise exception 'schoolmis_source_value_mismatch';end if;
  v_column:=(v_row->>'source_column')::integer;v_term:=(v_row->>'term_no')::integer;
  v_year:=(v_row->>'academic_year_be')::integer;v_key:=v_row->>'subject_key';
  if v_code is null or v_name='' or length(v_name)>180 or v_column<3 or v_column>250
    or length(v_key) not between 1 and 40 or length(v_code) not between 5 and 10
    or v_code !~ '^.[12][1-6][0-9]{3}$' and not (v_activity and v_code ~ '^ก[12][0-9]{4}$')
  then raise exception 'schoolmis_invalid_subject';end if;
  if v_activity then
   -- Activity columns may reuse identical codes; preserve their column positions.
   v_level:=case when p_current_level like 'ป.%' then 'ป.' else 'ม.' end || (v_row->>'grade_number');
   if v_level !~ '^(ป[.][1-6]|ม[.][1-3])$' then raise exception 'schoolmis_invalid_activity_level';end if;
   if v_key <> 'ACT:'||v_column::text or v_result not in ('ผ','มผ')
   then raise exception 'schoolmis_invalid_activity';end if;
   v_value:=null;
  else
   v_grade_no:=substring(v_code from 3 for 1)::integer;
   v_level:=case when substring(v_code from 2 for 1)='1' then 'ป.' else 'ม.' end || v_grade_no::text;
   if (p_current_level like 'ป.%')<>(v_level like 'ป.%') or v_key<>v_code
   then raise exception 'schoolmis_track_mismatch';end if;
   if v_result in ('ร','มส','') then v_value:=null;
   elsif v_result ~ '^(0|[1-3]([.]5)?|4)$' then v_value:=v_result::numeric;
   else raise exception 'schoolmis_invalid_grade';end if;
  end if;
  v_grade_no:=substring(v_level from 3)::integer;
  if v_grade_no>v_current_no or v_year<>(p_reference_year_be-(v_current_no-v_grade_no))
     or v_year>=p_reference_year_be or v_year<2500
     or (v_level like 'ป.%' and v_term<>0)
     or (v_level like 'ม.%' and v_term not in (1,2))
  then raise exception 'schoolmis_historical_period_mismatch';end if;
  select s.id into v_student from public.students s where s.school_id=p_school
   and s.id=(v_row->>'student_id')::uuid and s.student_no=(v_row->>'student_no');
  if v_student is null then raise exception 'schoolmis_student_match_failed';end if;
  if not exists(
   select 1 from public.enrollments e
   join public.academic_years y on y.id=e.academic_year_id and y.school_id=e.school_id
   join public.classrooms c on c.id=e.classroom_id and c.school_id=e.school_id
   where e.school_id=p_school and e.student_id=v_student and y.year_be=p_reference_year_be
    and c.level_code=p_current_level and e.status in ('active','completed')
  ) then raise exception 'schoolmis_current_class_mismatch';end if;
  select g.result_text,g.subject_code,g.subject_name into v_existing
   from public.schoolmis_grade_history g where g.school_id=p_school and g.student_id=v_student
   and g.academic_year_be=v_year and g.level_code=v_level and g.term_no=v_term and g.subject_key=v_key;
  if found then
   if v_existing.subject_code<>v_code or v_existing.subject_name<>v_name then
    raise exception 'schoolmis_conflict_existing_subject';end if;
   -- Filling a previously missing grade is allowed and traced by the new batch.
   if v_existing.result_text='' and v_result<>'' then
    update public.schoolmis_grade_history g set result_text=v_result,grade_value=v_value,
     source_import_id=v_batch,source_raw_value=v_raw,source_subject_name=v_source_name,recorded_at=now()
    where g.school_id=p_school and g.student_id=v_student and g.academic_year_be=v_year
      and g.level_code=v_level and g.term_no=v_term and g.subject_key=v_key;
    v_count:=v_count+1;continue;
   end if;
   -- A blank later export never erases a previously recorded grade.
   if v_existing.result_text<>v_result and v_result<>'' then
    raise exception 'schoolmis_conflict_existing_grade';end if;
   v_skipped:=v_skipped+1;
   continue;
  end if;
  insert into public.schoolmis_grade_history(school_id,student_id,academic_year_be,level_code,
   term_no,subject_key,subject_code,subject_name,subject_group,is_activity,result_text,grade_value,
   source_column,source_import_id,source_raw_value,source_subject_name)
  values(p_school,v_student,v_year,v_level,v_term,v_key,v_code,v_name,
   case substring(v_code from 1 for 1)
    when 'ท' then 'ภาษาไทย' when 'ค' then 'คณิตศาสตร์' when 'ว' then 'วิทยาศาสตร์และเทคโนโลยี'
    when 'ส' then 'สังคมศึกษา ศาสนาและวัฒนธรรม' when 'พ' then 'สุขศึกษาและพลศึกษา'
    when 'ศ' then 'ศิลปะ' when 'ง' then 'การงานอาชีพ' when 'อ' then 'ภาษาต่างประเทศ'
    when 'ก' then 'กิจกรรมพัฒนาผู้เรียน' else 'อื่น ๆ' end,
   v_activity,v_result,v_value,v_column,v_batch,v_raw,v_source_name);
  v_count:=v_count+1;
 end loop;
 update public.schoolmis_history_imports set imported_rows=v_count where id=v_batch;
 return jsonb_build_object('imported',v_count,'unchanged',v_skipped,'batch_id',v_batch);
end $function$;
