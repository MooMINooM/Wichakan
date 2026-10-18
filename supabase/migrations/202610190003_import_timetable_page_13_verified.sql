-- Page 13, ครูสุจิตรา วิชัยแสง, term 1/2569. 
-- P3 English five periods are pending basic/additional course split confirmation.
do $$
declare v_school uuid;v_term uuid;v_year uuid;v_teacher uuid;v_admin uuid;v record;v_offer uuid;v_room uuid;n integer:=0;
begin
 select id into v_school from public.schools where name_th ilike '%ภูพระโนนผักหวาน%' limit 1;
 select t.id,t.academic_year_id into v_term,v_year from public.terms t join public.academic_years y on y.id=t.academic_year_id where t.school_id=v_school and y.year_be=2569 and t.term_no=1;
 select p.user_id into v_teacher from public.profiles p join public.school_memberships m on m.user_id=p.user_id where m.school_id=v_school and m.active and p.display_name='คุณครูสุจิตรา วิชัยแสง';
 select user_id into v_admin from public.school_memberships where school_id=v_school and active and role='school_admin' order by user_id limit 1;
 if v_school is null or v_term is null or v_teacher is null or v_admin is null then raise exception 'Missing school term teacher admin';end if;
 for v in select * from (values (1,2,'ป.6','พ16101'),(2,1,'ป.3','พ13101'),(2,6,'ป.2','ส12201'),(2,7,'ป.3','ส13201'),(3,2,'ป.1','พ11102'),(3,3,'ป.2','พ12102'),(3,5,'ม.2','อ22201'),(3,6,'ป.3','พ13102'),(4,1,'ม.3','อ23201'),(4,6,'ม.1','อ21201'),(5,5,'ป.6','ส16102'),(5,6,'ป.5','พ15101')) x(d,p,g,code) loop
  select o.id,o.classroom_id into v_offer,v_room from public.course_offerings o join public.classrooms c on c.id=o.classroom_id join public.subjects s on s.id=o.subject_id where o.term_id=v_term and c.level_code=v.g and c.room_code='1' and s.subject_code=v.code;
  if v_offer is null then raise exception 'Missing offering %',v.code;end if;
  if not exists(select 1 from public.teaching_assignments where course_offering_id=v_offer and teacher_user_id=v_teacher) then raise exception 'Assignment mismatch %',v.code;end if;
  if exists(select 1 from public.timetable_slots ts join public.course_offerings o on o.id=ts.course_offering_id where ts.term_id=v_term and ts.weekday_no=v.d and ts.period_no=v.p and o.classroom_id=v_room and ts.course_offering_id<>v_offer) then raise exception 'Room collision';end if;
  if exists(select 1 from public.timetable_slots ts join public.teaching_assignments a on a.course_offering_id=ts.course_offering_id where ts.term_id=v_term and ts.weekday_no=v.d and ts.period_no=v.p and a.teacher_user_id=v_teacher and ts.course_offering_id<>v_offer) then raise exception 'Teacher collision';end if;
  if exists(select 1 from public.school_activity_schedules ac where ac.term_id=v_term and ac.classroom_id=v_room and ac.weekday_no=v.d and ac.period_no=v.p) then raise exception 'Activity collision';end if;
  insert into public.timetable_slots(school_id,term_id,course_offering_id,weekday_no,period_no,locked,updated_by) values(v_school,v_term,v_offer,v.d,v.p,true,v_admin) on conflict(term_id,course_offering_id,weekday_no,period_no) do nothing;
  n:=n+1;
 end loop;
 if n<>12 then raise exception 'Expected 12 slots';end if;
 insert into public.school_activity_schedules(school_id,term_id,classroom_id,activity_type,weekday_no,period_no,teacher_user_id)
 select v_school,v_term,c.id,'ethics',5,7,v_teacher from public.classrooms c where c.school_id=v_school and c.academic_year_id=v_year and c.level_code='ป.4' and c.room_code='1'
 on conflict(term_id,classroom_id,activity_type,weekday_no,period_no) do update set teacher_user_id=excluded.teacher_user_id;
end $$;