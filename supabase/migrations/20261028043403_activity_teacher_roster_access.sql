-- Activity-only teachers need the roster to assess their assigned activity.
-- Keep this separate from teacher_assigned_classroom, which also controls
-- access to other academic records. No score/attendance write grants change.
create function private.is_activity_teacher(p_school uuid,p_room uuid,p_year uuid)
returns boolean language sql stable security invoker set search_path='' as $$
 select private.has_school_role(p_school,array['teacher']) and exists(
  select 1 from public.school_activity_schedules s
  join public.terms t on t.id=s.term_id and t.school_id=s.school_id
  join public.classrooms c on c.id=s.classroom_id and c.school_id=s.school_id and c.academic_year_id=t.academic_year_id
  where s.school_id=p_school and s.classroom_id=p_room and t.academic_year_id=p_year
   and s.teacher_user_id=auth.uid() and s.activity_type in ('sss','guidance','ethics','club','scout')
 );
$$;
revoke all on function private.is_activity_teacher(uuid,uuid,uuid) from public,anon;
grant execute on function private.is_activity_teacher(uuid,uuid,uuid) to authenticated;

create policy activity_teachers_read_enrollments on public.enrollments
for select to authenticated
using(status in ('active','completed') and private.is_activity_teacher(school_id,classroom_id,academic_year_id));

create policy activity_teachers_read_students on public.students
for select to authenticated
using(exists(select 1 from public.enrollments e
 where e.school_id=students.school_id and e.student_id=students.id and e.status in ('active','completed')
  and private.is_activity_teacher(e.school_id,e.classroom_id,e.academic_year_id)));
