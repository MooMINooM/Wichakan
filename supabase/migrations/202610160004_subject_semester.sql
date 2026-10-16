alter table public.subjects add column if not exists semester_no integer check (semester_no in (1,2));
create or replace function public.check_subject_semester() returns trigger language plpgsql set search_path='' as $$
begin
 if new.grade_level like 'ม.%' then
  if new.semester_no not in (1,2) then raise exception 'มัธยมศึกษาต้องกำหนดภาคเรียนที่ 1 หรือ 2';end if;
 elsif new.semester_no is not null then
  raise exception 'ระดับประถมศึกษาเป็นรายปี ไม่กำหนดภาคเรียนประจำรายวิชา';
 end if;
 return new;
end $$;
drop trigger if exists trg_subject_semester on public.subjects;
create trigger trg_subject_semester before insert or update of semester_no,grade_level on public.subjects
for each row execute function public.check_subject_semester();
-- Existing secondary subjects intentionally remain unclassified until Admin verifies them.
create or replace function public.set_subject_semester(p_subject_id uuid,p_semester_no integer)
returns void language plpgsql security definer set search_path='' as $$
declare v_school uuid;v_level text;
begin
 select school_id,grade_level into v_school,v_level from public.subjects where id=p_subject_id for update;
 if not found then raise exception 'ไม่พบรายวิชา';end if;
 if not private.has_school_role(v_school,array['school_admin','academic']) then raise exception 'ไม่มีสิทธิ์แก้ไขรายวิชา';end if;
 if v_level like 'ม.%' and p_semester_no not in (1,2) then raise exception 'มัธยมต้องเลือกภาคเรียนที่ 1 หรือ 2';end if;
 if v_level not like 'ม.%' and p_semester_no is not null then raise exception 'ประถมเป็นรายปี';end if;
 if exists(select 1 from public.course_offerings o join public.terms t on t.id=o.term_id where o.subject_id=p_subject_id and (v_level like 'ม.%' and t.term_no is distinct from p_semester_no)) then
  raise exception 'มีรายการเปิดสอนในภาคเรียนอื่นแล้ว กรุณาจัดการรายการเปิดสอนก่อน';end if;
 update public.subjects set semester_no=p_semester_no where id=p_subject_id;
end $$;
revoke all on function public.set_subject_semester(uuid,integer) from public,anon;
grant execute on function public.set_subject_semester(uuid,integer) to authenticated;
create or replace function public.check_offering_subject_semester() returns trigger language plpgsql set search_path='' as $$
declare v_level text;v_semester integer;v_term integer;
begin
 select grade_level,semester_no into v_level,v_semester from public.subjects where id=new.subject_id and school_id=new.school_id;
 select term_no into v_term from public.terms where id=new.term_id and school_id=new.school_id;
 if v_level like 'ม.%' and (v_semester is null or v_semester<>v_term) then
  raise exception 'รายวิชามัธยมยังไม่กำหนดภาคเรียน หรือภาคเรียนไม่ตรงกับหลักสูตร';
 end if;
 return new;
end $$;
drop trigger if exists trg_offering_subject_semester on public.course_offerings;
create trigger trg_offering_subject_semester before insert or update of subject_id,term_id on public.course_offerings
for each row execute function public.check_offering_subject_semester();
create or replace function public.assign_teacher_to_subject(p_school_id uuid,p_teacher_user_id uuid,p_classroom_id uuid,p_subject_id uuid,p_term_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_offering_id uuid;v_subject_grade text;v_class_grade text;v_semester integer;v_term_no integer;
begin
 if auth.uid() is null or not private.has_school_role(p_school_id,array['school_admin','academic']) then raise exception 'ไม่มีสิทธิ์มอบหมายครู';end if;
 if not exists(select 1 from public.school_memberships where school_id=p_school_id and user_id=p_teacher_user_id and role='teacher' and active) then raise exception 'ครูไม่ได้เปิดใช้งานในโรงเรียน';end if;
 select c.level_code,t.term_no into v_class_grade,v_term_no from public.classrooms c
 join public.terms t on t.academic_year_id=c.academic_year_id and t.school_id=c.school_id
 where c.id=p_classroom_id and t.id=p_term_id and c.school_id=p_school_id;
 if v_class_grade is null then raise exception 'ห้องเรียนและภาคเรียนไม่ตรงกัน';end if;
 select s.grade_level,s.semester_no into v_subject_grade,v_semester from public.subjects s where s.id=p_subject_id and s.school_id=p_school_id;
 if v_subject_grade is null or v_subject_grade<>v_class_grade then raise exception 'ระดับชั้นของรายวิชาไม่ตรงห้อง';end if;
 if v_subject_grade like 'ม.%' and (v_semester is null or v_semester<>v_term_no) then raise exception 'กรุณากำหนดภาคเรียนรายวิชามัธยมให้ตรงก่อนมอบหมายครู';end if;
 insert into public.course_offerings(school_id,term_id,classroom_id,subject_id)
 values(p_school_id,p_term_id,p_classroom_id,p_subject_id)
 on conflict(term_id,subject_id,classroom_id) do nothing returning id into v_offering_id;
 if v_offering_id is null then select id into v_offering_id from public.course_offerings
 where term_id=p_term_id and subject_id=p_subject_id and classroom_id=p_classroom_id and school_id=p_school_id;end if;
 if v_offering_id is null then raise exception 'ไม่สามารถสร้างรายวิชาที่เปิดสอนได้';end if;
 insert into public.teaching_assignments(school_id,course_offering_id,teacher_user_id)
 values(p_school_id,v_offering_id,p_teacher_user_id) on conflict(course_offering_id,teacher_user_id) do nothing;
 return v_offering_id;
end $$;
revoke all on function public.assign_teacher_to_subject(uuid,uuid,uuid,uuid,uuid) from public,anon;
grant execute on function public.assign_teacher_to_subject(uuid,uuid,uuid,uuid,uuid) to authenticated;