-- Page 8 original timetable, ครูวิมลดา นาสมยนต์, term 1/2569
do $$
declare v_school uuid;v_term uuid;v_year uuid;v_teacher uuid;v_admin uuid;v record;v_offering uuid;v_room uuid;n int:=0;
begin
select id into v_school from public.schools where name_th ilike '%ภูพระโนนผักหวาน%' limit 1;
select t.id,t.academic_year_id into v_term,v_year from public.terms t join public.academic_years y on y.id=t.academic_year_id where t.school_id=v_school and y.year_be=2569 and t.term_no=1;
select p.user_id into v_teacher from public.profiles p join public.school_memberships m on m.user_id=p.user_id where m.school_id=v_school and m.active and p.display_name='คุณครูวิมลดา นาสมยนต์';
select user_id into v_admin from public.school_memberships where school_id=v_school and active and role='school_admin' order by user_id limit 1;
if v_school is null or v_term is null or v_teacher is null or v_admin is null then raise exception 'Missing timetable import context';end if;
for v in select * from (values (1,1,'ม.3','ศ23101'),(1,3,'ป.2','ศ12101'),(1,5,'ป.1','ศ11101'),(1,7,'ม.1','ศ21101'),(2,2,'ม.2','ศ22101'),(2,5,'ม.1','ศ21102'),(2,6,'ป.6','ศ16102'),(2,7,'ป.4','ศ14102'),(3,6,'ม.2','ศ22102'),(4,1,'ป.5','ศ15101'),(4,3,'ป.6','ศ16101'),(4,5,'ป.4','ศ14101'),(4,6,'ป.4','ส14102'),(5,3,'ป.3','ศ13101'),(5,5,'ป.5','ศ15102'),(5,6,'ม.3','ศ23102')) x(d,p,g,code) loop
 select o.id,o.classroom_id into v_offering,v_room from public.course_offerings o join public.classrooms c on c.id=o.classroom_id join public.subjects s on s.id=o.subject_id where o.term_id=v_term and c.level_code=v.g and c.room_code='1' and s.subject_code=v.code;
 if v_offering is null then raise exception 'Missing offering %',v.code;end if;
 if not exists(select 1 from public.teaching_assignments where course_offering_id=v_offering and teacher_user_id=v_teacher) then raise exception 'Assignment mismatch %',v.code;end if;
 if exists(select 1 from public.timetable_slots ts join public.course_offerings o on o.id=ts.course_offering_id where ts.term_id=v_term and ts.weekday_no=v.d and ts.period_no=v.p and o.classroom_id=v_room and ts.course_offering_id<>v_offering) then raise exception 'Room collision %/%',v.d,v.p;end if;
 if exists(select 1 from public.timetable_slots ts join public.teaching_assignments a on a.course_offering_id=ts.course_offering_id where ts.term_id=v_term and ts.weekday_no=v.d and ts.period_no=v.p and a.teacher_user_id=v_teacher and ts.course_offering_id<>v_offering) then raise exception 'Teacher collision';end if;
 if exists(select 1 from public.school_activity_schedules a where a.term_id=v_term and a.classroom_id=v_room and a.weekday_no=v.d and a.period_no=v.p) then raise exception 'Activity collision';end if;
 insert into public.timetable_slots(school_id,term_id,course_offering_id,weekday_no,period_no,locked,updated_by) values(v_school,v_term,v_offering,v.d,v.p,true,v_admin) on conflict(term_id,course_offering_id,weekday_no,period_no) do nothing;
 n:=n+1;
end loop;
if n<>16 then raise exception 'Wrong number of lessons %',n;end if;
insert into public.school_activity_schedules(school_id,term_id,classroom_id,activity_type,weekday_no,period_no,teacher_user_id)
select v_school,v_term,c.id,x.typ,x.d,x.p,v_teacher
from (values('ป.5','sss',4,2),('ป.3','guidance',5,7)) x(g,typ,d,p)
join public.classrooms c on c.school_id=v_school and c.academic_year_id=v_year and c.level_code=x.g and c.room_code='1'
on conflict(term_id,classroom_id,activity_type,weekday_no,period_no) do update set teacher_user_id=excluded.teacher_user_id;
end $$;