CREATE OR REPLACE FUNCTION public.save_timetable_slot(p_term_id uuid, p_offering_id uuid, p_weekday integer, p_period integer, p_locked boolean DEFAULT false, p_slot_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_school uuid;v_room uuid;v_slot uuid;v_own_locked boolean;v_conflict text;
begin
 select o.school_id,o.classroom_id into v_school,v_room
 from public.course_offerings o join public.terms t on t.id=o.term_id and t.school_id=o.school_id
 where o.id=p_offering_id and o.term_id=p_term_id;
 if not found then raise exception 'ไม่พบรายวิชาที่เปิดสอนในภาคเรียนนี้';end if;
 if auth.uid() is null or not private.has_school_role(v_school,array['school_admin','academic']) then raise exception 'ไม่มีสิทธิ์จัดตารางสอน';end if;
 if p_weekday not between 1 and 7 or p_period not between 1 and 20 then raise exception 'วันหรือคาบไม่ถูกต้อง';end if;
 perform pg_advisory_xact_lock(hashtext(p_term_id::text));
 if p_slot_id is not null then
 select locked into v_own_locked from public.timetable_slots where id=p_slot_id and school_id=v_school and term_id=p_term_id and course_offering_id=p_offering_id for update;
 if not found then raise exception 'ไม่พบคาบที่จะแก้ไข';end if;
 if v_own_locked and (select (weekday_no,period_no) is distinct from (p_weekday,p_period) from public.timetable_slots where id=p_slot_id) then raise exception 'คาบนี้ถูกล็อก กรุณาปลดล็อกก่อนย้าย';end if;
 end if;
 if exists(select 1 from public.timetable_slots ts join public.course_offerings o on o.id=ts.course_offering_id where ts.term_id=p_term_id and ts.weekday_no=p_weekday and ts.period_no=p_period and o.classroom_id=v_room and (p_slot_id is null or ts.id<>p_slot_id)) then raise exception 'ห้องเรียนมีรายวิชาอื่นในวันและคาบนี้แล้ว';end if;
 if exists(select 1 from public.timetable_slots ts join public.teaching_assignments a on a.course_offering_id=ts.course_offering_id join public.teaching_assignments b on b.course_offering_id=p_offering_id and b.teacher_user_id=a.teacher_user_id where ts.term_id=p_term_id and ts.weekday_no=p_weekday and ts.period_no=p_period and (p_slot_id is null or ts.id<>p_slot_id)) then raise exception 'ครูผู้สอนมีคาบสอนซ้อนในช่วงเวลานี้';end if;
 if exists(select 1 from public.timetable_rules where term_id=p_term_id and kind='school_break' and weekday_no=p_weekday and period_no=p_period) then raise exception 'คาบนี้กำหนดเป็นพักหรือกิจกรรมรวมของโรงเรียน';end if;
 if exists(select 1 from public.timetable_rules r join public.teaching_assignments a on a.course_offering_id=p_offering_id and a.teacher_user_id=r.teacher_user_id where r.term_id=p_term_id and r.kind='teacher_unavailable' and r.weekday_no=p_weekday and r.period_no=p_period) then raise exception 'ครูผู้สอนไม่ว่างในคาบนี้';end if;
 if exists(select 1 from public.timetable_rules r join public.course_offerings o on o.id=p_offering_id and o.subject_id=r.subject_id where r.term_id=p_term_id and r.kind='subject_day_block' and r.weekday_no=p_weekday) then raise exception 'รายวิชาถูกจำกัดไม่ให้สอนในวันนี้';end if;
 if p_slot_id is null then
 insert into public.timetable_slots(school_id,term_id,course_offering_id,weekday_no,period_no,locked,updated_by)
 values(v_school,p_term_id,p_offering_id,p_weekday,p_period,p_locked,auth.uid()) returning id into v_slot;
 else
 update public.timetable_slots set weekday_no=p_weekday,period_no=p_period,locked=p_locked,updated_by=auth.uid(),updated_at=now() where id=p_slot_id returning id into v_slot;
 end if;
 return v_slot;
end $function$
