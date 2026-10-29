-- Idempotently allow client-generated evidence UUIDs so the protected file folder can be allocated before upload.
create or replace function public.sar_save_evidence(p_year uuid,p_id uuid,p_kind text,p_title text,p_activity_year integer,p_activity_date date,p_description text,p_targets text[],p_storage_path text,p_drive_url text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_school uuid;v_id uuid;v_existing public.sar_evidence;
begin
 select school_id into v_school from public.academic_years where id=p_year;
 if v_school is null or not exists(select 1 from public.school_memberships m where m.school_id=v_school and m.user_id=(select auth.uid()) and m.active and m.role in ('teacher','school_admin'))
 then raise exception 'not_authorized';end if;
 if p_kind not in ('achievement','training','innovation','learning_media','learning_activity','plc','assessment_instrument','project','facility','safety','other')
 or length(btrim(coalesce(p_title,''))) not between 1 and 250
 or p_activity_year not between 2500 and 2800 or length(coalesce(p_description,''))>6000
 or coalesce(array_length(p_targets,1),0)>30
 or exists(select 1 from unnest(coalesce(p_targets,'{}'::text[])) code where not exists(select 1 from public.sar_target_topics x where x.code=code))
 or (p_drive_url is not null and (length(p_drive_url)>800 or p_drive_url !~ '^https://drive\.google\.com/'))
 then raise exception 'invalid_evidence';end if;
 v_id:=coalesce(p_id,gen_random_uuid());
 if p_storage_path is not null and (length(p_storage_path)>700
  or p_storage_path not like v_school::text||'/'||(select auth.uid())::text||'/'||v_id::text||'/%')
 then raise exception 'invalid_file_path';end if;
 select * into v_existing from public.sar_evidence where id=v_id for update;
 if found then
  if v_existing.school_id<>v_school or v_existing.academic_year_id<>p_year or v_existing.owner_user_id<>(select auth.uid()) or v_existing.verification_status<>'draft'
  then raise exception 'evidence_locked_or_not_owned';end if;
  update public.sar_evidence set kind=p_kind,title=btrim(p_title),activity_year_be=p_activity_year,activity_date=p_activity_date,
   description=coalesce(p_description,''),target_codes=coalesce(p_targets,'{}'),storage_path=p_storage_path,
   drive_url=p_drive_url,updated_at=now() where id=v_id;
 else
  insert into public.sar_evidence(id,school_id,academic_year_id,owner_user_id,kind,title,activity_year_be,activity_date,description,target_codes,storage_path,drive_url)
  values(v_id,v_school,p_year,(select auth.uid()),p_kind,btrim(p_title),p_activity_year,p_activity_date,
    coalesce(p_description,''),coalesce(p_targets,'{}'),p_storage_path,p_drive_url);
 end if;
 return v_id;
end $$;

revoke all on function public.sar_save_evidence(uuid,uuid,text,text,integer,date,text,text[],text,text) from public,anon;
grant execute on function public.sar_save_evidence(uuid,uuid,text,text,integer,date,text,text[],text,text) to authenticated;
