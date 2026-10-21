-- Regression check against an imported school with a 20/60-hour mathematics link.
-- All fixture edits and marks are rolled back, including when an assertion fails.
begin;
do $$
declare v record;slot record;sid uuid;teacher uuid;lesson date;mark text;n integer;denied boolean;
begin
 select i.*,o.subject_id,o.classroom_id,t.academic_year_id,t.starts_on,t.ends_on into v
 from public.timetable_course_integrations i
 join public.course_offerings o on o.id=i.integrated_offering_id
 join public.subjects s on s.id=o.subject_id
 join public.terms t on t.id=i.term_id
 where s.name_th='คณิตศาสตร์เพิ่มเติม' and s.learning_hours=20 and s.hour_basis='term'
 and (select count(*) from public.timetable_slots ts where ts.course_offering_id=i.host_offering_id)=3
 order by i.integrated_offering_id limit 1;
 if v is null then raise exception 'Missing imported integration fixture';end if;
 select * into slot from public.timetable_slots where course_offering_id=v.host_offering_id order by weekday_no,period_no limit 1;
 select count(*) into n from public.course_attendance_slots where course_offering_id=v.integrated_offering_id;
 if n<>1 or not exists(select 1 from public.course_attendance_slots where course_offering_id=v.integrated_offering_id and weekday_no=slot.weekday_no and period_no=slot.period_no) then raise exception '20 hours must select the first single period';end if;
 update public.subjects set learning_hours=40 where id=v.subject_id;
 if (select count(*) from public.course_attendance_slots where course_offering_id=v.integrated_offering_id)<>2 then raise exception '40 term hours must select two periods';end if;
 update public.subjects set learning_hours=60 where id=v.subject_id;
 if (select count(*) from public.course_attendance_slots where course_offering_id=v.integrated_offering_id)<>3 then raise exception 'Equal hours must select all host periods';end if;
 update public.subjects set learning_hours=80 where id=v.subject_id;
 if exists(select 1 from public.course_attendance_slots where course_offering_id=v.integrated_offering_id) then raise exception 'Insufficient host periods must not silently undercount';end if;
 update public.subjects set learning_hours=40,hour_basis='year' where id=v.subject_id;
 if (select count(*) from public.course_attendance_slots where course_offering_id=v.integrated_offering_id)<>1 then raise exception '40 annual hours must select one period';end if;
 update public.subjects set learning_hours=30,hour_basis='term' where id=v.subject_id;
 if exists(select 1 from public.course_attendance_slots where course_offering_id=v.integrated_offering_id) then raise exception 'Fractional weekly hours need review';end if;
 update public.subjects set learning_hours=20,hour_basis=null where id=v.subject_id;
 if exists(select 1 from public.course_attendance_slots where course_offering_id=v.integrated_offering_id) then raise exception 'Unspecified hour basis must not be guessed';end if;
 update public.subjects set hour_basis='term' where id=v.subject_id;
 lesson=v.starts_on+((slot.weekday_no-extract(isodow from v.starts_on)::integer+7)%7);
 select e.student_id into sid from public.enrollments e where e.classroom_id=v.classroom_id and e.academic_year_id=v.academic_year_id and e.status in ('active','completed') and (e.started_on is null or e.started_on<=lesson) and (e.ended_on is null or e.ended_on>=lesson) order by e.student_id limit 1;
 select a.teacher_user_id into teacher from public.teaching_assignments a where a.course_offering_id=v.host_offering_id order by a.teacher_user_id limit 1;
 if sid is null or teacher is null or lesson is null then raise exception 'Missing enrolled student, host teacher or term dates';end if;
 -- Three real host periods each week; integrated data must expose just the chosen one.
 insert into public.course_attendance_records(school_id,course_offering_id,student_id,class_date,session_no,attendance_status,recorded_by)
 select v.school_id,v.host_offering_id,sid,v.starts_on+((ts.weekday_no-extract(isodow from v.starts_on)::integer+7)%7),ts.period_no,'absent',teacher
 from public.timetable_slots ts where ts.course_offering_id=v.host_offering_id
 on conflict(course_offering_id,student_id,class_date,session_no) do update set attendance_status='absent';
 insert into public.course_attendance_records(school_id,course_offering_id,student_id,class_date,session_no,attendance_status,recorded_by)
 values(v.school_id,v.integrated_offering_id,sid,lesson,slot.period_no,'present',teacher)
 on conflict(course_offering_id,student_id,class_date,session_no) do update set attendance_status='present';
 select count(*) into n from public.effective_course_attendance where course_offering_id=v.integrated_offering_id and student_id=sid and class_date between v.starts_on and v.starts_on+6;
 if n<>1 then raise exception 'Only the one selected weekly host period should be counted';end if;
 select attendance_status into mark from public.effective_course_attendance where course_offering_id=v.integrated_offering_id and student_id=sid and class_date=lesson and session_no=slot.period_no;
 if mark<>'absent' then raise exception 'Host absence must override stale integrated marks';end if;
 perform set_config('request.jwt.claim.sub',teacher::text,true);
 perform set_config('request.jwt.claims',json_build_object('sub',teacher,'role','authenticated')::text,true);
 perform public.save_course_attendance_grid(v.host_offering_id,jsonb_build_array(jsonb_build_object('student_id',sid,'class_date',lesson,'session_no',slot.period_no,'attendance_status','leave')));
 select attendance_status into mark from public.effective_course_attendance where course_offering_id=v.integrated_offering_id and student_id=sid and class_date=lesson and session_no=slot.period_no;
 if mark<>'leave' then raise exception 'Host edits must immediately appear in integrated attendance';end if;
 -- Check both views with the teacher's actual RLS privileges.
 execute 'set local role authenticated';
 if not exists(select 1 from public.course_attendance_slots where course_offering_id=v.integrated_offering_id) or not exists(select 1 from public.effective_course_attendance where course_offering_id=v.integrated_offering_id and student_id=sid and class_date=lesson and attendance_status='leave') then raise exception 'School teacher cannot read integrated data through RLS';end if;
 execute 'reset role';
 select teacher_user_id into teacher from public.teaching_assignments where course_offering_id=v.integrated_offering_id limit 1;
 perform set_config('request.jwt.claim.sub',teacher::text,true);
 perform set_config('request.jwt.claims',json_build_object('sub',teacher,'role','authenticated')::text,true);
 denied=false;
 begin
  perform public.save_course_attendance(v.integrated_offering_id,sid,lesson,slot.period_no,'present');
 exception when others then
  if sqlerrm not like 'Integrated attendance is read%' then raise;end if;denied=true;
 end;
 if not denied then raise exception 'Legacy per-student writes to integrated course must be rejected';end if;
 delete from public.course_attendance_records where course_offering_id=v.host_offering_id and student_id=sid and class_date=lesson and session_no=slot.period_no;
 if exists(select 1 from public.effective_course_attendance where course_offering_id=v.integrated_offering_id and student_id=sid and class_date=lesson and session_no=slot.period_no) then raise exception 'Missing host mark must remain missing, not default to present';end if;
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 perform set_config('request.jwt.claims','{"role":"authenticated"}',true);
 execute 'set local role authenticated';
 if exists(select 1 from public.course_attendance_slots) or exists(select 1 from public.effective_course_attendance) then raise exception 'User without school membership must see no data';end if;
 execute 'reset role';
 if has_table_privilege('anon','public.course_attendance_slots','select') or has_table_privilege('anon','public.effective_course_attendance','select') then raise exception 'Anonymous view access must be denied';end if;
end $$;
rollback;
select 'PASS: automatic 1/2/all periods, annual/term basis, insufficient/invalid hours, shared actual marks, host edit propagation, missing marks, legacy write denial and RLS. All fixture edits rolled back.' as result;
