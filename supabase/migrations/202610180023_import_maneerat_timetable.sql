-- Imported PDF timetable page 9, Maneerat At-somdee, term 1/2569.
-- English P4/P5/P6: 3 basic periods per week for each grade, no extra additional course periods inferred.
do $$
declare v_school uuid;v_term uuid;v_teacher uuid;v_admin uuid;v_row record;v_offer uuid;v_room uuid;v_count integer:=0;
begin
 select id into v_school from public.schools where name_th ilike '%ภูพระโนนผักหวาน%' limit 1;
 select t.id into v_term from public.terms t join public.academic_years y on y.id=t.academic_year_id where t.school_id=v_school and y.year_be=2569 and t.term_no=1;
 select p.user_id into v_teacher from public.profiles p join public.school_memberships m on m.user_id=p.user_id where m.school_id=v_school and m.active and p.display_name='คุณครูมณีรัตน์ อาจสมดี';
 select user_id into v_admin from public.school_memberships where school_id=v_school and active and role='school_admin' order by user_id limit 1;
 if v_school is null or v_term is null or v_teacher is null or v_admin is null then raise exception 'School, term, teacher or admin missing';end if;
 for v_row in select * from (values (1,1,'ป.6','อ16101'),(1,2,'ป.2','ท12101'),(1,5,'ป.6','อ16101'),(1,6,'ป.4','อ14101'),(2,1,'ป.5','อ15101'),(2,5,'ป.2','ท12101'),(2,6,'ม.1','ส21102'),(2,7,'ม.2','ส22102'),(3,1,'ป.2','ท12101'),(3,3,'ป.6','พ16102'),(3,5,'ป.6','อ16101'),(3,6,'ป.5','พ15102'),(4,2,'ป.2','ท12101'),(4,3,'ป.5','อ15101'),(5,1,'ป.5','อ15101'),(5,2,'ป.4','อ14101'),(5,3,'ป.2','ท12101'),(5,6,'ป.4','อ14101')) as x(day_no,period_no,grade,code)
 loop
 select o.id,o.classroom_id into v_offer,v_room from public.course_offerings o join public.classrooms c on c.id=o.classroom_id join public.subjects s on s.id=o.subject_id where o.term_id=v_term and c.level_code=v_row.grade and c.room_code='1' and s.subject_code=v_row.code;
 if v_offer is null then raise exception 'Missing offering % in %',v_row.code,v_row.grade;end if;
 if not exists(select 1 from public.teaching_assignments a where a.course_offering_id=v_offer and a.teacher_user_id=v_teacher) then raise exception 'Teacher mismatch %',v_row.code;end if;
 if exists(select 1 from public.timetable_slots ts join public.course_offerings o on o.id=ts.course_offering_id where ts.term_id=v_term and ts.weekday_no=v_row.day_no and ts.period_no=v_row.period_no and o.classroom_id=v_room and ts.course_offering_id<>v_offer) then raise exception 'Classroom clash %/% %',v_row.day_no,v_row.period_no,v_row.grade;end if;
 if exists(select 1 from public.timetable_slots ts join public.teaching_assignments a on a.course_offering_id=ts.course_offering_id where ts.term_id=v_term and ts.weekday_no=v_row.day_no and ts.period_no=v_row.period_no and a.teacher_user_id=v_teacher and ts.course_offering_id<>v_offer) then raise exception 'Teacher clash';end if;
 if exists(select 1 from public.school_activity_schedules a where a.term_id=v_term and a.classroom_id=v_room and a.weekday_no=v_row.day_no and a.period_no=v_row.period_no) then raise exception 'Activity clash';end if;
 insert into public.timetable_slots(school_id,term_id,course_offering_id,weekday_no,period_no,locked,updated_by) values(v_school,v_term,v_offer,v_row.day_no,v_row.period_no,true,v_admin) on conflict(term_id,course_offering_id,weekday_no,period_no) do nothing;
 v_count:=v_count+1;
 end loop;
 if v_count<>18 then raise exception 'Expected 18 timetable periods';end if;
end $$;