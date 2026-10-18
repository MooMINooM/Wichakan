-- Page 11 PDF teacher Wutthiphong, academic 2569 term 1.
-- User confirmed M3 Thai basic/additional lessons taught by Wutthiphong.
-- Friday period 7 (M3 career) withheld: reserved schoolwide ethics rule; do not circumvent timetable validation.
do $$
declare v_school uuid;v_term uuid;v_teacher uuid;v_admin uuid;v record;v_offer uuid;v_room uuid;v_previous uuid;n integer:=0;
begin
 select id into v_school from public.schools where name_th ilike '%ภูพระโนนผักหวาน%' limit 1;
 select t.id into v_term from public.terms t join public.academic_years y on y.id=t.academic_year_id where t.school_id=v_school and y.year_be=2569 and t.term_no=1;
 select p.user_id into v_teacher from public.profiles p join public.school_memberships m on m.user_id=p.user_id where m.school_id=v_school and m.active and p.display_name='คุณครูวุฒิพงษ์ เจนสระคู';
 select user_id into v_admin from public.school_memberships where school_id=v_school and active and role='school_admin' order by user_id limit 1;
 if v_school is null or v_term is null or v_teacher is null or v_admin is null then raise exception 'Missing school term teacher or admin';end if;
 -- Correct M3 Thai assignments in the current semester; fail on unexpected teacher.
 for v in select o.id,s.subject_code from public.course_offerings o join public.classrooms c on c.id=o.classroom_id join public.subjects s on s.id=o.subject_id
  where o.term_id=v_term and c.level_code='ม.3' and c.room_code='1' and s.subject_code in ('ท23101','ท23201') loop
  if exists(select 1 from public.teaching_assignments a join public.profiles p on p.user_id=a.teacher_user_id where a.course_offering_id=v.id and p.display_name not in ('คุณครูวิภาพร อุดทา','คุณครูธีรโชติ พันธ์เดช','คุณครูวุฒิพงษ์ เจนสระคู')) then raise exception 'Unexpected teacher for %',v.subject_code;end if;
  delete from public.teaching_assignments where course_offering_id=v.id and teacher_user_id<>v_teacher;
  insert into public.teaching_assignments(school_id,course_offering_id,teacher_user_id) values(v_school,v.id,v_teacher)
   on conflict(course_offering_id,teacher_user_id) do nothing;
 end loop;
 for v in select * from (values (1,2,'ม.2','ท22101'),
(1,3,'ม.3','ท23101'),
(1,6,'ม.1','ง21101'),
(1,7,'ม.2','ท22201'),
(2,2,'ม.3','ท23101'),
(2,3,'ม.1','ท21101'),
(2,5,'ม.3','ท23201'),
(2,6,'ม.2','พ22101'),
(3,1,'ม.2','ท22101'),
(3,2,'ป.4','พ14102'),
(3,6,'ม.1','พ21101'),
(4,2,'ม.1','ท21101'),
(4,5,'ม.1','ท21201'),
(4,6,'ม.3','ท23101'),
(5,1,'ม.1','ท21101'),
(5,3,'ม.2','ท22101'),
(5,6,'ม.2','ง22101')) x(day_no,period_no,grade,code) loop
  select o.id,o.classroom_id into v_offer,v_room from public.course_offerings o join public.classrooms c on c.id=o.classroom_id join public.subjects s on s.id=o.subject_id where o.term_id=v_term and c.level_code=v.grade and c.room_code='1' and s.subject_code=v.code;
  if v_offer is null then raise exception 'Offering missing % in %',v.code,v.grade;end if;
  if not exists(select 1 from public.teaching_assignments where course_offering_id=v_offer and teacher_user_id=v_teacher) then raise exception 'Teacher not assigned %',v.code;end if;
  if exists(select 1 from public.timetable_slots ts join public.course_offerings o on o.id=ts.course_offering_id where ts.term_id=v_term and ts.weekday_no=v.day_no and ts.period_no=v.period_no and o.classroom_id=v_room and ts.course_offering_id<>v_offer) then raise exception 'Classroom clash %/%',v.day_no,v.period_no;end if;
  if exists(select 1 from public.timetable_slots ts join public.teaching_assignments a on a.course_offering_id=ts.course_offering_id where ts.term_id=v_term and ts.weekday_no=v.day_no and ts.period_no=v.period_no and a.teacher_user_id=v_teacher and ts.course_offering_id<>v_offer) then raise exception 'Teacher clash %/%',v.day_no,v.period_no;end if;
  if exists(select 1 from public.school_activity_schedules ac where ac.term_id=v_term and ac.classroom_id=v_room and ac.weekday_no=v.day_no and ac.period_no=v.period_no) then raise exception 'Activity clash %/%',v.day_no,v.period_no;end if;
  insert into public.timetable_slots(school_id,term_id,course_offering_id,weekday_no,period_no,locked,updated_by)
  values(v_school,v_term,v_offer,v.day_no,v.period_no,true,v_admin) on conflict(term_id,course_offering_id,weekday_no,period_no) do nothing;
  n:=n+1;
 end loop;
 if n<>17 then raise exception 'Expected 17 regular lessons';end if;
end $$;