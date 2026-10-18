-- Page 4 of source timetable: คุณครูวิรุฬห์ บงแก้ว, term 1/2569.
-- Confirmed by user: History M3 Tue 14:00 belongs to Wirun, not Suddarat.
-- School homeroom, Wednesday club, Thursday scout, Friday ethics are not ordinary graded courses.
do $$
declare v_school uuid;v_term uuid;v_teacher uuid;v_actor uuid;v_row record;v_offering uuid;v_room uuid;v_history uuid;v_old uuid;v_count int:=0;
begin
 select id into v_school from public.schools where name_th ilike '%ภูพระโนนผักหวาน%' limit 1;
 select t.id into v_term from public.terms t join public.academic_years y on y.id=t.academic_year_id where t.school_id=v_school and y.year_be=2569 and t.term_no=1;
 select p.user_id into v_teacher from public.profiles p join public.school_memberships m on m.user_id=p.user_id where m.school_id=v_school and m.active and p.display_name='คุณครูวิรุฬห์ บงแก้ว';
 select user_id into v_actor from public.school_memberships where school_id=v_school and active and role='school_admin' order by user_id limit 1;
 if v_school is null or v_term is null or v_teacher is null or v_actor is null then raise exception 'School, term, teacher or admin missing';end if;
 select o.id into v_history from public.course_offerings o join public.subjects s on s.id=o.subject_id join public.classrooms c on c.id=o.classroom_id
 where o.term_id=v_term and c.level_code='ม.3' and c.room_code='1' and s.subject_code='ส23102';
 if v_history is null then raise exception 'M3 history offering missing';end if;
 select a.teacher_user_id into v_old from public.teaching_assignments a where a.course_offering_id=v_history and a.teacher_user_id<>v_teacher;
 if v_old is not null and (select p.display_name from public.profiles p where p.user_id=v_old)<>'คุณครูสุดดารัตน์ ไทยมา' then raise exception 'Unexpected prior history teacher';end if;
 delete from public.teaching_assignments where course_offering_id=v_history and teacher_user_id=v_old;
 insert into public.teaching_assignments(school_id,course_offering_id,teacher_user_id) values(v_school,v_history,v_teacher) on conflict(course_offering_id,teacher_user_id) do nothing;
 for v_row in select * from (values (1,1,'ม.2','ว22101'),
(1,3,'ม.1','ว21101'),
(1,5,'ม.3','ว23101'),
(1,7,'ม.3','ส23201'),
(2,1,'ม.1','ว21101'),
(2,3,'ม.2','ว22101'),
(2,6,'ม.3','ส23102'),
(3,3,'ม.3','ว23101'),
(3,6,'ป.1','ส11101'),
(4,6,'ม.2','ว22101'),
(5,1,'ม.2','ส22201'),
(5,2,'ม.3','ว23101'),
(5,3,'ป.1','ส11101'),
(5,6,'ม.1','ว21101')) as x(weekday_no,period_no,level_code,subject_code)
 loop
  select o.id,o.classroom_id into v_offering,v_room from public.course_offerings o join public.classrooms c on c.id=o.classroom_id join public.subjects s on s.id=o.subject_id where o.term_id=v_term and c.level_code=v_row.level_code and c.room_code='1' and s.subject_code=v_row.subject_code;
  if v_offering is null then raise exception 'Offering missing for % %',v_row.level_code,v_row.subject_code;end if;
  if not exists(select 1 from public.teaching_assignments where course_offering_id=v_offering and teacher_user_id=v_teacher) then raise exception 'Teacher mismatch %',v_row.subject_code;end if;
  if exists(select 1 from public.timetable_slots ts join public.course_offerings o on o.id=ts.course_offering_id where ts.term_id=v_term and ts.weekday_no=v_row.weekday_no and ts.period_no=v_row.period_no and o.classroom_id=v_room and ts.course_offering_id<>v_offering) then raise exception 'Class collision day % period %',v_row.weekday_no,v_row.period_no;end if;
  if exists(select 1 from public.timetable_slots ts join public.teaching_assignments a on a.course_offering_id=ts.course_offering_id where ts.term_id=v_term and ts.weekday_no=v_row.weekday_no and ts.period_no=v_row.period_no and a.teacher_user_id=v_teacher and ts.course_offering_id<>v_offering) then raise exception 'Teacher collision';end if;
  if exists(select 1 from public.school_activity_schedules a where a.term_id=v_term and a.classroom_id=v_room and a.weekday_no=v_row.weekday_no and a.period_no=v_row.period_no) then raise exception 'Activity collision';end if;
  insert into public.timetable_slots(school_id,term_id,course_offering_id,weekday_no,period_no,locked,updated_by) values(v_school,v_term,v_offering,v_row.weekday_no,v_row.period_no,true,v_actor)
  on conflict(term_id,course_offering_id,weekday_no,period_no) do nothing;
  v_count:=v_count+1;
 end loop;
 if v_count<>14 then raise exception 'Expected 14 verified lessons';end if;
 insert into public.school_activity_schedules(school_id,term_id,classroom_id,activity_type,weekday_no,period_no,teacher_user_id)
 select v_school,v_term,c.id,x.kind,x.day_no,x.period_no,v_teacher
 from (values('ป.5','sss',3,1),('ม.2','guidance',3,2),('ป.2','sss',5,5)) as x(grade_level,kind,day_no,period_no)
 join public.classrooms c on c.school_id=v_school and c.academic_year_id=(select academic_year_id from public.terms where id=v_term) and c.level_code=x.grade_level and c.room_code='1'
 on conflict(term_id,classroom_id,activity_type,weekday_no,period_no) do update set teacher_user_id=excluded.teacher_user_id;
end $$;