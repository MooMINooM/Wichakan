-- PDF teacher timetable page 15, คุณครูโบราณกุล โบราณ, term 1/2569.
-- 18 graded mathematics lessons; Wed 15:00 club / Thu 15:00 scouts are already schoolwide activities.
do $$
declare v_school uuid;v_term uuid;v_teacher uuid;v_admin uuid;v record;v_offering uuid;v_room uuid;n integer:=0;
begin
select id into v_school from public.schools where name_th ilike '%ภูพระโนนผักหวาน%' limit 1;
select t.id into v_term from public.terms t join public.academic_years y on y.id=t.academic_year_id where t.school_id=v_school and y.year_be=2569 and t.term_no=1;
select p.user_id into v_teacher from public.profiles p join public.school_memberships m on m.user_id=p.user_id where m.school_id=v_school and m.active and p.display_name='คุณครูโบราณกุล โบราณ';
select m.user_id into v_admin from public.school_memberships m where m.school_id=v_school and m.active and m.role='school_admin' order by m.user_id limit 1;
if v_school is null or v_term is null or v_teacher is null or v_admin is null then raise exception 'Missing school, term, teacher or admin';end if;
for v in select * from (values (1,2,'ป.4','ค14101'),(1,3,'ป.3','ค13101'),(1,5,'ป.5','ค15101'),(2,2,'ป.1','ค11101'),(2,3,'ป.4','ค14101'),(2,5,'ป.3','ค13101'),(2,6,'ป.1','ค11101'),(3,1,'ป.1','ค11101'),(3,3,'ป.5','ค15101'),(3,5,'ป.4','ค14101'),(4,1,'ป.3','ค13101'),(4,2,'ป.3','ค13101'),(4,3,'ป.1','ค11101'),(4,5,'ป.5','ค15101'),(5,2,'ป.1','ค11101'),(5,3,'ป.5','ค15101'),(5,5,'ป.4','ค14101'),(5,6,'ป.3','ค13101')) x(day_no,period_no,grade,subject_code) loop
 select o.id,o.classroom_id into v_offering,v_room from public.course_offerings o join public.classrooms c on c.id=o.classroom_id join public.subjects s on s.id=o.subject_id where o.term_id=v_term and c.level_code=v.grade and c.room_code='1' and s.subject_code=v.subject_code;
 if v_offering is null then raise exception 'Course missing %',v.subject_code;end if;
 if not exists(select 1 from public.teaching_assignments where course_offering_id=v_offering and teacher_user_id=v_teacher) then raise exception 'Teacher assignment mismatch %',v.subject_code;end if;
 if exists(select 1 from public.timetable_slots ts join public.course_offerings o on o.id=ts.course_offering_id where ts.term_id=v_term and ts.weekday_no=v.day_no and ts.period_no=v.period_no and o.classroom_id=v_room and ts.course_offering_id<>v_offering) then raise exception 'Class collision';end if;
 if exists(select 1 from public.timetable_slots ts join public.teaching_assignments a on a.course_offering_id=ts.course_offering_id where ts.term_id=v_term and ts.weekday_no=v.day_no and ts.period_no=v.period_no and a.teacher_user_id=v_teacher and ts.course_offering_id<>v_offering) then raise exception 'Teacher collision';end if;
 if exists(select 1 from public.school_activity_schedules act where act.term_id=v_term and act.classroom_id=v_room and act.weekday_no=v.day_no and act.period_no=v.period_no) then raise exception 'Activity collision';end if;
 insert into public.timetable_slots(school_id,term_id,course_offering_id,weekday_no,period_no,locked,updated_by) values(v_school,v_term,v_offering,v.day_no,v.period_no,true,v_admin) on conflict(term_id,course_offering_id,weekday_no,period_no) do nothing;
 n:=n+1;
end loop;
if n<>18 then raise exception 'Expected 18 lessons got %',n;end if;
end $$;