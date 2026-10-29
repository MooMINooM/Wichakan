-- All 57 detailed success metrics must be set for a fully published three-standard SAR target year.
create or replace function public.sar_save_indicator_targets(
 p_year uuid,p_targets jsonb,p_notes text default '',p_publish boolean default false
) returns void language plpgsql security definer set search_path='' as $$
declare v_school uuid;v_old_status text;v_expected integer;v_count integer;
begin
 select y.school_id into v_school from public.academic_years y where y.id=p_year;
 if v_school is null or (select auth.uid()) is null or not exists(
  select 1 from public.school_memberships m
  where m.school_id=v_school and m.user_id=(select auth.uid()) and m.active and m.role='school_admin'
 ) then raise exception 'not_authorized';end if;
 if p_targets is null or jsonb_typeof(p_targets)<>'array' or length(coalesce(p_notes,''))>2000
 then raise exception 'invalid_targets';end if;
 select count(*) into v_expected from public.sar_target_topics;
 v_count=jsonb_array_length(p_targets);
 if v_count>v_expected or (select count(distinct x.section_code)
  from jsonb_to_recordset(p_targets) as x(section_code text,target_percent numeric))<>v_count
 then raise exception 'duplicate_or_excess_targets';end if;
 if exists(
  select 1 from jsonb_to_recordset(p_targets) as x(section_code text,target_percent numeric)
  where x.section_code is null or x.target_percent is null
   or x.target_percent<0 or x.target_percent>100
   or not exists(select 1 from public.sar_target_topics t where t.code=x.section_code)
 ) then raise exception 'invalid_indicator_target';end if;
 if p_publish and v_count<>v_expected then raise exception 'all_indicator_targets_required';end if;
 if p_publish and (select count(*) from public.sar_success_targets d where d.school_id=v_school and d.academic_year_id=p_year)
  <>(select count(*) from public.sar_success_indicators)
 then raise exception 'all_success_targets_required';end if;
 select s.status into v_old_status from public.sar_year_settings s
 where s.school_id=v_school and s.academic_year_id=p_year for update;
 if v_old_status='published' then raise exception 'published_targets_are_locked';end if;
 delete from public.sar_indicator_targets where school_id=v_school and academic_year_id=p_year;
 insert into public.sar_indicator_targets(school_id,academic_year_id,section_code,target_percent,updated_at,updated_by)
 select v_school,p_year,x.section_code,x.target_percent,now(),(select auth.uid())
 from jsonb_to_recordset(p_targets) as x(section_code text,target_percent numeric);
 insert into public.sar_year_settings(school_id,academic_year_id,
   target_standard_2,target_standard_3,notes,status,published_at,published_by,updated_at,updated_by)
 values(v_school,p_year,null,null,btrim(coalesce(p_notes,'')),
  case when p_publish then 'published' else 'draft' end,
  case when p_publish then now() else null end,
  case when p_publish then (select auth.uid()) else null end,now(),(select auth.uid()))
 on conflict(school_id,academic_year_id) do update
 set target_standard_2=null,target_standard_3=null,notes=excluded.notes,
  status=excluded.status,published_at=excluded.published_at,published_by=excluded.published_by,
  updated_at=now(),updated_by=(select auth.uid());
end $$;

revoke all on function public.sar_save_indicator_targets(uuid,jsonb,text,boolean) from public,anon;
grant execute on function public.sar_save_indicator_targets(uuid,jsonb,text,boolean) to authenticated;
