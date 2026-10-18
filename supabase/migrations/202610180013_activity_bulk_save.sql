-- Save one classroom's activity attendance and assessments atomically.
-- Any invalid row rolls back the entire batch, preventing partial classroom saves.
create or replace function public.save_school_activity_records(
 p_schedule uuid,
 p_date date,
 p_records jsonb
) returns integer
language plpgsql security definer set search_path=''
as $$
declare
 v_item jsonb;
 v_student uuid;
 v_status text;
 v_result text;
 v_seen uuid[] := array[]::uuid[];
 v_count integer := 0;
begin
 if p_records is null or jsonb_typeof(p_records) <> 'array'
    or jsonb_array_length(p_records) > 200 then
   raise exception 'Expected an array of at most 200 student records';
 end if;
 if p_date is null then
   raise exception 'Activity date is required';
 end if;
 for v_item in select value from jsonb_array_elements(p_records)
 loop
   if jsonb_typeof(v_item) <> 'object' or
      not (v_item ? 'student_id') or
      jsonb_typeof(v_item->'student_id') <> 'string' then
     raise exception 'Invalid student record';
   end if;
   v_student := (v_item->>'student_id')::uuid;
   if v_student = any(v_seen) then
     raise exception 'Duplicate student in activity batch';
   end if;
   v_seen := array_append(v_seen,v_student);
   v_status := nullif(v_item->>'status','');
   v_result := nullif(v_item->>'result','');
   if v_status is null and v_result is null then
     raise exception 'Activity row must contain attendance or assessment';
   end if;
   perform public.save_school_activity_record(
     p_schedule,v_student,p_date,v_status,v_result,null
   );
   v_count := v_count + 1;
 end loop;
 return v_count;
end;
$$;
revoke all on function public.save_school_activity_records(uuid,date,jsonb) from public,anon;
grant execute on function public.save_school_activity_records(uuid,date,jsonb) to authenticated;
