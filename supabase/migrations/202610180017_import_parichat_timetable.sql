-- Page 3 of source timetable: คุณครูปริฉัตร ไชยอุบล, term 1/2569.
-- Periods are 09:00=1,10:00=2,11:00=3,lunch=4,13:00=5,14:00=6,15:00=7.
-- Thursday anti-corruption P1 is its own host; no separate citizenship slot.
do $$
declare v_school uuid;v_term uuid;v_teacher uuid;v_actor uuid;v_row record;v_offering uuid;v_room uuid;v_count int:=0;
begin
 select id into v_school from public.schools where name_th ilike '%ภูพระโนนผักหวาน%' limit 1;
 select t.id into v_term from public.terms t join public.academic_years y on y.id=t.academic_year_id where t.school_id=v_school and y.year_be=2569 and t.term_no=1;
 select p.user_id into v_teacher from public.profiles p join public.school_memberships m on m.user_id=p.user_id where m.school_id=v_school and m.active and p.display_name='คุณครูปริฉัตร ไชยอุบล';
 select user_id into v_actor from public.school_memberships where school_id=v_school and active and role='school_admin' order by user_id limit 1;
 if v_school is null or v_term is null or v_teacher is null or v_actor is null then raise exception 'School/term/teacher/admin missing';end if;
 for v_row in select * from (values (1,2,'ศ13102','ป.3'),
 (1,5,'ว21201','ม.1'),
 (1,6,'ว22201','ม.2'),
 (2,1,'ว14101','ป.4'),
 (2,2,'ว14101','ป.4'),
 (2,6,'ว15101','ป.5'),
 (2,7,'ว15101','ป.5'),
 (3,1,'ว16101','ป.6'),
 (3,2,'ว23201','ม.3'),
 (3,5,'ว15101','ป.5'),
 (4,1,'ส11201','ป.1'),
 (4,2,'ว14101','ป.4'),
 (4,6,'ศ12102','ป.2'),
 (5,1,'ศ11102','ป.1'),
 (5,2,'ว16101','ป.6'),
 (5,3,'ว16101','ป.6')) as x(weekday_no,period_no,subject_code,grade_level) loop
   select o.id,o.classroom_id into v_offering,v_room from public.course_offerings o join public.classrooms c on c.id=o.classroom_id join public.subjects s on s.id=o.subject_id
   where o.term_id=v_term and c.level_code=v_row.grade_level and c.room_code='1' and s.subject_code=v_row.subject_code;
   if v_offering is null then raise exception 'Missing course % in %',v_row.subject_code,v_row.grade_level;end if;
   if not exists(select 1 from public.teaching_assignments where course_offering_id=v_offering and teacher_user_id=v_teacher) then raise exception 'Teacher assignment mismatch %',v_row.subject_code;end if;
   if exists(select 1 from public.timetable_slots ts join public.course_offerings o on o.id=ts.course_offering_id where ts.term_id=v_term and ts.weekday_no=v_row.weekday_no and ts.period_no=v_row.period_no and o.classroom_id=v_room and ts.course_offering_id<>v_offering) then raise exception 'Room occupied day % period %',v_row.weekday_no,v_row.period_no;end if;
   if exists(select 1 from public.timetable_slots ts join public.teaching_assignments a on a.course_offering_id=ts.course_offering_id where ts.term_id=v_term and ts.weekday_no=v_row.weekday_no and ts.period_no=v_row.period_no and a.teacher_user_id=v_teacher and ts.course_offering_id<>v_offering) then raise exception 'Teacher occupied';end if;
   insert into public.timetable_slots(school_id,term_id,course_offering_id,weekday_no,period_no,locked,updated_by) values(v_school,v_term,v_offering,v_row.weekday_no,v_row.period_no,true,v_actor) on conflict(term_id,course_offering_id,weekday_no,period_no) do nothing;
   v_count:=v_count+1;
 end loop;
 if v_count<>16 then raise exception 'Expected 16 slots, got %',v_count;end if;
 insert into public.school_activity_schedules(school_id,term_id,classroom_id,activity_type,weekday_no,period_no,teacher_user_id)
 select v_school,v_term,c.id,x.kind,x.day_no,x.period_no,v_teacher
 from (values('ป.6','sss',2,5),('ป.4','guidance',3,3)) as x(grade_level,kind,day_no,period_no)
 join public.classrooms c on c.school_id=v_school and c.academic_year_id=(select academic_year_id from public.terms where id=v_term) and c.level_code=x.grade_level and c.room_code='1'
 on conflict(term_id,classroom_id,activity_type,weekday_no,period_no) do update set teacher_user_id=excluded.teacher_user_id;
end $$;