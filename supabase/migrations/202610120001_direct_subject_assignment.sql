-- One-step teacher assignment. Transactionally open the course and assign its teacher.
create or replace function public.assign_teacher_to_subject(
 p_school_id uuid,
 p_teacher_user_id uuid,
 p_classroom_id uuid,
 p_subject_id uuid,
 p_term_id uuid
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_offering_id uuid;
begin
 if auth.uid() is null or not private.has_school_role(p_school_id,array['school_admin','academic']) then
   raise exception 'Administrator or academic staff access required';
 end if;
 if not exists(select 1 from public.school_memberships where school_id=p_school_id and user_id=p_teacher_user_id and role='teacher' and active) then
   raise exception 'Teacher is not an active member of this school';
 end if;
 if not exists(
  select 1 from public.terms t
  join public.classrooms c on c.academic_year_id=t.academic_year_id and c.school_id=t.school_id
  where t.id=p_term_id and c.id=p_classroom_id and t.school_id=p_school_id
 ) then raise exception 'Term and classroom belong to different academic years or schools'; end if;
 if not exists(select 1 from public.subjects s where s.id=p_subject_id and s.school_id=p_school_id) then
   raise exception 'Subject is not part of this school';
 end if;
 insert into public.course_offerings(school_id,term_id,classroom_id,subject_id)
 values(p_school_id,p_term_id,p_classroom_id,p_subject_id)
 on conflict(term_id,subject_id,classroom_id) do update
 set school_id=excluded.school_id
 returning id into v_offering_id;
 insert into public.teaching_assignments(school_id,course_offering_id,teacher_user_id)
 values(p_school_id,v_offering_id,p_teacher_user_id)
 on conflict(course_offering_id,teacher_user_id) do nothing;
 return v_offering_id;
end;
$$;
revoke all on function public.assign_teacher_to_subject(uuid,uuid,uuid,uuid,uuid) from public,anon;
grant execute on function public.assign_teacher_to_subject(uuid,uuid,uuid,uuid,uuid) to authenticated;
