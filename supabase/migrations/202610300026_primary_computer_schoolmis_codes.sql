-- SchoolMIS verified export: primary computer uses the science/technology prefix ว.
-- Keep subject UUIDs, offerings, timetable slots, teacher assignments and existing score rows unchanged.
do $migration$
declare
 v_school uuid := '39b470d8-52e8-43d7-9774-4e5d8cf7875f'::uuid;
 v_count integer;
begin
 select count(*) into v_count from public.subjects s where s.school_id=v_school and
 ((s.grade_level='ป.4' and s.subject_code='ง14201' and s.name_th='คอมพิวเตอร์') or
  (s.grade_level='ป.5' and s.subject_code='ง15201' and s.name_th='คอมพิวเตอร์') or
  (s.grade_level='ป.6' and s.subject_code='ง16201' and s.name_th='คอมพิวเตอร์'));
 if v_count<>3 then raise exception 'Expected 3 unchanged primary computer subjects, found %',v_count;end if;
 if exists(select 1 from public.subjects s where s.school_id=v_school and s.subject_code in ('ว14201','ว15201','ว16201'))
 then raise exception 'New SchoolMIS computer code conflicts with existing subject';end if;
 update public.subjects s
 set subject_code=case s.subject_code when 'ง14201' then 'ว14201' when 'ง15201' then 'ว15201' when 'ง16201' then 'ว16201' end
 where s.school_id=v_school and s.name_th='คอมพิวเตอร์'
 and ((s.grade_level='ป.4' and s.subject_code='ง14201')
   or (s.grade_level='ป.5' and s.subject_code='ง15201')
   or (s.grade_level='ป.6' and s.subject_code='ง16201'));
 get diagnostics v_count=row_count;
 if v_count<>3 then raise exception 'Unexpected primary computer subject update count %',v_count;end if;
end $migration$;