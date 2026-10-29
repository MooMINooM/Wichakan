-- SAR targets are percentages set PER consideration (2.1..2.6, 3.1..3.5).
-- The previous two standard-wide quality-level targets were conceptually wrong.
-- Keep legacy columns only for historic compatibility; do not use them for new releases.
create table public.sar_indicator_targets(
 school_id uuid not null references public.schools(id) on delete cascade,
 academic_year_id uuid not null references public.academic_years(id) on delete cascade,
 section_code text not null,
 target_percent numeric(5,2) not null check (target_percent between 0 and 100),
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id),
 primary key(school_id,academic_year_id,section_code)
);
alter table public.sar_indicator_targets enable row level security;
revoke all on public.sar_indicator_targets from anon,authenticated;
grant select on public.sar_indicator_targets to authenticated;
create policy "sar_indicator_targets_staff_read" on public.sar_indicator_targets
 for select to authenticated
 using (
  exists(select 1 from public.school_memberships m
   where m.school_id=sar_indicator_targets.school_id and m.user_id=(select auth.uid()) and m.active
    and (m.role='school_admin' or
     (m.role='teacher' and exists (
      select 1 from public.sar_year_settings s where s.school_id=sar_indicator_targets.school_id
       and s.academic_year_id=sar_indicator_targets.academic_year_id and s.status='published'
     ))))
 );

alter table public.sar_year_settings drop constraint sar_targets_publication_consistent;
alter table public.sar_year_settings add constraint sar_targets_publication_consistent check (
 (status='draft' and published_at is null) or
 (status='published' and published_at is not null)
);

-- Old endpoint must not be able to publish one global number per standard.
revoke execute on function public.sar_set_year_targets(uuid,smallint,smallint,text,boolean) from authenticated;

create function public.sar_save_indicator_targets(
 p_year uuid,p_targets jsonb,p_notes text default '',p_publish boolean default false
) returns void language plpgsql security definer set search_path='' as $$
declare v_school uuid;v_old_status text;v_expected integer;v_count integer;
begin
 select y.school_id into v_school from public.academic_years y where y.id=p_year;
 if v_school is null or (select auth.uid()) is null or not exists(
  select 1 from public.school_memberships m
   where m.school_id=v_school and m.user_id=(select auth.uid()) and m.active and m.role='school_admin'
 ) then raise exception 'not_authorized';end if;
 if p_targets is null or jsonb_typeof(p_targets)<>'array' or
  length(coalesce(p_notes,''))>2000
 then raise exception 'invalid_targets';end if;

 select count(distinct i.section_code) into v_expected from public.sar_assessment_items i
 where i.standard_no in (2,3);
 v_count=jsonb_array_length(p_targets);
 if v_count>v_expected or
  (select count(distinct x.section_code) from jsonb_to_recordset(p_targets)
   as x(section_code text,target_percent numeric))<>v_count
 then raise exception 'duplicate_or_excess_targets';end if;
 if exists(
  select 1 from jsonb_to_recordset(p_targets) as x(section_code text,target_percent numeric)
  where x.section_code is null or x.target_percent is null
    or x.target_percent<0 or x.target_percent>100
    or not exists(select 1 from public.sar_assessment_items i where i.section_code=x.section_code)
 ) then raise exception 'invalid_indicator_target';end if;
 if p_publish and v_count<>v_expected then
  raise exception 'all_indicator_targets_required';end if;

 select s.status into v_old_status from public.sar_year_settings s
  where s.school_id=v_school and s.academic_year_id=p_year for update;
 if v_old_status='published' then raise exception 'published_targets_are_locked';end if;

 -- This is a transaction: if inserting targets fails the settings update rolls back too.
 delete from public.sar_indicator_targets
  where school_id=v_school and academic_year_id=p_year;
 insert into public.sar_indicator_targets(
  school_id,academic_year_id,section_code,target_percent,updated_at,updated_by)
 select v_school,p_year,x.section_code,x.target_percent,now(),(select auth.uid())
 from jsonb_to_recordset(p_targets) as x(section_code text,target_percent numeric);

 insert into public.sar_year_settings(
  school_id,academic_year_id,target_standard_2,target_standard_3,notes,
  status,published_at,published_by,updated_at,updated_by)
 values(v_school,p_year,null,null,btrim(coalesce(p_notes,'')),
  case when p_publish then 'published' else 'draft' end,
  case when p_publish then now() else null end,
  case when p_publish then (select auth.uid()) else null end,now(),(select auth.uid()))
 on conflict(school_id,academic_year_id) do update
 set target_standard_2=null,target_standard_3=null,notes=excluded.notes,
  status=excluded.status,published_at=excluded.published_at,
  published_by=excluded.published_by,updated_at=now(),updated_by=(select auth.uid());
end $$;
revoke all on function public.sar_save_indicator_targets(uuid,jsonb,text,boolean) from public,anon;
grant execute on function public.sar_save_indicator_targets(uuid,jsonb,text,boolean) to authenticated;

-- Prevent an old/partially configured release from accepting teacher responses
-- until annual targets exist for all eleven consideration topics.
create or replace function public.sar_save_teacher_assessment(
 p_year uuid,p_answers jsonb,p_submit boolean default false
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_school uuid;v_expected integer;v_complete integer;v_arr_count integer;v_target_count integer;
begin
 select y.school_id into v_school from public.academic_years y where y.id=p_year;
 if v_school is null or auth.uid() is null or not exists(
  select 1 from public.school_memberships m
   where m.school_id=v_school and m.user_id=auth.uid() and m.active and m.role='teacher'
 ) then raise exception 'not_authorized';end if;
 select count(*) into v_target_count from public.sar_indicator_targets st
  where st.school_id=v_school and st.academic_year_id=p_year;
 if v_target_count<>(select count(distinct section_code) from public.sar_assessment_items)
    or not exists(select 1 from public.sar_year_settings s where s.school_id=v_school
     and s.academic_year_id=p_year and s.status='published')
 then raise exception 'sar_indicator_targets_not_published';end if;
 if exists(select 1 from public.sar_teacher_submissions s where s.school_id=v_school
  and s.academic_year_id=p_year and s.teacher_user_id=auth.uid())
 then raise exception 'assessment_already_submitted';end if;
 if p_answers is null or jsonb_typeof(p_answers)<>'array' then raise exception 'answers_must_be_array';end if;
 v_arr_count=jsonb_array_length(p_answers);
 select count(*) into v_expected from public.sar_assessment_items;
 if v_arr_count>v_expected then raise exception 'too_many_answers';end if;
 if (select count(distinct x.code) from jsonb_to_recordset(p_answers)
  as x(code text,rating smallint,note text))<>v_arr_count
 then raise exception 'duplicate_answer';end if;
 if exists(select 1 from jsonb_to_recordset(p_answers) as x(code text,rating smallint,note text)
  where x.code is null or not exists(select 1 from public.sar_assessment_items i where i.code=x.code)
   or (x.rating is not null and x.rating not between 1 and 5)
   or length(coalesce(x.note,''))>2000)
 then raise exception 'invalid_answer';end if;
 insert into public.sar_teacher_assessments(school_id,academic_year_id,teacher_user_id,item_code,rating,note,updated_at)
 select v_school,p_year,auth.uid(),x.code,x.rating,btrim(coalesce(x.note,'')),now()
 from jsonb_to_recordset(p_answers) as x(code text,rating smallint,note text)
 on conflict(school_id,academic_year_id,teacher_user_id,item_code) do update
 set rating=excluded.rating,note=excluded.note,updated_at=now();
 select count(*) into v_complete from public.sar_teacher_assessments a
 where a.school_id=v_school and a.academic_year_id=p_year
  and a.teacher_user_id=auth.uid() and a.rating is not null;
 if p_submit then
  if v_complete<>v_expected then raise exception 'all_sar_items_required';end if;
  insert into public.sar_teacher_submissions(school_id,academic_year_id,teacher_user_id)
  values(v_school,p_year,auth.uid());
 end if;
 return jsonb_build_object('completed',v_complete,'expected',v_expected,'submitted',p_submit);
end $$;
revoke all on function public.sar_save_teacher_assessment(uuid,jsonb,boolean) from public,anon;
grant execute on function public.sar_save_teacher_assessment(uuid,jsonb,boolean) to authenticated;

do $$
begin
 if has_function_privilege('authenticated','public.sar_set_year_targets(uuid,smallint,smallint,text,boolean)','EXECUTE')
 or has_function_privilege('anon','public.sar_save_indicator_targets(uuid,jsonb,text,boolean)','EXECUTE')
 then raise exception 'unsafe_sar_target_access';end if;
end $$;
