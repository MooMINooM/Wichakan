create or replace function public.save_timetable_proposal(p_term_id uuid,p_expected_ids uuid[],p_lessons jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare v_school uuid;v_current uuid[];v_item jsonb;v_count integer:=0;v_offering uuid;v_day integer;v_period integer;
begin
 select school_id into v_school from public.terms where id=p_term_id;
 if v_school is null or auth.uid() is null or not private.has_school_role(v_school,array['school_admin','academic']) then raise exception 'ไม่มีสิทธิ์ยืนยันตารางสอน';end if;
 if jsonb_typeof(p_lessons) is distinct from 'array' or jsonb_array_length(p_lessons)>300 then raise exception 'รายการคาบไม่ถูกต้องหรือมากเกินไป';end if;
 perform pg_advisory_xact_lock(hashtext(p_term_id::text));
 select coalesce(array_agg(id order by id),array[]::uuid[]) into v_current from public.timetable_slots where term_id=p_term_id;
 if v_current is distinct from coalesce((select array_agg(x order by x) from unnest(p_expected_ids) as x),array[]::uuid[]) then raise exception 'ตารางสอนเปลี่ยนแล้ว กรุณาสร้างข้อเสนอใหม่';end if;
 for v_item in select value from jsonb_array_elements(p_lessons) loop
  v_offering=(v_item->>'course_offering_id')::uuid;v_day=(v_item->>'weekday_no')::integer;v_period=(v_item->>'period_no')::integer;
  if not exists(select 1 from public.course_offerings where id=v_offering and term_id=p_term_id and school_id=v_school) then raise exception 'รายวิชาไม่ตรงภาคเรียน';end if;
  perform public.save_timetable_slot(p_term_id,v_offering,v_day,v_period,false,null);
  v_count=v_count+1;
 end loop;
 return v_count;
end $$;
revoke all on function public.save_timetable_proposal(uuid,uuid[],jsonb) from public,anon;
grant execute on function public.save_timetable_proposal(uuid,uuid[],jsonb) to authenticated;