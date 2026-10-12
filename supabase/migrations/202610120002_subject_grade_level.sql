alter table public.subjects add column if not exists grade_level text;
alter table public.subjects drop constraint if exists subjects_grade_level_check;
alter table public.subjects add constraint subjects_grade_level_check
 check (grade_level is null or grade_level in ('ป.1','ป.2','ป.3','ป.4','ป.5','ป.6','ม.1','ม.2','ม.3','ม.4','ม.5','ม.6'));

-- Backfill standard subject codes, without overwriting explicitly chosen grades.
update public.subjects
set grade_level = case substring(subject_code from 2 for 1)
 when '1' then 'ป.' || substring(subject_code from 3 for 1)
 when '2' then 'ม.' || substring(subject_code from 3 for 1)
 when '3' then 'ม.' || (substring(subject_code from 3 for 1)::int + 3)::text
end
where grade_level is null and subject_code ~ '^.[123][1-6][0-9]{3}$';

create or replace function private.verify_course_grade()
returns trigger language plpgsql set search_path=''
as $$
declare v_subject_grade text; v_class_grade text;
begin
 select s.grade_level into v_subject_grade from public.subjects s
 where s.id=new.subject_id and s.school_id=new.school_id;
 select c.level_code into v_class_grade from public.classrooms c
 where c.id=new.classroom_id and c.school_id=new.school_id;
 if v_subject_grade is null then
  raise exception 'Subject grade level must be specified before assigning it';
 end if;
 if v_class_grade is distinct from v_subject_grade then
  raise exception 'Subject grade (%) does not match classroom grade (%)',v_subject_grade,v_class_grade;
 end if;
 return new;
end;
$$;
drop trigger if exists enforce_course_grade on public.course_offerings;
create trigger enforce_course_grade before insert or update of subject_id,classroom_id,school_id
on public.course_offerings for each row execute function private.verify_course_grade();

-- Recheck the grade in the atomic RPC even if an offering already exists.
create or replace function public.assign_teacher_to_subject(
 p_school_id uuid,p_teacher_user_id uuid,p_classroom_id uuid,p_subject_id uuid,p_term_id uuid
) returns uuid language plpgsql security definer set search_path=''
as $$
declare v_offering_id uuid; v_subject_grade text; v_class_grade text;
begin
 if auth.uid() is null or not private.has_school_role(p_school_id,array['school_admin','academic']) then
  raise exception 'Administrator or academic staff access required';
 end if;
 if not exists(select 1 from public.school_memberships where school_id=p_school_id and user_id=p_teacher_user_id and role='teacher' and active) then
  raise exception 'Teacher is not an active member of this school';
 end if;
 select c.level_code into v_class_grade from public.classrooms c
 join public.terms t on t.academic_year_id=c.academic_year_id and t.school_id=c.school_id
 where c.id=p_classroom_id and t.id=p_term_id and c.school_id=p_school_id;
 if v_class_grade is null then raise exception 'Classroom and term must belong to the same school and academic year'; end if;
 select s.grade_level into v_subject_grade from public.subjects s
 where s.id=p_subject_id and s.school_id=p_school_id;
 if v_subject_grade is null or v_subject_grade <> v_class_grade then
  raise exception 'Selected subject is not assigned to the classroom grade';
 end if;
 insert into public.course_offerings(school_id,term_id,classroom_id,subject_id)
 values(p_school_id,p_term_id,p_classroom_id,p_subject_id)
 on conflict(term_id,subject_id,classroom_id) do nothing
 returning id into v_offering_id;
 if v_offering_id is null then
   select id into v_offering_id from public.course_offerings
   where term_id=p_term_id and subject_id=p_subject_id and classroom_id=p_classroom_id and school_id=p_school_id;
 end if;
 if v_offering_id is null then raise exception 'Could not resolve offering'; end if;
 insert into public.teaching_assignments(school_id,course_offering_id,teacher_user_id)
 values(p_school_id,v_offering_id,p_teacher_user_id)
 on conflict(course_offering_id,teacher_user_id) do nothing;
 return v_offering_id;
end;
$$;
