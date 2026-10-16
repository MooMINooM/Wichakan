create or replace function public.check_subject_semester() returns trigger language plpgsql set search_path='' as $$
begin
 if new.grade_level like 'ม.%' then
  -- Allow editing pre-existing unclassified subjects while Admin is migrating the catalog.
  if new.semester_no not in (1,2)
     and not (tg_op='UPDATE' and old.grade_level like 'ม.%' and old.semester_no is null and new.semester_no is null) then
   raise exception 'มัธยมศึกษาต้องกำหนดภาคเรียนที่ 1 หรือ 2';
  end if;
 elsif new.semester_no is not null then
  raise exception 'ระดับประถมศึกษาเป็นรายปี ไม่กำหนดภาคเรียนประจำรายวิชา';
 end if;
 return new;
end $$;