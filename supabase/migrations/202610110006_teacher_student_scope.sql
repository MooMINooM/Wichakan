-- Teacher reads only students enrolled in an assigned teaching or homeroom classroom.
-- Administrative roles retain their existing school-level access.
create or replace function private.teacher_assigned_classroom(p_school uuid,p_classroom uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
 select exists(
  select 1 from public.school_memberships m
  where m.school_id=p_school and m.user_id=(select auth.uid())
    and m.active and m.role='teacher'
    and (
      exists(select 1 from public.homeroom_assignments h where h.school_id=p_school and h.classroom_id=p_classroom and h.teacher_user_id=m.user_id)
      or exists(select 1 from public.teaching_assignments ta
        join public.course_offerings o on o.id=ta.course_offering_id and o.school_id=ta.school_id
        where ta.school_id=p_school and ta.teacher_user_id=m.user_id and o.classroom_id=p_classroom)
    )
 );
$$;
revoke all on function private.teacher_assigned_classroom(uuid,uuid) from public,anon;
grant execute on function private.teacher_assigned_classroom(uuid,uuid) to authenticated;

drop policy "school staff view enrollments" on public.enrollments;
create policy "authorized staff view enrollments" on public.enrollments for select to authenticated
using (
 private.has_school_role(school_id,array['school_admin','director','academic','registrar'])
 or private.teacher_assigned_classroom(school_id,classroom_id)
);

drop policy "school staff can read students" on public.students;
create policy "authorized staff read students" on public.students for select to authenticated
using (
 private.has_school_role(school_id,array['school_admin','director','academic','registrar'])
 or exists(
  select 1 from public.enrollments e
  where e.school_id=students.school_id and e.student_id=students.id
    and private.teacher_assigned_classroom(e.school_id,e.classroom_id)
 )
);

-- Teacher assignments are also scoped to their own roles; administrators can audit all.
drop policy "staff read subject teaching" on public.teaching_assignments;
create policy "authorized read subject teaching" on public.teaching_assignments for select to authenticated
using (
 private.has_school_role(school_id,array['school_admin','director','academic','registrar'])
 or (teacher_user_id=(select auth.uid()) and private.has_school_role(school_id,array['teacher']))
);
