-- Teacher timetable page 14 correction confirmed by school: P2 science is taught by Arun.
do $$
declare v_offering uuid; v_school uuid; v_term uuid; v_teacher uuid; v_admin uuid; v_room uuid;
begin
 select o.id,o.school_id,o.term_id,o.classroom_id into v_offering,v_school,v_term,v_room
 from public.course_offerings o join public.subjects s on s.id=o.subject_id
 join public.classrooms c on c.id=o.classroom_id join public.terms t on t.id=o.term_id
 join public.academic_years y on y.id=t.academic_year_id
 where y.year_be=2569 and t.term_no=1 and c.level_code='ป.2' and c.room_code='1' and s.subject_code='ว12101';
 select p.user_id into v_teacher from public.profiles p join public.school_memberships m on m.user_id=p.user_id
 where m.school_id=v_school and m.active and p.display_name='คุณครูอรุณ สายอ่อนตา';
 select m.user_id into v_admin from public.school_memberships m
 where m.school_id=v_school and m.active and m.role='school_admin' order by m.user_id limit 1;
 if v_offering is null or v_teacher is null or v_admin is null then raise exception 'Missing course/teacher/admin'; end if;
 if exists(select 1 from public.teaching_assignments a join public.profiles p on p.user_id=a.teacher_user_id
 where a.course_offering_id=v_offering and p.display_name not in ('คุณครูปริฉัตร ไชยอุบล','คุณครูอรุณ สายอ่อนตา'))
 then raise exception 'Unexpected existing teacher'; end if;
 if exists(select 1 from public.timetable_slots ts join public.course_offerings o on o.id=ts.course_offering_id
 where ts.term_id=v_term and ts.weekday_no=3 and ts.period_no=2
 and o.classroom_id=v_room and ts.course_offering_id<>v_offering)
 then raise exception 'Room conflict'; end if;
 if exists(select 1 from public.timetable_slots ts join public.teaching_assignments a on a.course_offering_id=ts.course_offering_id
 where ts.term_id=v_term and ts.weekday_no=3 and ts.period_no=2 and a.teacher_user_id=v_teacher and ts.course_offering_id<>v_offering)
 then raise exception 'Teacher conflict'; end if;
 delete from public.teaching_assignments where course_offering_id=v_offering and teacher_user_id<>v_teacher;
 insert into public.teaching_assignments(school_id,course_offering_id,teacher_user_id) values(v_school,v_offering,v_teacher)
 on conflict(course_offering_id,teacher_user_id) do nothing;
 insert into public.timetable_slots(school_id,term_id,course_offering_id,weekday_no,period_no,locked,updated_by)
 values(v_school,v_term,v_offering,3,2,true,v_admin)
 on conflict(term_id,course_offering_id,weekday_no,period_no) do nothing;
end $$;