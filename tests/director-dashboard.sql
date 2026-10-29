begin;
set local statement_timeout='10s';
do $$
declare f record;r record;n integer=0;changed integer;rejected boolean;integrated uuid;actual_saved bigint;expected_saved bigint;
begin
 select m.user_id,o.school_id,o.id as offering,o.subject_id,t.id as term,t.academic_year_id as year,s.student_id into f
 from public.school_memberships m join public.course_offerings o on o.school_id=m.school_id
 join public.terms t on t.id=o.term_id and t.school_id=o.school_id
 join public.student_course_scores s on s.course_offering_id=o.id and s.school_id=o.school_id
 where m.role='teacher' and m.active
 and not exists(select 1 from public.school_memberships extra where extra.school_id=m.school_id and extra.user_id=m.user_id and extra.active and extra.role in ('school_admin','academic','registrar','director'))
 and not exists(select 1 from public.teaching_assignments a where a.course_offering_id=o.id and a.teacher_user_id=m.user_id)
 and not exists(select 1 from public.homeroom_assignments h where h.classroom_id=o.classroom_id and h.teacher_user_id=m.user_id)
 limit 1;
 if f is null then raise exception 'Missing unrelated teacher/course fixture';end if;
 perform set_config('request.jwt.claim.sub',f.user_id::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',f.user_id,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 if exists(select 1 from public.student_course_scores where course_offering_id=f.offering) then raise exception 'Fixture teacher already has score access';end if;
 rejected=false;begin perform public.director_attendance_progress(f.year,f.term);exception when others then rejected=true;end;
 if not rejected then raise exception 'Teacher must not call director aggregate';end if;
 execute 'reset role';
 insert into public.school_memberships(school_id,user_id,role,active) values(f.school_id,f.user_id,'director',true);
 insert into public.course_student_assessments(school_id,course_offering_id,student_id,trait_scores,reading_scores,updated_by) values(f.school_id,f.offering,f.student_id,array[0,0,0,0,0,0,0,0],null,f.user_id) on conflict(course_offering_id,student_id) do update set trait_scores=excluded.trait_scores,reading_scores=excluded.reading_scores;
 execute 'set local role authenticated';
 if not exists(select 1 from public.student_course_scores where course_offering_id=f.offering) then raise exception 'Director must read school score records';end if;
 if not exists(select 1 from public.course_student_assessments where course_offering_id=f.offering and student_id=f.student_id) then raise exception 'Director must read course assessments';end if;
 if not exists(select 1 from public.subject_score_settings where subject_id=f.subject_id and academic_year_id=f.year) then raise exception 'Director must read score settings';end if;
 for r in select * from public.director_attendance_progress(f.year,f.term) loop
  n=n+1;
  if r.expected<0 or r.saved<0 or r.saved>r.expected then raise exception 'Attendance count bounds invalid';end if;
  if not exists(select 1 from public.course_offerings o join public.classrooms c on c.id=o.classroom_id where o.id=r.course_offering_id and o.school_id=f.school_id and o.term_id=f.term and c.academic_year_id=f.year) then raise exception 'Attendance must stay within selected school/year/term';end if;
 end loop;
 if n=0 then raise exception 'Expected offering summaries';end if;
 select integrated_offering_id into integrated from public.timetable_course_integrations where school_id=f.school_id and term_id=f.term limit 1;
 if integrated is not null then
  select saved into actual_saved from public.director_attendance_progress(f.year,f.term) where course_offering_id=integrated;
  select count(distinct (a.student_id,a.class_date,a.session_no)) into expected_saved
  from public.effective_course_attendance a join public.course_offerings o on o.id=a.course_offering_id and o.school_id=a.school_id
  join public.terms t on t.id=o.term_id and t.school_id=o.school_id
  join public.course_attendance_slots s on s.course_offering_id=o.id and s.school_id=o.school_id and s.weekday_no=extract(isodow from a.class_date) and s.period_no=a.session_no
  join public.enrollments e on e.classroom_id=o.classroom_id and e.school_id=o.school_id and e.academic_year_id=f.year and e.student_id=a.student_id and e.status in ('active','completed')
  where o.id=integrated and a.attendance_status in ('present','absent','late','leave')
   and a.class_date between t.starts_on and least(t.ends_on,(now() at time zone 'Asia/Bangkok')::date)
   and (e.started_on is null or e.started_on<=a.class_date) and (e.ended_on is null or e.ended_on>=a.class_date);
  if actual_saved is distinct from expected_saved then raise exception 'Integrated summary must match shared effective attendance records';end if;
 end if;
 rejected=false;begin perform public.director_attendance_progress(f.year,gen_random_uuid());exception when others then rejected=true;end;
 if not rejected then raise exception 'Mismatched reporting scope must fail';end if;
 update public.student_course_scores set term1_coursework=term1_coursework where course_offering_id=f.offering;
 get diagnostics changed=row_count;if changed<>0 then raise exception 'Director read access must not grant score updates';end if;
 if private.can_record_course_assessment(f.school_id,f.offering,f.student_id) then raise exception 'Director must not gain assessment-write permission';end if;
 execute 'reset role';
 update public.school_memberships set active=false where school_id=f.school_id and user_id=f.user_id and role='director';
 execute 'set local role authenticated';
 if exists(select 1 from public.student_course_scores where course_offering_id=f.offering) then raise exception 'Inactive director access must stop';end if;
 rejected=false;begin perform public.director_attendance_progress(f.year,f.term);exception when others then rejected=true;end;
 if not rejected then raise exception 'Inactive director aggregate access must stop';end if;
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);perform set_config('request.jwt.claims','{"role":"authenticated"}',true);
 execute 'set local role authenticated';
 if exists(select 1 from public.student_course_scores) or exists(select 1 from public.subject_score_settings) or exists(select 1 from public.course_student_assessments) then raise exception 'Unaffiliated user must see no school data';end if;
 rejected=false;begin perform public.director_attendance_progress(f.year,f.term);exception when others then rejected=true;end;
 if not rejected then raise exception 'Foreign user aggregate access must fail';end if;
 execute 'reset role';
 if has_function_privilege('anon','public.director_attendance_progress(uuid,uuid)','execute') then raise exception 'Anonymous aggregate access must be denied';end if;
end $$;
rollback;
select 'PASS: director scoped reads and aggregate counts, no new write rights, inactive/unauthorized/anonymous denial. Fixture membership changes rolled back.' as result;
