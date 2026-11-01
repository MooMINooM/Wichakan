-- Authorized rollover: semester 2/2569 uses semester 1's weekly timetable.
-- Run as database administrator. All changes are atomic; no grades or attendance
-- are copied. Abort rather than overwrite a destination timetable already in use.
begin;
do $$
declare
 src uuid := '3b8de5e9-b86e-4d7f-a410-eb138019feac';
 dst uuid := 'd40b4d11-bd3c-4077-8d39-c1b401fb534d';
 school uuid := '39b470d8-52e8-43d7-9774-4e5d8cf7875f';
begin
 perform pg_advisory_xact_lock(hashtext(src::text));
 perform pg_advisory_xact_lock(hashtext(dst::text));
 if not exists(select 1 from public.terms a join public.terms b
   on b.academic_year_id=a.academic_year_id and b.school_id=a.school_id
   join public.academic_years y on y.id=a.academic_year_id
   where a.id=src and b.id=dst and a.school_id=school
   and a.term_no=1 and b.term_no=2 and y.year_be=2569)
 then raise exception 'Source/destination must be semesters 1 and 2 of 2569 in this school'; end if;
 if exists(select 1 from public.timetable_slots where term_id=dst)
 or exists(select 1 from public.school_activity_schedules where term_id=dst)
 or exists(select 1 from public.timetable_rules where term_id=dst)
 or exists(select 1 from public.timetable_course_integrations where term_id=dst)
 or exists(select 1 from public.timetable_course_preferences where term_id=dst)
 or exists(select 1 from public.timetable_term_settings where term_id=dst)
 then raise exception 'Destination already has timetable data; refusing to overwrite'; end if;

 -- Match the ordered course sequence within each curriculum/grade/code family.
 -- This handles two courses per semester (health/PE, art/music, social/history)
 -- and curriculum name changes such as speaking -> creative writing.
 create temporary table rollover_subjects on commit drop as
 with ranked as (
   select s.*,row_number() over(partition by curriculum_version_id,grade_level,
     left(subject_code,-2),semester_no order by subject_code) pos
   from public.subjects s where school_id=school and grade_level like 'ม.%'
 )
 select s.id source_id,case when s.grade_level like 'ม.%' then b.id else s.id end target_id
 from public.subjects s left join ranked a on a.id=s.id
 left join ranked b on b.curriculum_version_id=a.curriculum_version_id
   and b.grade_level=a.grade_level and left(b.subject_code,-2)=left(a.subject_code,-2)
   and b.semester_no=2 and b.pos=a.pos
 where s.school_id=school and exists(select 1 from public.course_offerings o where o.term_id=src and o.subject_id=s.id);
 if exists(select 1 from rollover_subjects where target_id is null)
 or (select count(*) from rollover_subjects)<>(select count(distinct target_id) from rollover_subjects)
 then raise exception 'Missing or ambiguous semester 2 subject mapping'; end if;
 if exists(select 1 from rollover_subjects m join public.subjects a on a.id=m.source_id
   join public.subjects b on b.id=m.target_id
   where (a.learning_hours,a.category,a.hour_basis) is distinct from (b.learning_hours,b.category,b.hour_basis))
 then raise exception 'Paired courses have different hours/category/basis; review first'; end if;

 insert into public.course_offerings(school_id,term_id,subject_id,classroom_id)
 select school,dst,m.target_id,o.classroom_id from public.course_offerings o
 join rollover_subjects m on m.source_id=o.subject_id where o.term_id=src
 on conflict(term_id,subject_id,classroom_id) do nothing;
 create temporary table rollover_offerings on commit drop as
 select a.id source_id,b.id target_id from public.course_offerings a
 join rollover_subjects m on m.source_id=a.subject_id
 join public.course_offerings b on b.term_id=dst and b.school_id=school
   and b.classroom_id=a.classroom_id and b.subject_id=m.target_id where a.term_id=src;
 if (select count(*) from rollover_offerings)<>(select count(*) from public.course_offerings where term_id=src)
 then raise exception 'Incomplete offering mapping'; end if;
 -- Existing destination assignments must agree; preserve their IDs.
 if exists(select a.course_offering_id,a.teacher_user_id from public.teaching_assignments a
   join rollover_offerings m on m.target_id=a.course_offering_id
   except select m.target_id,a.teacher_user_id from public.teaching_assignments a
   join rollover_offerings m on m.source_id=a.course_offering_id)
 then raise exception 'Destination teacher assignments differ'; end if;
 insert into public.teaching_assignments(school_id,course_offering_id,teacher_user_id)
 select school,m.target_id,a.teacher_user_id from public.teaching_assignments a
 join rollover_offerings m on m.source_id=a.course_offering_id
 on conflict(course_offering_id,teacher_user_id) do nothing;

 insert into public.timetable_term_settings(school_id,term_id,periods_per_day,updated_by)
 select school,dst,periods_per_day,updated_by from public.timetable_term_settings where term_id=src;
 insert into public.timetable_rules(school_id,term_id,kind,weekday_no,period_no,teacher_user_id,subject_id,label)
 select school,dst,r.kind,r.weekday_no,r.period_no,r.teacher_user_id,coalesce(m.target_id,r.subject_id),r.label
 from public.timetable_rules r left join rollover_subjects m on m.source_id=r.subject_id where r.term_id=src;
 insert into public.timetable_course_integrations(school_id,term_id,integrated_offering_id,host_offering_id,created_by)
 select school,dst,a.target_id,b.target_id,i.created_by from public.timetable_course_integrations i
 join rollover_offerings a on a.source_id=i.integrated_offering_id
 join rollover_offerings b on b.source_id=i.host_offering_id where i.term_id=src;
 insert into public.timetable_course_preferences(school_id,term_id,course_offering_id,double_period,updated_by)
 select school,dst,m.target_id,p.double_period,p.updated_by from public.timetable_course_preferences p
 join rollover_offerings m on m.source_id=p.course_offering_id where p.term_id=src;
 insert into public.school_activity_schedules(school_id,term_id,classroom_id,activity_type,weekday_no,period_no,teacher_user_id)
 select school,dst,classroom_id,activity_type,weekday_no,period_no,teacher_user_id
 from public.school_activity_schedules where term_id=src;
 insert into public.timetable_slots(school_id,term_id,course_offering_id,weekday_no,period_no,locked,updated_by)
 select school,dst,m.target_id,s.weekday_no,s.period_no,s.locked,s.updated_by
 from public.timetable_slots s join rollover_offerings m on m.source_id=s.course_offering_id where s.term_id=src;

 if (select count(*) from public.timetable_slots where term_id=dst)<>229
 or (select count(*) from public.school_activity_schedules where term_id=dst)<>39
 or (select count(*) from public.course_offerings where term_id=dst)<>144
 then raise exception 'Unexpected rollover counts; transaction cancelled'; end if;
end $$;
commit;
