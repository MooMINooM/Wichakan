-- Source: teacher timetable page 1, term 1/2569 (คุณครูสมยศ บุญประคม).
-- Period numbering follows the seven displayed non-lunch periods:
-- 1 = 09:00, 2 = 10:00, 3 = 11:00, 4 = lunch (blocked),
-- 5 = 13:00, 6 = 14:00, 7 = 15:00. Homeroom is not a course slot.
do $$
declare
 v_school uuid; v_term uuid; v_teacher uuid; v_actor uuid;
 v_target record; v_offering uuid; v_count integer:=0;
begin
 select id into v_school from public.schools where name_th ilike '%ภูพระโนนผักหวาน%' limit 1;
 if v_school is null then raise exception 'Target school missing';end if;
 select t.id into v_term from public.terms t join public.academic_years y on y.id=t.academic_year_id
 where t.school_id=v_school and y.year_be=2569 and t.term_no=1;
 if v_term is null then raise exception 'Term 1/2569 missing';end if;
 select p.user_id into v_teacher from public.profiles p join public.school_memberships m on m.user_id=p.user_id
 where m.school_id=v_school and m.active and p.display_name='คุณครูสมยศ บุญประคม';
 if v_teacher is null then raise exception 'Teacher Somyot not found';end if;
 select user_id into v_actor from public.school_memberships
 where school_id=v_school and active and role='school_admin' order by user_id limit 1;
 if v_actor is null then raise exception 'No importing administrator found';end if;
 -- Verified printed lessons; no duplicated homeroom or lunch.
 for v_target in
 select * from (values
 (1,1,'ป.2','ค12101'),(2,2,'ป.2','ค12101'),
 (3,1,'ม.3','ง23201'),(3,2,'ม.1','พลศึกษา'),(3,3,'ม.2','พลศึกษา'),
 (3,5,'ป.2','ค12101'),(3,6,'ม.3','พลศึกษา'),
 (4,1,'ม.2','ง22201'),(4,5,'ป.2','ค12101'),
 (5,2,'ป.2','ค12101'),(5,3,'ม.1','ง21201')
 ) as x(day_no,period_no,level_code,subject_key)
 loop
   select o.id into v_offering
   from public.course_offerings o
   join public.classrooms c on c.id=o.classroom_id
   join public.subjects s on s.id=o.subject_id
   where o.term_id=v_term and c.level_code=v_target.level_code and c.room_code='1'
    and (s.subject_code=v_target.subject_key or (v_target.subject_key='พลศึกษา' and s.name_th='พลศึกษา'));
   if v_offering is null then raise exception 'Missing offering % %',v_target.level_code,v_target.subject_key;end if;
   if v_target.subject_key in ('ง21201','ง22201','ง23201') then
     insert into public.teaching_assignments(school_id,course_offering_id,teacher_user_id)
     values(v_school,v_offering,v_teacher)
     on conflict(course_offering_id,teacher_user_id) do nothing;
   end if;
   if not exists(select 1 from public.teaching_assignments where course_offering_id=v_offering and teacher_user_id=v_teacher) then
    raise exception 'Teacher assignment mismatch for %',v_target.subject_key;
   end if;
   if exists(select 1 from public.timetable_slots ts join public.course_offerings o on o.id=ts.course_offering_id
    where ts.term_id=v_term and ts.weekday_no=v_target.day_no and ts.period_no=v_target.period_no
    and o.classroom_id=(select classroom_id from public.course_offerings where id=v_offering)
    and ts.course_offering_id<>v_offering) then raise exception 'Room collision at %/%',v_target.day_no,v_target.period_no;end if;
   if exists(select 1 from public.timetable_slots ts join public.teaching_assignments a on a.course_offering_id=ts.course_offering_id
    where ts.term_id=v_term and ts.weekday_no=v_target.day_no and ts.period_no=v_target.period_no
    and a.teacher_user_id=v_teacher and ts.course_offering_id<>v_offering) then raise exception 'Teacher collision at %/%',v_target.day_no,v_target.period_no;end if;
   if exists(select 1 from public.school_activity_schedules ac
    where ac.term_id=v_term and ac.classroom_id=(select classroom_id from public.course_offerings where id=v_offering)
      and ac.weekday_no=v_target.day_no and ac.period_no=v_target.period_no) then raise exception 'Activity collision at %/%',v_target.day_no,v_target.period_no;end if;
   insert into public.timetable_slots(school_id,term_id,course_offering_id,weekday_no,period_no,locked,updated_by)
   values(v_school,v_term,v_offering,v_target.day_no,v_target.period_no,true,v_actor)
   on conflict(term_id,course_offering_id,weekday_no,period_no) do nothing;
   v_count:=v_count+1;
 end loop;
 if v_count<>11 then raise exception 'Expected 11 verified lessons, got %',v_count;end if;
end $$;