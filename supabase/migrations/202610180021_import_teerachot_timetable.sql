-- Timetable PDF page 7: teacher Teerachot Phandet, academic year 2569, term 1.
-- Thu 14:00 P1 health is omitted pending confirmation: currently assigned to teacher Suchitra.
do $$
declare v_school uuid;v_term uuid;v_year uuid;v_teacher uuid;v_admin uuid;v_row record;v_offering uuid;v_room uuid;v_count integer:=0;
begin
 select id into v_school from public.schools where name_th ilike '%ภูพระโนนผักหวาน%' limit 1;
 select t.id,t.academic_year_id into v_term,v_year from public.terms t join public.academic_years y on y.id=t.academic_year_id where t.school_id=v_school and y.year_be=2569 and t.term_no=1;
 select p.user_id into v_teacher from public.profiles p join public.school_memberships m on m.user_id=p.user_id where m.school_id=v_school and m.active and p.display_name='คุณครูธีรโชติ พันธ์เดช';
 select user_id into v_admin from public.school_memberships where school_id=v_school and active and role='school_admin' order by user_id limit 1;
 if v_school is null or v_term is null or v_teacher is null or v_admin is null then raise exception 'Missing school term teacher or admin';end if;
 for v_row in select * from (values (1,2,'ม.1','อ21101'),
(1,3,'ม.2','อ22101'),
(1,5,'ป.3','ส13101'),
(1,6,'ม.3','อ23101'),
(1,7,'ป.2','ส12101'),
(2,1,'ม.2','อ22101'),
(3,1,'ป.4','ส14201'),
(3,2,'ป.3','ส13101'),
(3,3,'ม.1','อ21101'),
(4,1,'ป.2','พ12101'),
(4,2,'ม.2','อ22101'),
(4,5,'ม.3','อ23101'),
(5,1,'ม.3','อ23101'),
(5,5,'ม.1','อ21101'),
(5,6,'ป.2','ส12101')) as x(day_no,period_no,grade,subject_code) loop
   select o.id,o.classroom_id into v_offering,v_room from public.course_offerings o join public.classrooms c on c.id=o.classroom_id join public.subjects s on s.id=o.subject_id
   where o.term_id=v_term and c.level_code=v_row.grade and c.room_code='1' and s.subject_code=v_row.subject_code;
   if v_offering is null then raise exception 'Missing offering: % %',v_row.grade,v_row.subject_code;end if;
   if not exists(select 1 from public.teaching_assignments where course_offering_id=v_offering and teacher_user_id=v_teacher) then raise exception 'Teacher assignment mismatch %',v_row.subject_code;end if;
   if exists(select 1 from public.timetable_slots ts join public.course_offerings o on o.id=ts.course_offering_id where ts.term_id=v_term and ts.weekday_no=v_row.day_no and ts.period_no=v_row.period_no and o.classroom_id=v_room and ts.course_offering_id<>v_offering) then raise exception 'Class collision % %',v_row.day_no,v_row.period_no;end if;
   if exists(select 1 from public.timetable_slots ts join public.teaching_assignments a on a.course_offering_id=ts.course_offering_id where ts.term_id=v_term and ts.weekday_no=v_row.day_no and ts.period_no=v_row.period_no and a.teacher_user_id=v_teacher and ts.course_offering_id<>v_offering) then raise exception 'Teacher collision % %',v_row.day_no,v_row.period_no;end if;
   if exists(select 1 from public.school_activity_schedules act where act.term_id=v_term and act.classroom_id=v_room and act.weekday_no=v_row.day_no and act.period_no=v_row.period_no) then raise exception 'Activity collision % %',v_row.day_no,v_row.period_no;end if;
   insert into public.timetable_slots(school_id,term_id,course_offering_id,weekday_no,period_no,locked,updated_by)
   values(v_school,v_term,v_offering,v_row.day_no,v_row.period_no,true,v_admin) on conflict(term_id,course_offering_id,weekday_no,period_no) do nothing;
   v_count:=v_count+1;
 end loop;
 if v_count<>15 then raise exception 'Expected 15 lessons but found %',v_count;end if;
 insert into public.school_activity_schedules(school_id,term_id,classroom_id,activity_type,weekday_no,period_no,teacher_user_id)
 select v_school,v_term,c.id,x.type,x.day_no,x.period_no,v_teacher
 from (values('ม.3','guidance',2,3),('ป.1','sss',2,7)) x(grade, type, day_no, period_no)
 join public.classrooms c on c.school_id=v_school and c.academic_year_id=v_year and c.level_code=x.grade and c.room_code='1'
 on conflict(term_id,classroom_id,activity_type,weekday_no,period_no) do update set teacher_user_id=excluded.teacher_user_id;
end $$;