-- Historical SchoolMIS grade snapshots. Never modify live teacher scores.
create table if not exists public.schoolmis_history_imports (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id),
 reference_year_be integer not null check (reference_year_be between 2500 and 2700),
 current_level_code text not null check (current_level_code ~ '^[ปม][.][1-6]$'),
 file_name text not null check (length(file_name) between 1 and 240),
 imported_rows integer not null default 0,
 imported_by uuid not null,
 created_at timestamptz not null default now()
);
create index if not exists schoolmis_history_imports_school_idx on public.schoolmis_history_imports(school_id,created_at desc);
create table if not exists public.schoolmis_grade_history (
 school_id uuid not null references public.schools(id),
 student_id uuid not null references public.students(id),
 academic_year_be integer not null check (academic_year_be between 2500 and 2700),
 level_code text not null check (level_code ~ '^[ปม][.][1-6]$'),
 term_no integer not null check (term_no between 0 and 2),
 subject_key text not null,
 subject_code text not null,
 subject_name text not null,
 subject_group text not null,
 is_activity boolean not null default false,
 result_text text not null,
 grade_value numeric(3,1),
 weight_units numeric(6,2) check (weight_units > 0 and weight_units <= 30),
 weight_confirmed boolean not null default false,
 source_column integer not null,
 source_import_id uuid not null references public.schoolmis_history_imports(id),
 recorded_at timestamptz not null default now(),
 primary key (school_id,student_id,academic_year_be,level_code,term_no,subject_key),
 check ((is_activity and grade_value is null and result_text in ('ผ','มผ')) or
   (not is_activity and ((grade_value is not null and result_text=regexp_replace(grade_value::text,'[.]0$','') or
     (grade_value is null and result_text in ('ร','มส'))))),
 check (grade_value is null or (grade_value>=0 and grade_value<=4 and mod(grade_value*2,1)=0)),
 check (is_activity or term_no in (0,1,2))
);
create index if not exists schoolmis_grade_history_student_idx on public.schoolmis_grade_history(school_id,student_id,academic_year_be);
create index if not exists schoolmis_grade_history_weight_idx on public.schoolmis_grade_history(school_id,academic_year_be,level_code,term_no,subject_code);
alter table public.schoolmis_history_imports enable row level security;
alter table public.schoolmis_grade_history enable row level security;
revoke all on public.schoolmis_history_imports from anon,authenticated;
revoke all on public.schoolmis_grade_history from anon,authenticated;
grant select on public.schoolmis_history_imports to authenticated;
grant select on public.schoolmis_grade_history to authenticated;
create policy schoolmis_imports_admin_read on public.schoolmis_history_imports
 for select to authenticated using (exists (
 select 1 from public.school_memberships m where m.school_id=schoolmis_history_imports.school_id
 and m.user_id=(select auth.uid()) and m.active and m.role in ('school_admin','registrar')
 ));
create policy schoolmis_grades_admin_read on public.schoolmis_grade_history
 for select to authenticated using (exists (
 select 1 from public.school_memberships m where m.school_id=schoolmis_grade_history.school_id
 and m.user_id=(select auth.uid()) and m.active and m.role in ('school_admin','registrar')
 ));

-- This RPC performs a single all-or-nothing import. Conflicting historical data are NOT overwritten.
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
   if v_result in ('ร','มส') then v_value:=null;
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
   if v_existing.result_text<>v_result or v_existing.subject_code<>v_code or v_existing.subject_name<>v_name
   then raise exception 'schoolmis_conflict_existing_grade';end if;
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
revoke all on function public.schoolmis_import_history(uuid,integer,text,text,jsonb) from public,anon;
grant execute on function public.schoolmis_import_history(uuid,integer,text,text,jsonb) to authenticated;

-- Historic weights must be verified against the curriculum for THAT year.
create or replace function public.schoolmis_confirm_weight(
 p_school uuid,p_year integer,p_level text,p_term integer,p_subject_code text,p_weight numeric
) returns integer language plpgsql security definer set search_path='' as $$
declare v_count integer;
begin
 if auth.uid() is null or not exists(select 1 from public.school_memberships m
 where m.user_id=auth.uid() and m.school_id=p_school and m.active and m.role in ('school_admin','registrar'))
 then raise exception 'schoolmis_not_authorized';end if;
 if p_weight is null or p_weight<=0 or p_weight>30 then raise exception 'schoolmis_invalid_weight';end if;
 update public.schoolmis_grade_history g set weight_units=p_weight,weight_confirmed=true
 where g.school_id=p_school and g.academic_year_be=p_year and g.level_code=p_level
 and g.term_no=p_term and g.subject_code=p_subject_code and not g.is_activity;
 get diagnostics v_count = row_count;
 return v_count;
end $$;
revoke all on function public.schoolmis_confirm_weight(uuid,integer,text,integer,text,numeric) from public,anon;
grant execute on function public.schoolmis_confirm_weight(uuid,integer,text,integer,text,numeric) to authenticated;

create or replace function public.schoolmis_student_historical_gpax(p_school uuid,p_student uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_data jsonb;
begin
 if auth.uid() is null or not exists (select 1 from public.school_memberships m
 where m.school_id=p_school and m.user_id=auth.uid() and m.active and m.role in ('school_admin','registrar'))
 then raise exception 'schoolmis_not_authorized';end if;
 with area as (
  select coalesce(g.subject_group,'อื่น ๆ') as area, count(*) as records,
   count(*) filter (where g.grade_value is null or not g.weight_confirmed or g.weight_units is null) as pending,
   sum(g.grade_value*g.weight_units) filter (where g.grade_value is not null and g.weight_confirmed) as total_points,
   sum(g.weight_units) filter (where g.grade_value is not null and g.weight_confirmed) as total_weight
  from public.schoolmis_grade_history g where g.school_id=p_school and g.student_id=p_student
    and not g.is_activity group by rollup(g.subject_group)
 )
 select coalesce(jsonb_agg(jsonb_build_object('area',coalesce(area,'รวมทั้งหมด'),
  'records',records,'pending',pending,'gpax',case when records>0 and pending=0 and total_weight>0
  then round(total_points/total_weight,2) else null end)
  order by case when area is null then 1 else 0 end,area),'[]'::jsonb)
 into v_data from area;
 return v_data;
end $$;
revoke all on function public.schoolmis_student_historical_gpax(uuid,uuid) from public,anon;
grant execute on function public.schoolmis_student_historical_gpax(uuid,uuid) to authenticated;
,'')) or
     (grade_value is null and result_text in ('ร','มส'))))),
 check (grade_value is null or (grade_value>=0 and grade_value<=4 and mod(grade_value*2,1)=0)),
 check (is_activity or term_no in (0,1,2))
);
create index if not exists schoolmis_grade_history_student_idx on public.schoolmis_grade_history(school_id,student_id,academic_year_be);
create index if not exists schoolmis_grade_history_weight_idx on public.schoolmis_grade_history(school_id,academic_year_be,level_code,term_no,subject_code);
alter table public.schoolmis_history_imports enable row level security;
alter table public.schoolmis_grade_history enable row level security;
revoke all on public.schoolmis_history_imports from anon,authenticated;
revoke all on public.schoolmis_grade_history from anon,authenticated;
grant select on public.schoolmis_history_imports to authenticated;
grant select on public.schoolmis_grade_history to authenticated;
create policy schoolmis_imports_admin_read on public.schoolmis_history_imports
 for select to authenticated using (exists (
 select 1 from public.school_memberships m where m.school_id=school_id
 and m.user_id=(select auth.uid()) and m.active and m.role in ('school_admin','registrar')
 ));
create policy schoolmis_grades_admin_read on public.schoolmis_grade_history
 for select to authenticated using (exists (
 select 1 from public.school_memberships m where m.school_id=school_id
 and m.user_id=(select auth.uid()) and m.active and m.role in ('school_admin','registrar')
 ));

-- This RPC performs a single all-or-nothing import. Conflicting historical data are NOT overwritten.
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
   if v_result in ('ร','มส') then v_value:=null;
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
  select g.result_text,g.subject_code,g.subject_name into v_existing
   from public.schoolmis_grade_history g where g.school_id=p_school and g.student_id=v_student
   and g.academic_year_be=v_year and g.level_code=v_level and g.term_no=v_term and g.subject_key=v_key;
  if found then
   if v_existing.result_text<>v_result or v_existing.subject_code<>v_code or v_existing.subject_name<>v_name
   then raise exception 'schoolmis_conflict_existing_grade';end if;
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
revoke all on function public.schoolmis_import_history(uuid,integer,text,text,jsonb) from public,anon;
grant execute on function public.schoolmis_import_history(uuid,integer,text,text,jsonb) to authenticated;

-- Historic weights must be verified against the curriculum for THAT year.
create or replace function public.schoolmis_confirm_weight(
 p_school uuid,p_year integer,p_level text,p_term integer,p_subject_code text,p_weight numeric
) returns integer language plpgsql security definer set search_path='' as $$
declare v_count integer;
begin
 if auth.uid() is null or not exists(select 1 from public.school_memberships m
 where m.user_id=auth.uid() and m.school_id=p_school and m.active and m.role in ('school_admin','registrar'))
 then raise exception 'schoolmis_not_authorized';end if;
 if p_weight is null or p_weight<=0 or p_weight>30 then raise exception 'schoolmis_invalid_weight';end if;
 update public.schoolmis_grade_history g set weight_units=p_weight,weight_confirmed=true
 where g.school_id=p_school and g.academic_year_be=p_year and g.level_code=p_level
 and g.term_no=p_term and g.subject_code=p_subject_code and not g.is_activity;
 get diagnostics v_count = row_count;
 return v_count;
end $$;
revoke all on function public.schoolmis_confirm_weight(uuid,integer,text,integer,text,numeric) from public,anon;
grant execute on function public.schoolmis_confirm_weight(uuid,integer,text,integer,text,numeric) to authenticated;

create or replace function public.schoolmis_student_historical_gpax(p_school uuid,p_student uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_data jsonb;
begin
 if auth.uid() is null or not exists (select 1 from public.school_memberships m
 where m.school_id=p_school and m.user_id=auth.uid() and m.active and m.role in ('school_admin','registrar'))
 then raise exception 'schoolmis_not_authorized';end if;
 with area as (
  select coalesce(g.subject_group,'อื่น ๆ') as area, count(*) as records,
   count(*) filter (where g.grade_value is null or not g.weight_confirmed or g.weight_units is null) as pending,
   sum(g.grade_value*g.weight_units) filter (where g.grade_value is not null and g.weight_confirmed) as total_points,
   sum(g.weight_units) filter (where g.grade_value is not null and g.weight_confirmed) as total_weight
  from public.schoolmis_grade_history g where g.school_id=p_school and g.student_id=p_student
    and not g.is_activity group by rollup(g.subject_group)
 )
 select coalesce(jsonb_agg(jsonb_build_object('area',coalesce(area,'รวมทั้งหมด'),
  'records',records,'pending',pending,'gpax',case when records>0 and pending=0 and total_weight>0
  then round(total_points/total_weight,2) else null end)
  order by case when area is null then 1 else 0 end,area),'[]'::jsonb)
 into v_data from area;
 return v_data;
end $$;
revoke all on function public.schoolmis_student_historical_gpax(uuid,uuid) from public,anon;
grant execute on function public.schoolmis_student_historical_gpax(uuid,uuid) to authenticated;
