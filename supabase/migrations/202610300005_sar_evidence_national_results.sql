-- SAR evidence register (Drive links are recorded, NOT uploaded by this release).
-- Every item is school/year scoped and contains no student ID or secret credentials.
create table public.sar_evidence (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id) on delete cascade,
 academic_year_id uuid not null references public.academic_years(id) on delete cascade,
 owner_user_id uuid not null references auth.users(id),
 category text not null check(category in ('award','training','innovation','teaching','plc','environment','management','assessment','other')),
 activity_title text not null check(length(activity_title) between 1 and 250),
 activity_year_be integer not null check(activity_year_be between 2500 and 2800),
 activity_date date,
 description text not null default '' check(length(description)<=4000),
 drive_url text not null default '' check(length(drive_url)<=1200),
 topic_codes text[] not null default '{}',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index sar_evidence_year_owner on public.sar_evidence(school_id,academic_year_id,owner_user_id);
alter table public.sar_evidence enable row level security;
revoke all on public.sar_evidence from anon,authenticated;
grant select on public.sar_evidence to authenticated;
create policy "sar_evidence_owner_or_school_admin" on public.sar_evidence for select to authenticated
 using(exists(select 1 from public.school_memberships m where m.school_id=sar_evidence.school_id
 and m.user_id=(select auth.uid()) and m.active and
 (m.role='school_admin' or m.user_id=sar_evidence.owner_user_id)));

create or replace function public.sar_save_evidence(
 p_id uuid,p_year uuid,p_owner uuid,p_category text,p_title text,p_activity_year integer,
 p_activity_date date,p_description text,p_drive_url text,p_topics text[]
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_school uuid;v_role text;v_id uuid;v_url text:=btrim(coalesce(p_drive_url,''));v_topics text[]:=coalesce(p_topics,'{}');
begin
 select y.school_id into v_school from public.academic_years y where y.id=p_year;
 select m.role into v_role from public.school_memberships m where m.school_id=v_school
 and m.user_id=(select auth.uid()) and m.active and m.role in ('teacher','school_admin')
 order by case when m.role='school_admin' then 0 else 1 end limit 1;
 if v_role is null or p_owner is null or
 not exists(select 1 from public.school_memberships m where m.school_id=v_school
 and m.user_id=p_owner and m.active and m.role in ('teacher','school_admin'))
 or (v_role='teacher' and p_owner<>(select auth.uid())) then raise exception 'not_authorized';end if;
 if p_category not in ('award','training','innovation','teaching','plc','environment','management','assessment','other')
 or length(btrim(coalesce(p_title,''))) not between 1 and 250 or p_activity_year not between 2500 and 2800
 or length(coalesce(p_description,''))>4000 or length(v_url)>1200
 or (v_url<>'' and v_url !~* '^https://(drive|docs)[.]google[.]com/') then raise exception 'invalid_evidence';end if;
 if exists(select 1 from unnest(v_topics) t where not exists(select 1 from public.sar_target_topics c where c.code=t))
 then raise exception 'invalid_target_code';end if;
 if p_id is null then
  insert into public.sar_evidence(school_id,academic_year_id,owner_user_id,category,
  activity_title,activity_year_be,activity_date,description,drive_url,topic_codes)
  values(v_school,p_year,p_owner,p_category,btrim(p_title),p_activity_year,p_activity_date,
  btrim(coalesce(p_description,'')),v_url,v_topics) returning id into v_id;
 else
  update public.sar_evidence set category=p_category,activity_title=btrim(p_title),
   activity_year_be=p_activity_year,activity_date=p_activity_date,
   description=btrim(coalesce(p_description,'')),drive_url=v_url,
   topic_codes=v_topics,updated_at=now()
  where id=p_id and school_id=v_school and academic_year_id=p_year
    and owner_user_id=p_owner returning id into v_id;
  if v_id is null then raise exception 'evidence_not_found_or_forbidden';end if;
 end if;
 return v_id;
end $$;
revoke all on function public.sar_save_evidence(uuid,uuid,uuid,text,text,integer,date,text,text,text[]) from public,anon;
grant execute on function public.sar_save_evidence(uuid,uuid,uuid,text,text,integer,date,text,text,text[]) to authenticated;

create or replace function public.sar_delete_evidence(p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if (select auth.uid()) is null or not exists(
  select 1 from public.sar_evidence e join public.school_memberships m on m.school_id=e.school_id
  where e.id=p_id and m.user_id=(select auth.uid()) and m.active
  and (m.role='school_admin' or (m.role='teacher' and e.owner_user_id=(select auth.uid())))
 ) then raise exception 'not_authorized';end if;
 delete from public.sar_evidence where id=p_id;
end $$;
revoke all on function public.sar_delete_evidence(uuid) from public,anon;
grant execute on function public.sar_delete_evidence(uuid) to authenticated;

create table public.sar_national_results(
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id) on delete cascade,
 academic_year_id uuid not null references public.academic_years(id) on delete cascade,
 exam text not null check(exam in ('RT','NT','O-NET')),
 grade_level text not null check(grade_level in ('ป.1','ป.3','ป.6','ม.3')),
 subject_or_domain text not null check(length(subject_or_domain) between 1 and 150),
 participant_count integer check(participant_count>=0),
 school_mean numeric(6,2) check(school_mean between 0 and 100),
 province_mean numeric(6,2) check(province_mean between 0 and 100),
 national_mean numeric(6,2) check(national_mean between 0 and 100),
 source_note text not null default '' check(length(source_note)<=1200),
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id),
 unique(school_id,academic_year_id,exam,grade_level,subject_or_domain),
 check((exam='RT' and grade_level='ป.1') or (exam='NT' and grade_level='ป.3')
 or (exam='O-NET' and grade_level in ('ป.6','ม.3')))
);
alter table public.sar_national_results enable row level security;
revoke all on public.sar_national_results from anon,authenticated;
grant select on public.sar_national_results to authenticated;
create policy "sar_national_results_admin_read" on public.sar_national_results for select to authenticated
 using(exists(select 1 from public.school_memberships m where m.school_id=sar_national_results.school_id
 and m.user_id=(select auth.uid()) and m.active and m.role='school_admin'));

create or replace function public.sar_save_national_result(
 p_year uuid,p_exam text,p_grade text,p_subject text,
 p_participants integer,p_school_mean numeric,p_province_mean numeric,p_national_mean numeric,p_source text
) returns void language plpgsql security definer set search_path='' as $$
declare v_school uuid;
begin
 select school_id into v_school from public.academic_years where id=p_year;
 if v_school is null or not exists(select 1 from public.school_memberships m where m.school_id=v_school
 and m.user_id=(select auth.uid()) and m.active and m.role='school_admin')
 then raise exception 'not_authorized';end if;
 insert into public.sar_national_results(school_id,academic_year_id,exam,grade_level,
  subject_or_domain,participant_count,school_mean,province_mean,national_mean,source_note,updated_by)
 values(v_school,p_year,p_exam,p_grade,btrim(p_subject),p_participants,p_school_mean,p_province_mean,
  p_national_mean,btrim(coalesce(p_source,'')),(select auth.uid()))
 on conflict(school_id,academic_year_id,exam,grade_level,subject_or_domain)
 do update set participant_count=excluded.participant_count,school_mean=excluded.school_mean,
  province_mean=excluded.province_mean,national_mean=excluded.national_mean,
  source_note=excluded.source_note,updated_at=now(),updated_by=(select auth.uid());
end $$;
revoke all on function public.sar_save_national_result(uuid,text,text,text,integer,numeric,numeric,numeric,text) from public,anon;
grant execute on function public.sar_save_national_result(uuid,text,text,text,integer,numeric,numeric,numeric,text) to authenticated;

do $$
begin
 if has_function_privilege('anon','public.sar_save_national_result(uuid,text,text,text,integer,numeric,numeric,numeric,text)','EXECUTE')
 or has_function_privilege('anon','public.sar_save_evidence(uuid,uuid,uuid,text,text,integer,date,text,text,text[])','EXECUTE')
 then raise exception 'SAR anonymous write exposed';end if;
end $$;
