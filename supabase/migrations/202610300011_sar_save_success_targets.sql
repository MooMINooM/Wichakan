-- Transactional save for all detailed SAR targets in one academic-year draft.
create function public.sar_save_success_targets(p_year uuid,p_values jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare v_school uuid;v_count integer;
begin
 select school_id into v_school from public.academic_years where id=p_year;
 if v_school is null or not exists(select 1 from public.school_memberships m
  where m.school_id=v_school and m.user_id=(select auth.uid()) and m.active and m.role='school_admin')
 then raise exception 'not_authorized';end if;
 if exists(select 1 from public.sar_year_settings s
  where s.school_id=v_school and s.academic_year_id=p_year and s.status='published')
 then raise exception 'published_targets_are_locked';end if;
 if p_values is null or jsonb_typeof(p_values)<>'array' then raise exception 'invalid_targets';end if;
 v_count=jsonb_array_length(p_values);
 if v_count>(select count(*) from public.sar_success_indicators)
  or v_count<>(select count(distinct code) from jsonb_to_recordset(p_values) as x(code text,target_percent numeric))
 then raise exception 'duplicate_or_excess_targets';end if;
 if exists(select 1 from jsonb_to_recordset(p_values) as x(code text,target_percent numeric)
  where x.code is null or x.target_percent is null or x.target_percent<0 or x.target_percent>100
   or not exists(select 1 from public.sar_success_indicators i where i.code=x.code))
 then raise exception 'invalid_success_target';end if;
 delete from public.sar_success_targets where school_id=v_school and academic_year_id=p_year;
 insert into public.sar_success_targets(school_id,academic_year_id,indicator_code,target_percent)
 select v_school,p_year,x.code,x.target_percent
 from jsonb_to_recordset(p_values) as x(code text,target_percent numeric);
 return v_count;
end $$;
revoke all on function public.sar_save_success_targets(uuid,jsonb) from public,anon;
grant execute on function public.sar_save_success_targets(uuid,jsonb) to authenticated;
