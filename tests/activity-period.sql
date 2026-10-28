begin;
do $$
declare p record;m record;student uuid;other_student uuid;actor uuid;other_actor uuid;term2 uuid;rejected boolean;before_result text;
begin
 select s.*,t.academic_year_id into p from public.school_activity_schedules s join public.classrooms c on c.id=s.classroom_id join public.terms t on t.id=s.term_id where c.level_code like 'ป.%' and s.activity_type='guidance' and s.teacher_user_id is not null order by s.id limit 1;
 select e.student_id into student from public.enrollments e where e.classroom_id=p.classroom_id and e.academic_year_id=p.academic_year_id and e.status in ('active','completed') limit 1;
 if p is null or student is null then raise exception 'Missing primary activity fixture';end if;
 actor=p.teacher_user_id;
 perform set_config('request.jwt.claim.sub',actor::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 perform public.save_school_activity_period(p.classroom_id,'guidance',0,jsonb_build_array(jsonb_build_object('student_id',student,'result','pass')));
 perform public.save_school_activity_period(p.classroom_id,'guidance',0,jsonb_build_array(jsonb_build_object('student_id',student,'result','fail')));
 if (select count(*) from public.school_activity_period_assessments where classroom_id=p.classroom_id and activity_type='guidance' and period_no=0 and student_id=student)<>1 then raise exception 'Annual assessment must update the same record';end if;
 rejected=false;begin perform public.save_school_activity_period(p.classroom_id,'guidance',1,jsonb_build_array(jsonb_build_object('student_id',student,'result','pass')));exception when others then rejected=true;end;
 if not rejected then raise exception 'Primary semester record must be rejected';end if;
 -- A late invalid result must roll back the earlier valid change in the same batch.
 rejected=false;begin perform public.save_school_activity_period(p.classroom_id,'guidance',0,jsonb_build_array(jsonb_build_object('student_id',student,'result','pass'),jsonb_build_object('student_id',gen_random_uuid(),'result','invalid')));exception when others then rejected=true;end;
 if not rejected or (select result from public.school_activity_period_assessments where classroom_id=p.classroom_id and activity_type='guidance' and period_no=0 and student_id=student)<>'fail' then raise exception 'Whole-class save must be atomic';end if;
 rejected=false;begin perform public.save_school_activity_period(p.classroom_id,'guidance',0,jsonb_build_array(jsonb_build_object('student_id',student,'result','pass'),jsonb_build_object('student_id',student,'result','pass')));exception when others then rejected=true;end;
 if not rejected then raise exception 'Duplicate student must be rejected';end if;
 execute 'reset role';
 select e.student_id into other_student from public.enrollments e where e.classroom_id<>p.classroom_id and e.school_id=p.school_id and e.student_id<>student limit 1;
 execute 'set local role authenticated';
 rejected=false;begin perform public.save_school_activity_period(p.classroom_id,'guidance',0,jsonb_build_array(jsonb_build_object('student_id',other_student,'result','pass')));exception when others then rejected=true;end;
 if not rejected then raise exception 'Other-class student must be rejected by RLS';end if;
 perform public.save_school_activity_period(p.classroom_id,'guidance',0,jsonb_build_array(jsonb_build_object('student_id',student,'result',null)));
 if (select result from public.school_activity_period_assessments where classroom_id=p.classroom_id and activity_type='guidance' and period_no=0 and student_id=student) is not null then raise exception 'Unassessed result must stay blank';end if;
 execute 'reset role';
 select s.*,t.academic_year_id into m from public.school_activity_schedules s join public.classrooms c on c.id=s.classroom_id join public.terms t on t.id=s.term_id where c.level_code like 'ม.%' and s.activity_type='guidance' and s.teacher_user_id is not null order by s.id limit 1;
 select e.student_id into student from public.enrollments e where e.classroom_id=m.classroom_id and e.academic_year_id=m.academic_year_id and e.status in ('active','completed') limit 1;
 if m is null or student is null then raise exception 'Missing secondary fixture';end if;
 actor=m.teacher_user_id;
 perform set_config('request.jwt.claim.sub',actor::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 perform public.save_school_activity_period(m.classroom_id,'guidance',1,jsonb_build_array(jsonb_build_object('student_id',student,'result','pass')));
 perform public.save_school_activity_period(m.classroom_id,'guidance',2,jsonb_build_array(jsonb_build_object('student_id',student,'result','fail')));
 if (select count(*) from public.school_activity_period_assessments where classroom_id=m.classroom_id and activity_type='guidance' and student_id=student)<>2 then raise exception 'Secondary terms must remain separate';end if;
 rejected=false;begin perform public.save_school_activity_period(m.classroom_id,'guidance',0,jsonb_build_array(jsonb_build_object('student_id',student,'result','pass')));exception when others then rejected=true;end;
 if not rejected then raise exception 'Secondary annual record must be rejected';end if;
 execute 'reset role';
 -- An explicit new-term teacher assignment takes priority over the fallback.
 select id into term2 from public.terms where school_id=m.school_id and academic_year_id=m.academic_year_id and term_no=2;
 select user_id into other_actor from public.school_memberships where school_id=m.school_id and role='teacher' and active and user_id<>actor limit 1;
 if term2 is null or other_actor is null then raise exception 'Missing second term/teacher fixture';end if;
 insert into public.school_activity_schedules(school_id,term_id,classroom_id,activity_type,weekday_no,period_no,teacher_user_id) values(m.school_id,term2,m.classroom_id,'guidance',1,1,other_actor);
 execute 'set local role authenticated';
 if private.can_assess_school_activity(m.classroom_id,'guidance',2) then raise exception 'Old term teacher must not override new assignment';end if;
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',other_actor::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',other_actor,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 perform public.save_school_activity_period(m.classroom_id,'guidance',2,jsonb_build_array(jsonb_build_object('student_id',student,'result','pass')));
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);perform set_config('request.jwt.claims','{"role":"authenticated"}',true);
 execute 'set local role authenticated';
 if exists(select 1 from public.school_activity_period_assessments) then raise exception 'Unaffiliated user must see no assessments';end if;
 rejected=false;begin perform public.save_school_activity_period(m.classroom_id,'guidance',1,jsonb_build_array(jsonb_build_object('student_id',student,'result','pass')));exception when others then rejected=true;end;
 if not rejected then raise exception 'Unauthorized write must fail';end if;
 execute 'reset role';
 if has_table_privilege('anon','public.school_activity_period_assessments','select') or has_function_privilege('anon','public.save_school_activity_period(uuid,text,integer,jsonb)','execute') then raise exception 'Anonymous access must be denied';end if;
end $$;
do $$
declare r record;sid uuid;actor uuid;n integer=0;
begin
 select s.school_id,s.classroom_id,t.academic_year_id into r from public.school_activity_schedules s join public.terms t on t.id=s.term_id join public.classrooms c on c.id=s.classroom_id
 where s.activity_type='club' and c.level_code like 'ป.%' and (select count(distinct teacher_user_id) from public.homeroom_assignments where classroom_id=c.id)>=2 limit 1;
 if r is null then raise exception 'Missing two-homeroom-teacher activity fixture';end if;
 select student_id into sid from public.enrollments where classroom_id=r.classroom_id and academic_year_id=r.academic_year_id and status in ('active','completed') limit 1;
 for actor in select distinct teacher_user_id from public.homeroom_assignments where classroom_id=r.classroom_id loop
  perform set_config('request.jwt.claim.sub',actor::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  perform public.save_school_activity_period(r.classroom_id,'club',0,jsonb_build_array(jsonb_build_object('student_id',sid,'result','pass')));
  execute 'reset role';n=n+1;
 end loop;
 if n<2 then raise exception 'Both homeroom teachers must be allowed';end if;
end $$;
rollback;
select 'PASS: annual/semester isolation, assignment fallback and override, actual-teacher RLS, blank results, enrollment checks, duplicates and atomic whole-class save. All fixture edits rolled back.' as result;
