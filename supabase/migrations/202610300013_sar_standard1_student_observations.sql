-- Standard 1 student assessment: assessed by homeroom teachers, never derived
-- from a student's unrelated grades or assumed to be met when missing.
create table public.sar_student_observations(
 school_id uuid not null references public.schools(id) on delete cascade,
 academic_year_id uuid not null references public.academic_years(id) on delete cascade,
 student_id uuid not null references public.students(id) on delete cascade,
 indicator_code text not null references public.sar_target_topics(code),
 result text not null check(result in ('met','not_met')),
 note text not null default '' check(length(note)<=1000),
 recorded_by uuid not null references auth.users(id),
 updated_at timestamptz not null default now(),
 primary key(school_id,academic_year_id,student_id,indicator_code)
);
create index sar_student_obs_year on public.sar_student_observations(school_id,academic_year_id,indicator_code);
alter table public.sar_student_observations enable row level security;
grant select on public.sar_student_observations to authenticated;
create policy sar_student_observations_read on public.sar_student_observations for select to authenticated
using(exists(select 1 from public.school_memberships m where m.school_id=sar_student_observations.school_id and m.user_id=(select auth.uid()) and m.active
  and (m.role='school_admin' or (
   m.role='teacher' and exists(
    select 1 from public.enrollments e join public.homeroom_assignments h
     on h.classroom_id=e.classroom_id and h.school_id=e.school_id
    where e.school_id=sar_student_observations.school_id
     and e.academic_year_id=sar_student_observations.academic_year_id
     and e.student_id=sar_student_observations.student_id and e.status in ('active','completed')
     and h.teacher_user_id=(select auth.uid())
   )
  ))
));

create function public.sar_save_student_observations(p_year uuid,p_student uuid,p_answers jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare v_school uuid;v_count integer;
begin
 select y.school_id into v_school from public.academic_years y where y.id=p_year;
 if v_school is null or (select auth.uid()) is null or not exists(
  select 1 from public.school_memberships m where m.school_id=v_school and m.user_id=(select auth.uid()) and m.active
    and (m.role='school_admin' or (m.role='teacher' and exists(
     select 1 from public.enrollments e join public.homeroom_assignments h
       on h.school_id=e.school_id and h.classroom_id=e.classroom_id
     where e.school_id=v_school and e.academic_year_id=p_year and e.student_id=p_student
      and e.status in ('active','completed') and h.teacher_user_id=(select auth.uid())
    )))
 ) or not exists(select 1 from public.enrollments e where e.school_id=v_school
  and e.academic_year_id=p_year and e.student_id=p_student and e.status in ('active','completed'))
 then raise exception 'not_authorized';end if;
 if jsonb_typeof(p_answers)<>'array' then raise exception 'invalid_answers';end if;
 v_count=jsonb_array_length(p_answers);
 if v_count>10 or v_count<>(select count(distinct x.code) from jsonb_to_recordset(p_answers) x(code text,result text,note text))
 then raise exception 'duplicate_or_excess_answers';end if;
 if exists(select 1 from jsonb_to_recordset(p_answers) x(code text,result text,note text) where
  x.code is null or x.code not in ('1.1.1','1.1.2','1.1.3','1.1.4','1.1.5','1.1.6','1.2.1','1.2.2','1.2.3','1.2.4')
  or x.result not in ('met','not_met') or length(coalesce(x.note,''))>1000)
 then raise exception 'invalid_student_assessment';end if;
 insert into public.sar_student_observations(school_id,academic_year_id,student_id,indicator_code,result,note,recorded_by,updated_at)
 select v_school,p_year,p_student,x.code,x.result,btrim(coalesce(x.note,'')),(select auth.uid()),now()
 from jsonb_to_recordset(p_answers) x(code text,result text,note text)
 on conflict(school_id,academic_year_id,student_id,indicator_code) do update
 set result=excluded.result,note=excluded.note,recorded_by=excluded.recorded_by,updated_at=now();
 return v_count;
end $$;
revoke all on function public.sar_save_student_observations(uuid,uuid,jsonb) from public,anon;
grant execute on function public.sar_save_student_observations(uuid,uuid,jsonb) to authenticated;

create function public.sar_admin_standard1_summary(p_year uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_school uuid;v_output jsonb;
begin
 select y.school_id into v_school from public.academic_years y where y.id=p_year;
 if v_school is null or not exists(select 1 from public.school_memberships m
  where m.school_id=v_school and m.user_id=(select auth.uid()) and m.active and m.role='school_admin')
 then raise exception 'not_authorized';end if;
 with roster as (
  select distinct e.student_id from public.enrollments e where e.school_id=v_school and e.academic_year_id=p_year and e.status in ('active','completed')
 ), codes as (
  select t.code from public.sar_target_topics t where t.code in
  ('1.1.1','1.1.2','1.1.3','1.1.4','1.1.5','1.1.6','1.2.1','1.2.2','1.2.3','1.2.4')
 ), summary as (
  select c.code,
   (select count(*)::integer from roster) as eligible,
   count(o.student_id)::integer as assessed,
   count(o.student_id) filter(where o.result='met')::integer as met
  from codes c left join public.sar_student_observations o
   on o.indicator_code=c.code and o.school_id=v_school and o.academic_year_id=p_year
   and exists(select 1 from roster r where r.student_id=o.student_id)
  group by c.code
 )
 select coalesce(jsonb_agg(jsonb_build_object('code',code,'eligible',eligible,'assessed',assessed,
  'met',met,'met_percent_of_assessed',case when assessed=0 then null else round(100.0*met/assessed,2) end)
  order by code),'[]'::jsonb) into v_output from summary;
 return jsonb_build_object('rows',v_output,'source','homeroom teacher assessments; missing values excluded from percentages');
end $$;
revoke all on function public.sar_admin_standard1_summary(uuid) from public,anon;
grant execute on function public.sar_admin_standard1_summary(uuid) to authenticated;
