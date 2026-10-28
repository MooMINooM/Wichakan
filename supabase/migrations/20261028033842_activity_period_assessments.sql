-- One result per activity/student/year (primary) or semester (secondary).
create table public.school_activity_period_assessments (
 school_id uuid not null references public.schools(id),
 classroom_id uuid not null,
 academic_year_id uuid not null,
 activity_type text not null check(activity_type in ('sss','guidance','ethics','club','scout')),
 period_no integer not null check(period_no in (0,1,2)), -- 0 = annual
 student_id uuid not null,
 result text check(result in ('pending','pass','fail')),
 recorded_by uuid not null,
 updated_at timestamptz not null default now(),
 primary key(classroom_id,activity_type,period_no,student_id),
 foreign key(classroom_id,academic_year_id,school_id) references public.classrooms(id,academic_year_id,school_id),
 foreign key(student_id,school_id) references public.students(id,school_id)
);
create index activity_period_school_year on public.school_activity_period_assessments(school_id,academic_year_id);
alter table public.school_activity_period_assessments enable row level security;

create function private.can_assess_school_activity(p_room uuid,p_kind text,p_period integer)
returns boolean language sql stable security invoker set search_path='' as $$
 select exists (
 select 1 from public.classrooms c
 where c.id=p_room
 and ((c.level_code like 'ป.%' and p_period=0) or (c.level_code like 'ม.%' and p_period in (1,2)))
 and p_kind in ('sss','guidance','ethics','club','scout')
 and exists(select 1 from public.school_activity_schedules s join public.terms t on t.id=s.term_id and t.school_id=s.school_id
   where s.school_id=c.school_id and s.classroom_id=c.id and s.activity_type=p_kind and t.academic_year_id=c.academic_year_id
   and (p_period=0 or t.term_no=p_period or not exists(
     select 1 from public.school_activity_schedules newer join public.terms nt on nt.id=newer.term_id and nt.school_id=newer.school_id
     where newer.school_id=c.school_id and newer.classroom_id=c.id and newer.activity_type=p_kind and nt.academic_year_id=c.academic_year_id and nt.term_no=p_period))
   and (private.has_school_role(c.school_id,array['school_admin','academic'])
    or (private.has_school_role(c.school_id,array['teacher']) and (
      (p_kind in ('sss','guidance','ethics') and s.teacher_user_id=auth.uid())
      or (p_kind in ('club','scout') and exists(select 1 from public.homeroom_assignments h where h.school_id=c.school_id and h.classroom_id=c.id and h.teacher_user_id=auth.uid()))))))
 );
$$;
revoke all on function private.can_assess_school_activity(uuid,text,integer) from public,anon;
grant execute on function private.can_assess_school_activity(uuid,text,integer) to authenticated;
create policy activity_period_read on public.school_activity_period_assessments for select to authenticated
 using(private.has_school_role(school_id,array['school_admin','academic','teacher','registrar','director']));
create policy activity_period_insert on public.school_activity_period_assessments for insert to authenticated
 with check(recorded_by=auth.uid() and private.can_assess_school_activity(classroom_id,activity_type,period_no)
 and exists(select 1 from public.enrollments e where e.school_id=school_activity_period_assessments.school_id and e.classroom_id=school_activity_period_assessments.classroom_id and e.academic_year_id=school_activity_period_assessments.academic_year_id and e.student_id=school_activity_period_assessments.student_id and e.status in ('active','completed')));
create policy activity_period_update on public.school_activity_period_assessments for update to authenticated
 using(private.can_assess_school_activity(classroom_id,activity_type,period_no))
 with check(recorded_by=auth.uid() and private.can_assess_school_activity(classroom_id,activity_type,period_no)
 and exists(select 1 from public.enrollments e where e.school_id=school_activity_period_assessments.school_id and e.classroom_id=school_activity_period_assessments.classroom_id and e.academic_year_id=school_activity_period_assessments.academic_year_id and e.student_id=school_activity_period_assessments.student_id and e.status in ('active','completed')));
revoke all on public.school_activity_period_assessments from public,anon,authenticated;
grant select,insert,update on public.school_activity_period_assessments to authenticated;

create function public.save_school_activity_period(p_room uuid,p_kind text,p_period integer,p_rows jsonb)
returns integer language plpgsql security invoker set search_path='' as $$
declare v_school uuid;v_year uuid;v_row jsonb;v_student uuid;v_result text;v_seen uuid[]='{}';v_count integer=0;
begin
 if auth.uid() is null or not private.can_assess_school_activity(p_room,p_kind,p_period) then raise exception 'ไม่มีสิทธิ์ประเมินกิจกรรมในช่วงนี้';end if;
 if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 500 then raise exception 'ข้อมูลประเมินไม่ถูกต้อง';end if;
 select school_id,academic_year_id into v_school,v_year from public.classrooms where id=p_room;
 perform pg_advisory_xact_lock(hashtext(p_room::text||p_kind||p_period::text));
 for v_row in select * from jsonb_array_elements(p_rows) loop
  if jsonb_typeof(v_row) is distinct from 'object' or jsonb_typeof(v_row->'student_id') is distinct from 'string' or not (v_row?'result') or (jsonb_typeof(v_row->'result') not in ('string','null')) then raise exception 'ข้อมูลนักเรียนไม่ถูกต้อง';end if;
  v_student=(v_row->>'student_id')::uuid;v_result=v_row->>'result';
  if v_student=any(v_seen) then raise exception 'นักเรียนซ้ำในชุดบันทึก';end if;v_seen=array_append(v_seen,v_student);
  if v_result is not null and v_result not in ('pending','pass','fail') then raise exception 'ผลประเมินไม่ถูกต้อง';end if;
  insert into public.school_activity_period_assessments(school_id,classroom_id,academic_year_id,activity_type,period_no,student_id,result,recorded_by)
  values(v_school,p_room,v_year,p_kind,p_period,v_student,v_result,auth.uid())
  on conflict(classroom_id,activity_type,period_no,student_id) do update set result=excluded.result,recorded_by=auth.uid(),updated_at=now();
  v_count=v_count+1;
 end loop;
 return v_count;
end $$;
revoke all on function public.save_school_activity_period(uuid,text,integer,jsonb) from public,anon;
grant execute on function public.save_school_activity_period(uuid,text,integer,jsonb) to authenticated;

-- Preserve all old records; merge only agreeing assessments, flag conflicts for review.
insert into public.school_activity_period_assessments(school_id,classroom_id,academic_year_id,activity_type,period_no,student_id,result,recorded_by,updated_at)
select s.school_id,s.classroom_id,t.academic_year_id,s.activity_type,case when c.level_code like 'ป.%' then 0 else t.term_no end,a.student_id,
 case when count(distinct a.result)=1 then min(a.result) else 'pending' end,
 (array_agg(a.recorded_by order by a.updated_at desc,a.id))[1],max(a.updated_at)
from public.school_activity_assessments a join public.school_activity_schedules s on s.id=a.schedule_id and s.school_id=a.school_id
join public.terms t on t.id=s.term_id and t.school_id=s.school_id
join public.classrooms c on c.id=s.classroom_id and c.school_id=s.school_id and c.academic_year_id=t.academic_year_id
where s.activity_type in ('sss','guidance','ethics','club','scout') and (c.level_code like 'ป.%' or c.level_code like 'ม.%')
group by s.school_id,s.classroom_id,t.academic_year_id,s.activity_type,case when c.level_code like 'ป.%' then 0 else t.term_no end,a.student_id;
