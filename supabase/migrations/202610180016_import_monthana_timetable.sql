-- Source: teacher timetable page 2, term 1/2569, คุณครูมัณฑนา บุญประคม.
-- Explicit allocation: English P2 = 3 basic + 2 additional; P1 follows 120/80 h year.
-- Source 08:30 homeroom and 12:00 lunch are not course slots.
do $$
declare v_school uuid;v_term uuid;v_teacher uuid;v_actor uuid;v_row record;v_offering uuid;v_room uuid;v_count integer:=0;
begin
 select id into v_school from public.schools where name_th ilike '%ภูพระโนนผักหวาน%' limit 1;
 select t.id into v_term from public.terms t join public.academic_years y on y.id=t.academic_year_id where t.school_id=v_school and y.year_be=2569 and t.term_no=1;
 select p.user_id into v_teacher from public.profiles p join public.school_memberships m on m.user_id=p.user_id where m.school_id=v_school and m.active and p.display_name='คุณครูมัณฑนา บุญประคม';
 select user_id into v_actor from public.school_memberships where school_id=v_school and active and role='school_admin' order by user_id limit 1;
 if v_school is null or v_term is null or v_teacher is null or v_actor is null then raise exception 'Missing school/term/teacher/admin';end if;
 for v_row in select * from (values (1,1,'ป.1','อ11101'),
 (1,2,'ป.1','ท11101'),
 (1,6,'ป.2','อ12101'),
 (2,1,'ป.2','อ12101'),
 (2,3,'ป.1','อ11101'),
 (2,5,'ป.1','ท11101'),
 (3,3,'ป.1','ท11101'),
 (3,5,'ป.1','อ11101'),
 (3,6,'ป.2','อ12101'),
 (4,2,'ป.1','ท11101'),
 (4,3,'ป.2','อ12201'),
 (4,5,'ป.1','อ11201'),
 (5,1,'ป.2','อ12201'),
 (5,5,'ป.1','อ11201'),
 (5,6,'ป.1','ท11101')) as x(weekday_no,period_no,grade_level,subject_code)
 loop
   select o.id,o.classroom_id into v_offering,v_room from public.course_offerings o
   join public.classrooms c on c.id=o.classroom_id
   join public.subjects s on s.id=o.subject_id
   where o.term_id=v_term and c.level_code=v_row.grade_level and c.room_code='1' and s.subject_code=v_row.subject_code;
   if v_offering is null then raise exception 'Offering missing: % %',v_row.grade_level,v_row.subject_code;end if;
   if not exists(select 1 from public.teaching_assignments where course_offering_id=v_offering and teacher_user_id=v_teacher) then raise exception 'Teacher not assigned to %',v_row.subject_code;end if;
   if exists(select 1 from public.timetable_slots ts join public.course_offerings o on o.id=ts.course_offering_id
     where ts.term_id=v_term and ts.weekday_no=v_row.weekday_no and ts.period_no=v_row.period_no and o.classroom_id=v_room and ts.course_offering_id<>v_offering) then raise exception 'Room collision';end if;
   if exists(select 1 from public.timetable_slots ts join public.teaching_assignments a on a.course_offering_id=ts.course_offering_id
     where ts.term_id=v_term and ts.weekday_no=v_row.weekday_no and ts.period_no=v_row.period_no and a.teacher_user_id=v_teacher and ts.course_offering_id<>v_offering) then raise exception 'Teacher collision';end if;
   if exists(select 1 from public.school_activity_schedules a where a.term_id=v_term and a.weekday_no=v_row.weekday_no and a.period_no=v_row.period_no and a.classroom_id=v_room) then raise exception 'Activity collision';end if;
   insert into public.timetable_slots(school_id,term_id,course_offering_id,weekday_no,period_no,locked,updated_by)
   values(v_school,v_term,v_offering,v_row.weekday_no,v_row.period_no,true,v_actor)
   on conflict(term_id,course_offering_id,weekday_no,period_no) do nothing;
   v_count:=v_count+1;
 end loop;
 if v_count<>15 then raise exception 'Expected 15 academic slots';end if;
 -- Non-course records: Wednesday SSS P3, Friday guidance P1.
 insert into public.school_activity_schedules(school_id,term_id,classroom_id,activity_type,weekday_no,period_no,teacher_user_id)
 select v_school,v_term,c.id,x.kind,x.day_no,x.period_no,v_teacher
 from (values('ป.3','sss',3,1),('ป.1','guidance',5,7)) as x(grade_level,kind,day_no,period_no)
 join public.classrooms c on c.school_id=v_school and c.academic_year_id=(select academic_year_id from public.terms where id=v_term) and c.level_code=x.grade_level and c.room_code='1'
 on conflict(term_id,classroom_id,activity_type,weekday_no,period_no) do update set teacher_user_id=excluded.teacher_user_id;
end $$;