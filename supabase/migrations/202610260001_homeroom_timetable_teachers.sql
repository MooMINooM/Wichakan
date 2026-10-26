-- Homeroom teachers need to see teachers assigned to their own classroom
-- to render accurate student schedules. Do not expose other rooms.
create policy "homeroom teachers read own class assignments"
on public.teaching_assignments
for select to authenticated
using (
 private.has_school_role(school_id,array['teacher'])
 and exists (
  select 1 from public.course_offerings o
  join public.homeroom_assignments h
    on h.school_id=o.school_id and h.classroom_id=o.classroom_id
  where o.id=teaching_assignments.course_offering_id
    and o.school_id=teaching_assignments.school_id
    and h.teacher_user_id=auth.uid()
 )
);
