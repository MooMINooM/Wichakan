create or replace function public.import_dmc_students(
 p_school_id uuid,p_academic_year_id uuid,p_school_code text,p_rows jsonb
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 v_code text; v_row jsonb; v_no text; v_first text; v_last text;
 v_level text;v_room text;v_student uuid;v_classroom uuid;
 v_old public.enrollments%rowtype;
 v_student_record public.students%rowtype;
 v_new_students integer:=0;v_new_rooms integer:=0;v_enrolled integer:=0;
 v_existing integer:=0;v_conflicts integer:=0;v_detail jsonb:='[]'::jsonb;
 v_created boolean;v_line integer;
begin
 if auth.uid() is null or not private.has_school_role(p_school_id,array['school_admin','registrar']) then
  raise exception 'Only registrar or school admin can import DMC';
 end if;
 select code into v_code from public.schools where id=p_school_id;
 if not found then raise exception 'School not found'; end if;
 if nullif(trim(coalesce(v_code,'')),'') is not null and trim(v_code)<>trim(coalesce(p_school_code,'')) then
  raise exception 'DMC school code does not match selected school';
 end if;
 perform 1 from public.academic_years where id=p_academic_year_id and school_id=p_school_id;
 if not found then raise exception 'Academic year does not belong to selected school'; end if;
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)=0 or jsonb_array_length(p_rows)>1000 then
  raise exception 'Provide 1 to 1000 student rows';
 end if;
 for v_row in select value from jsonb_array_elements(p_rows) loop
  v_no=trim(coalesce(v_row->>'student_no',''));
  v_first=trim(coalesce(v_row->>'first_name_th',''));
  v_last=trim(coalesce(v_row->>'last_name_th',''));
  v_level=trim(coalesce(v_row->>'level_code',''));
  v_room=trim(coalesce(v_row->>'room_code',''));
  v_line=coalesce(nullif(v_row->>'row_number','')::int,0);
  if length(v_no) not between 1 and 40 or length(v_first) not between 1 and 120
    or length(v_last) not between 1 and 120 or v_level not in
     ('อ.1','อ.2','อ.3','ป.1','ป.2','ป.3','ป.4','ป.5','ป.6','ม.1','ม.2','ม.3')
    or length(v_room) not between 1 and 12 or v_room !~ '^[[:digit:][:alpha:]ก-๙._/-]+$' then
    raise exception 'Invalid DMC data at row %',v_line;
  end if;
 end loop;
 for v_row in select value from jsonb_array_elements(p_rows) loop
  v_no=trim(v_row->>'student_no');v_first=trim(v_row->>'first_name_th');v_last=trim(v_row->>'last_name_th');
  v_level=trim(v_row->>'level_code');v_room=trim(v_row->>'room_code');
  v_line=coalesce(nullif(v_row->>'row_number','')::int,0);
  select * into v_student_record from public.students where school_id=p_school_id and student_no=v_no for update;
  if found then
   if v_student_record.first_name_th<>v_first or v_student_record.last_name_th<>v_last or v_student_record.status<>'active' then
    v_conflicts=v_conflicts+1;
    v_detail=v_detail||jsonb_build_array(jsonb_build_object('row',v_line,'student_no',v_no,'reason','student_identity_or_status_mismatch'));
    continue;
   end if;
   v_student=v_student_record.id;v_existing=v_existing+1;
  else
   insert into public.students(school_id,student_no,first_name_th,last_name_th)
   values(p_school_id,v_no,v_first,v_last) returning id into v_student;
   v_new_students=v_new_students+1;
  end if;
  select id into v_classroom from public.classrooms
   where school_id=p_school_id and academic_year_id=p_academic_year_id and level_code=v_level
    and (room_code=v_room or room_code=v_level||'/'||v_room)
   order by case when room_code=v_room then 0 else 1 end limit 1;
  if v_classroom is null then
   insert into public.classrooms(school_id,academic_year_id,level_code,room_code)
   values(p_school_id,p_academic_year_id,v_level,v_room)
   on conflict(academic_year_id,level_code,room_code) do nothing
   returning id into v_classroom;
   if v_classroom is not null then v_new_rooms=v_new_rooms+1;
   else
    select id into v_classroom from public.classrooms where academic_year_id=p_academic_year_id and level_code=v_level and room_code=v_room;
   end if;
  end if;
  select * into v_old from public.enrollments where student_id=v_student and academic_year_id=p_academic_year_id for update;
  if found then
   if v_old.classroom_id<>v_classroom or v_old.status not in ('active','completed') then
    v_conflicts=v_conflicts+1;
    v_detail=v_detail||jsonb_build_array(jsonb_build_object('row',v_line,'student_no',v_no,'reason','existing_enrollment_conflict'));
   end if;
  else
   insert into public.enrollments(school_id,student_id,academic_year_id,classroom_id,status)
   values(p_school_id,v_student,p_academic_year_id,v_classroom,'active');
   v_enrolled=v_enrolled+1;
  end if;
  v_classroom=null;
 end loop;
 return jsonb_build_object('new_students',v_new_students,'existing_students',v_existing,
  'new_rooms',v_new_rooms,'new_enrollments',v_enrolled,'conflicts',v_conflicts,'details',v_detail);
end;
$$;
revoke all on function public.import_dmc_students(uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.import_dmc_students(uuid,uuid,text,jsonb) to authenticated;