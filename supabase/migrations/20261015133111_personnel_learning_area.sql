-- Optional, non-authorizing profile information. Existing records remain NULL.
alter table public.profiles add column if not exists learning_area text;
do $$ begin
 if not exists(select 1 from pg_constraint where conname='profiles_learning_area_length' and conrelid='public.profiles'::regclass) then
  alter table public.profiles add constraint profiles_learning_area_length
   check (learning_area is null or char_length(learning_area) between 1 and 150);
 end if;
end $$;
comment on column public.profiles.learning_area is 'กลุ่มสาระการเรียนรู้ของบุคลากร ข้อมูลประกอบที่ไม่ใช้กำหนดสิทธิ์';
