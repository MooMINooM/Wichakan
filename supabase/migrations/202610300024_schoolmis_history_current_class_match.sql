create or replace function public.schoolmis_import_history(
 p_school uuid,p_reference_year_be integer,p_current_level text,p_file_name text,p_rows jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_actor uuid := auth.uid(); v_batch uuid; v_row jsonb; v_student uuid;
 v_count integer:=0; v_skipped integer:=0; v_existing record;
 v_level text; v_grade_no integer; v_current_no integer;
 v_term integer; v_year integer; v_code text; v_key text; v_result text;
 v_value numeric; v_activity boolean; v_name text; v_column integer;
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
  v_code:=v_row->>'subject_code'; v_name:=trim(coalesce(v_row->>'subject_name',''));
  v_result:=trim(coalesce(v_row->>'result_text',''));v_activity:=(v_row->>'is_activity')::boolean;
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
     source_import_id=v_batch,recorded_at=now()
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
   source_column,source_import_id)
  values(p_school,v_student,v_year,v_level,v_term,v_key,v_code,v_name,
   case substring(v_code from 1 for 1)
    when 'ท' then 'ภาษาไทย' when 'ค' then 'คณิตศาสตร์' when 'ว' then 'วิทยาศาสตร์และเทคโนโลยี'
    when 'ส' then 'สังคมศึกษา ศาสนาและวัฒนธรรม' when 'พ' then 'สุขศึกษาและพลศึกษา'
    when 'ศ' then 'ศิลปะ' when 'ง' then 'การงานอาชีพ' when 'อ' then 'ภาษาต่างประเทศ'
    when 'ก' then 'กิจกรรมพัฒนาผู้เรียน' else 'อื่น ๆ' end,
   v_activity,v_result,v_value,v_column,v_batch);
  v_count:=v_count+1;
 end loop;
 update public.schoolmis_history_imports set imported_rows=v_count where id=v_batch;
 return jsonb_build_object('imported',v_count,'unchanged',v_skipped,'batch_id',v_batch);
end $$;
