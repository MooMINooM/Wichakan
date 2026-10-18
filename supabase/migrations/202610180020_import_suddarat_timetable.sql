-- Original timetable image page 6: คุณครูสุดดารัตน์ ไทยมา (term 1/2569).
-- Friday 15:00–16:00 P1 is guidance taught by Monthana, not schoolwide ethics.
-- This does not assign the same teacher to P2 and P3 at the same time.
do $$
declare school uuid; term uuid; yr uuid; teacher uuid; admin uuid; item record; offering uuid; room uuid; n integer:=0;
begin
select id into school from public.schools where name_th ilike '%ภูพระโนนผักหวาน%' limit 1;
select t.id,t.academic_year_id into term,yr from public.terms t join public.academic_years y on y.id=t.academic_year_id where t.school_id=school and y.year_be=2569 and t.term_no=1;
select p.user_id into teacher from public.profiles p join public.school_memberships m on m.user_id=p.user_id where m.school_id=school and m.active and p.display_name='คุณครูสุดดารัตน์ ไทยมา';
select user_id into admin from public.school_memberships where school_id=school and active and role='school_admin' order by user_id limit 1;
if school is null or term is null or teacher is null or admin is null then raise exception 'Missing school/term/teacher/admin';end if;
for item in select * from (values (1,1,'ป.4','ส14101'),
(1,2,'ป.5','ส15101'),
(1,3,'ป.5','ส15102'),
(1,5,'ม.2','ส22101'),
(1,6,'ป.6','ส16101'),
(2,2,'ม.1','ส21101'),
(2,3,'ป.6','ส16101'),
(2,5,'ป.5','ส15101'),
(2,6,'ป.4','ส14101'),
(3,1,'ม.1','ส21101'),
(3,5,'ม.3','ส23101'),
(4,2,'ม.3','ส23101'),
(4,3,'ม.2','ส22101'),
(5,2,'ม.1','ส21101'),
(5,3,'ม.3','ส23101'),
(5,5,'ม.2','ส22101')) x(day_no,period_no,grade,code) loop
select o.id,o.classroom_id into offering,room from public.course_offerings o join public.classrooms c on c.id=o.classroom_id join public.subjects s on s.id=o.subject_id where o.term_id=term and c.level_code=item.grade and c.room_code='1' and s.subject_code=item.code;
if offering is null then raise exception 'Missing offering % %',item.grade,item.code;end if;
if not exists(select 1 from public.teaching_assignments where course_offering_id=offering and teacher_user_id=teacher) then raise exception 'Assignment mismatch %',item.code;end if;
if exists(select 1 from public.timetable_slots ts join public.course_offerings o on o.id=ts.course_offering_id where ts.term_id=term and ts.weekday_no=item.day_no and ts.period_no=item.period_no and o.classroom_id=room and ts.course_offering_id<>offering) then raise exception 'Class occupied % %',item.day_no,item.period_no;end if;
if exists(select 1 from public.timetable_slots ts join public.teaching_assignments a on a.course_offering_id=ts.course_offering_id where ts.term_id=term and ts.weekday_no=item.day_no and ts.period_no=item.period_no and a.teacher_user_id=teacher and ts.course_offering_id<>offering) then raise exception 'Teacher occupied';end if;
if exists(select 1 from public.school_activity_schedules a where a.term_id=term and a.classroom_id=room and a.weekday_no=item.day_no and a.period_no=item.period_no) then raise exception 'Activity collision';end if;
insert into public.timetable_slots(school_id,term_id,course_offering_id,weekday_no,period_no,locked,updated_by) values(school,term,offering,item.day_no,item.period_no,true,admin) on conflict(term_id,course_offering_id,weekday_no,period_no) do nothing;
n:=n+1;
end loop;
if n<>16 then raise exception 'Expected 16 course lessons, got %',n;end if;
-- Friday P5 ethics is timetable-only, not a PP6-graded subject.
insert into public.school_activity_schedules(school_id,term_id,classroom_id,activity_type,weekday_no,period_no,teacher_user_id)
select school,term,c.id,'ethics',5,7,teacher from public.classrooms c where c.school_id=school and c.academic_year_id=yr and c.level_code='ป.5' and c.room_code='1'
on conflict(term_id,classroom_id,activity_type,weekday_no,period_no) do update set teacher_user_id=excluded.teacher_user_id;
-- Explicitly preserve guidance P1 from Monthana at Friday period 7.
if not exists(select 1 from public.school_activity_schedules a join public.classrooms c on c.id=a.classroom_id join public.profiles p on p.user_id=a.teacher_user_id
where a.term_id=term and c.level_code='ป.1' and a.weekday_no=5 and a.period_no=7 and a.activity_type='guidance' and p.display_name='คุณครูมัณฑนา บุญประคม')
then raise exception 'P1 Friday guidance assignment missing';end if;
end $$;