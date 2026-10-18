-- Teacher page 5: Pimphat Kanhasura, term 1/2569.
-- Primary computing is a timetable-only instructional block. Its assessment
-- remains part of the existing primary science course; no new subjects or
-- course offerings are created, so PP6 does not show an extra grade.
do $$
declare v_school uuid;v_term uuid;v_year uuid;v_teacher uuid;v_actor uuid;v_row record;v_offering uuid;v_room uuid;v_count int:=0;
begin
 select id into v_school from public.schools where name_th ilike '%ภูพระโนนผักหวาน%' limit 1;
 select t.id,t.academic_year_id into v_term,v_year from public.terms t join public.academic_years y on y.id=t.academic_year_id where t.school_id=v_school and y.year_be=2569 and t.term_no=1;
 select p.user_id into v_teacher from public.profiles p join public.school_memberships m on m.user_id=p.user_id where m.school_id=v_school and m.active and p.display_name='คุณครูพิมพ์ภัช กัณหาสุระ';
 select user_id into v_actor from public.school_memberships where school_id=v_school and active and role='school_admin' order by user_id limit 1;
 if v_school is null or v_term is null or v_teacher is null or v_actor is null then raise exception 'Missing teacher, school, term or administrator'; end if;
 for v_row in select * from (values
  (1,2,'ม.3','ว23103'),(1,3,'ป.1','ง11101'),
  (1,7,'ป.1','ง11101'),
  (2,2,'ป.5','ส15201'),(2,6,'ป.3','ง13101'),(2,7,'ป.2','ง12101'),
  (4,1,'ป.4','ง14101'),(4,3,'ม.1','ว21103'),(4,5,'ป.6','ส16201'),(4,6,'ป.5','ง15101'),
  (5,1,'ป.4','พ14101'),(5,6,'ป.6','ง16101')
 ) as x(day_no,period_no,grade,code) loop
   select o.id,o.classroom_id into v_offering,v_room from public.course_offerings o join public.classrooms c on c.id=o.classroom_id join public.subjects s on s.id=o.subject_id where o.term_id=v_term and c.level_code=v_row.grade and c.room_code='1' and s.subject_code=v_row.code;
   if v_offering is null then raise exception 'Missing offering % at %',v_row.code,v_row.grade;end if;
   if not exists(select 1 from public.teaching_assignments where course_offering_id=v_offering and teacher_user_id=v_teacher) then raise exception 'Wrong teacher %',v_row.code;end if;
   if exists(select 1 from public.timetable_slots ts join public.course_offerings o on o.id=ts.course_offering_id where ts.term_id=v_term and ts.weekday_no=v_row.day_no and ts.period_no=v_row.period_no and o.classroom_id=v_room and ts.course_offering_id<>v_offering) then raise exception 'Class collision on %/%',v_row.day_no,v_row.period_no;end if;
   if exists(select 1 from public.timetable_slots ts join public.teaching_assignments a on a.course_offering_id=ts.course_offering_id where ts.term_id=v_term and ts.weekday_no=v_row.day_no and ts.period_no=v_row.period_no and a.teacher_user_id=v_teacher and ts.course_offering_id<>v_offering) then raise exception 'Teacher collision';end if;
   if exists(select 1 from public.school_activity_schedules a where a.term_id=v_term and a.classroom_id=v_room and a.weekday_no=v_row.day_no and a.period_no=v_row.period_no) then raise exception 'Course/activity collision';end if;
   insert into public.timetable_slots(school_id,term_id,course_offering_id,weekday_no,period_no,locked,updated_by) values(v_school,v_term,v_offering,v_row.day_no,v_row.period_no,true,v_actor) on conflict(term_id,course_offering_id,weekday_no,period_no) do nothing;
   v_count:=v_count+1;
 end loop;
 if v_count<>12 then raise exception 'Expected 12 graded-course timetable slots';end if;
 -- Primary computing lessons, shown independently in teacher and classroom
 -- timetables, but never registered as graded course offerings.
 for v_row in select * from (values
  (1,1,'ป.5'),(1,5,'ป.4'),(2,1,'ป.6'),(2,3,'ป.2'),(3,5,'ป.3')
 ) as x(day_no,period_no,grade) loop
   select id into v_room from public.classrooms where school_id=v_school and academic_year_id=v_year and level_code=v_row.grade and room_code='1';
   if v_room is null then raise exception 'Computing room missing %',v_row.grade;end if;
   if exists(select 1 from public.timetable_slots ts join public.course_offerings o on o.id=ts.course_offering_id where ts.term_id=v_term and o.classroom_id=v_room and ts.weekday_no=v_row.day_no and ts.period_no=v_row.period_no) then raise exception 'Computing overlaps course % %',v_row.day_no,v_row.grade;end if;
   if exists(select 1 from public.school_activity_schedules a where a.term_id=v_term and a.classroom_id=v_room and a.weekday_no=v_row.day_no and a.period_no=v_row.period_no and a.activity_type<>'computing') then raise exception 'Computing overlaps existing activity';end if;
   insert into public.school_activity_schedules(school_id,term_id,classroom_id,activity_type,weekday_no,period_no,teacher_user_id) values(v_school,v_term,v_room,'computing',v_row.day_no,v_row.period_no,v_teacher)
   on conflict(term_id,classroom_id,activity_type,weekday_no,period_no) do update set teacher_user_id=excluded.teacher_user_id;
 end loop;
end $$;
comment on table public.school_activity_schedules is 'Timetable-only non-graded instructional blocks (including computing integrated with primary science), guidance, club, scouts and other school activities. An entry here must not generate a separate PP6 grade.';