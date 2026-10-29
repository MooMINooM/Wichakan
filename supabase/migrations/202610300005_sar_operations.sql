-- SAR operational modules. All historical values remain blank until a user enters or approves evidence.
create table public.sar_staff_profiles(
 school_id uuid not null references public.schools(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 name_title text not null default '',
 employment_type text not null default '',
 position_title text not null default '',
 qualification text not null default '',
 major text not null default '',
 academic_rank text not null default '',
 joined_at date,
 notes text not null default '',
 updated_at timestamptz not null default now(),
 primary key(school_id,user_id)
);
alter table public.sar_staff_profiles enable row level security;
grant select,insert,update on public.sar_staff_profiles to authenticated;
create policy sar_staff_profiles_read on public.sar_staff_profiles for select to authenticated
using(exists(select 1 from public.school_memberships m where m.school_id=sar_staff_profiles.school_id and m.user_id=(select auth.uid()) and m.active and (m.role='school_admin' or sar_staff_profiles.user_id=m.user_id)));
create policy sar_staff_profiles_insert on public.sar_staff_profiles for insert to authenticated
with check(exists(select 1 from public.school_memberships m where m.school_id=sar_staff_profiles.school_id and m.user_id=(select auth.uid()) and m.active and (m.role='school_admin' or (m.role='teacher' and sar_staff_profiles.user_id=m.user_id))));
create policy sar_staff_profiles_update on public.sar_staff_profiles for update to authenticated
using(exists(select 1 from public.school_memberships m where m.school_id=sar_staff_profiles.school_id and m.user_id=(select auth.uid()) and m.active and (m.role='school_admin' or (m.role='teacher' and sar_staff_profiles.user_id=m.user_id))))
with check(exists(select 1 from public.school_memberships m where m.school_id=sar_staff_profiles.school_id and m.user_id=(select auth.uid()) and m.active and (m.role='school_admin' or (m.role='teacher' and sar_staff_profiles.user_id=m.user_id))));

create table public.sar_evidence(
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id) on delete cascade,
 academic_year_id uuid not null references public.academic_years(id) on delete cascade,
 owner_user_id uuid not null references auth.users(id),
 kind text not null check(kind in ('achievement','training','innovation','learning_media','learning_activity','plc','assessment_instrument','project','facility','safety','other')),
 title text not null check(length(btrim(title)) between 1 and 250),
 activity_year_be integer not null check(activity_year_be between 2500 and 2800),
 activity_date date,
 description text not null default '',
 target_codes text[] not null default '{}',
 storage_path text,
 drive_url text,
 verification_status text not null default 'draft' check(verification_status in ('draft','verified','rejected')),
 verified_by uuid references auth.users(id),
 verified_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(storage_path is null or length(storage_path)<=700),
 check(drive_url is null or (length(drive_url)<=800 and drive_url ~ '^https://drive\.google\.com/'))
);
create index sar_evidence_year on public.sar_evidence(school_id,academic_year_id,owner_user_id);
alter table public.sar_evidence enable row level security;
grant select on public.sar_evidence to authenticated;
create policy sar_evidence_read on public.sar_evidence for select to authenticated
using(exists(select 1 from public.school_memberships m where m.school_id=sar_evidence.school_id and m.user_id=(select auth.uid()) and m.active and (m.role='school_admin' or sar_evidence.owner_user_id=m.user_id)));
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
 if p_id is not null then
  select * into v_existing from public.sar_evidence where id=p_id for update;
  if not found or v_existing.school_id<>v_school or v_existing.owner_user_id<>(select auth.uid()) or v_existing.verification_status<>'draft'
  then raise exception 'evidence_locked_or_not_owned';end if;
  update public.sar_evidence set kind=p_kind,title=btrim(p_title),activity_year_be=p_activity_year,activity_date=p_activity_date,
   description=coalesce(p_description,''),target_codes=coalesce(p_targets,'{}'),storage_path=p_storage_path,
   drive_url=p_drive_url,updated_at=now() where id=p_id;
 else
  insert into public.sar_evidence(id,school_id,academic_year_id,owner_user_id,kind,title,activity_year_be,activity_date,description,target_codes,storage_path,drive_url)
  values(v_id,v_school,p_year,(select auth.uid()),p_kind,btrim(p_title),p_activity_year,p_activity_date,
    coalesce(p_description,''),coalesce(p_targets,'{}'),p_storage_path,p_drive_url);
 end if;
 return v_id;
end $$;
revoke all on function public.sar_save_evidence(uuid,uuid,text,text,integer,date,text,text[],text,text) from public,anon;
grant execute on function public.sar_save_evidence(uuid,uuid,text,text,integer,date,text,text[],text,text) to authenticated;
create function public.sar_verify_evidence(p_id uuid,p_status text)
returns void language plpgsql security definer set search_path='' as $$
declare v_school uuid;
begin
 select school_id into v_school from public.sar_evidence where id=p_id;
 if v_school is null or p_status not in ('verified','rejected','draft') or not exists(
  select 1 from public.school_memberships m where m.school_id=v_school and m.user_id=(select auth.uid()) and m.active and m.role='school_admin'
 ) then raise exception 'not_authorized';end if;
 update public.sar_evidence set verification_status=p_status,
  verified_by=case when p_status='draft' then null else (select auth.uid()) end,
  verified_at=case when p_status='draft' then null else now() end,updated_at=now() where id=p_id;
end $$;
revoke all on function public.sar_verify_evidence(uuid,text) from public,anon;
grant execute on function public.sar_verify_evidence(uuid,text) to authenticated;

create table public.sar_national_tests(
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id) on delete cascade,
 academic_year_id uuid not null references public.academic_years(id) on delete cascade,
 test_kind text not null check(test_kind in ('RT','NT','O-NET','Pre-ONET','Other')),
 grade_level text not null,
 component text not null,
 participants integer check(participants is null or participants>=0),
 school_average numeric(6,2) check(school_average between 0 and 100),
 area_average numeric(6,2) check(area_average between 0 and 100),
 national_average numeric(6,2) check(national_average between 0 and 100),
 source_note text not null default '',
 updated_at timestamptz not null default now(),
 unique(school_id,academic_year_id,test_kind,grade_level,component)
);
create table public.sar_context(
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id) on delete cascade,
 academic_year_id uuid not null references public.academic_years(id) on delete cascade,
 category text not null check(category in ('school_profile','vision','mission','personnel','finance','facilities','resources','community','strengths','improvement','plans','support','projects','safety','learner_support')),
 title text not null default '',
 narrative text not null default '',
 metrics jsonb not null default '{}'::jsonb,
 source_note text not null default '',
 updated_at timestamptz not null default now(),
 unique(school_id,academic_year_id,category,title)
);
create table public.sar_indicator_measurements(
 school_id uuid not null references public.schools(id) on delete cascade,
 academic_year_id uuid not null references public.academic_years(id) on delete cascade,
 code text not null references public.sar_target_topics(code),
 numerator integer check(numerator is null or numerator>=0),
 denominator integer check(denominator is null or denominator>=0),
 manually_observed_percent numeric(5,2) check(manually_observed_percent between 0 and 100),
 source_note text not null default '',
 updated_at timestamptz not null default now(),
 primary key(school_id,academic_year_id,code),
 check(numerator is null or denominator is null or numerator<=denominator)
);
create table public.sar_quality_reviews(
 school_id uuid not null references public.schools(id) on delete cascade,
 academic_year_id uuid not null references public.academic_years(id) on delete cascade,
 code text not null references public.sar_target_topics(code),
 narrative text not null default '',
 strength text not null default '',
 improvement text not null default '',
 action_plan text not null default '',
 review_status text not null default 'draft' check(review_status in ('draft','reviewed')),
 reviewed_at timestamptz,
 reviewed_by uuid references auth.users(id),
 updated_at timestamptz not null default now(),
 primary key(school_id,academic_year_id,code)
);
create table public.sar_report_versions(
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id) on delete cascade,
 academic_year_id uuid not null references public.academic_years(id) on delete cascade,
 version_no integer not null check(version_no>0),
 snapshot jsonb not null,
 approved_by uuid not null references auth.users(id),
 approved_at timestamptz not null default now(),
 unique(school_id,academic_year_id,version_no)
);
-- Strictly read-only client: snapshots may be created only from the admin RPC.
alter table public.sar_report_versions enable row level security;
grant select on public.sar_report_versions to authenticated;
create policy sar_versions_read on public.sar_report_versions for select to authenticated
using(exists(select 1 from public.school_memberships m where m.school_id=sar_report_versions.school_id and m.user_id=(select auth.uid()) and m.active and m.role='school_admin'));

-- The data-entry tables are visible and writable only to a school admin.
do $$
declare t text;
begin
 foreach t in array array['sar_national_tests','sar_context','sar_indicator_measurements','sar_quality_reviews'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('grant select,insert,update,delete on public.%I to authenticated',t);
  execute format('create policy %I on public.%I for all to authenticated using (exists(select 1 from public.school_memberships m where m.school_id=%I.school_id and m.user_id=(select auth.uid()) and m.active and m.role=''school_admin'')) with check (exists(select 1 from public.school_memberships m where m.school_id=%I.school_id and m.user_id=(select auth.uid()) and m.active and m.role=''school_admin''))',t||'_admin',t,t,t);
 end loop;
end $$;

-- Non-public bucket with per-school/per-user paths. Accessible only to owner or school admin.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('wichakan-sar','wichakan-sar',false,10485760,
 array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do nothing;
create policy sar_storage_read on storage.objects for select to authenticated
using(bucket_id='wichakan-sar' and exists(
 select 1 from public.school_memberships m where m.school_id::text=split_part(name,'/',1)
 and m.user_id=(select auth.uid()) and m.active
 and (m.role='school_admin' or (m.role='teacher' and (select auth.uid())::text=split_part(name,'/',2)))
));
create policy sar_storage_create on storage.objects for insert to authenticated
with check(bucket_id='wichakan-sar' and split_part(name,'/',2)=(select auth.uid())::text
 and exists(select 1 from public.school_memberships m where m.school_id::text=split_part(name,'/',1)
 and m.user_id=(select auth.uid()) and m.active and m.role in ('teacher','school_admin')));
-- No client delete/overwrite: evidence files remain auditable.

create function public.sar_approve_report(p_year uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare v_school uuid;v_next integer;v_snapshot jsonb;
begin
 select school_id into v_school from public.academic_years where id=p_year;
 if v_school is null or not exists(select 1 from public.school_memberships m where m.school_id=v_school
 and m.user_id=(select auth.uid()) and m.active and m.role='school_admin')
 then raise exception 'not_authorized';end if;
 if not exists(select 1 from public.sar_year_settings s where s.school_id=v_school and s.academic_year_id=p_year and s.status='published')
 then raise exception 'targets_not_published';end if;
 -- Requires all primary topics reviewed. Avoid pretending absent evidence was assessed.
 if exists(select 1 from public.sar_target_topics t where t.code<>'overall' and not exists(
  select 1 from public.sar_quality_reviews q where q.school_id=v_school and q.academic_year_id=p_year
   and q.code=t.code and q.review_status='reviewed'))
 then raise exception 'review_all_topics_before_approval';end if;
 perform pg_advisory_xact_lock(hashtext(v_school::text||p_year::text));
 select coalesce(max(version_no),0)+1 into v_next from public.sar_report_versions
 where school_id=v_school and academic_year_id=p_year;
 select jsonb_build_object('year',y.year_be,'school',s.name_th,'captured_at',now(),
 'targets',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from public.sar_indicator_targets x where x.school_id=v_school and x.academic_year_id=p_year),
 'measurements',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from public.sar_indicator_measurements x where x.school_id=v_school and x.academic_year_id=p_year),
 'reviews',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from public.sar_quality_reviews x where x.school_id=v_school and x.academic_year_id=p_year),
 'national_tests',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from public.sar_national_tests x where x.school_id=v_school and x.academic_year_id=p_year),
 'context',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from public.sar_context x where x.school_id=v_school and x.academic_year_id=p_year),
 'evidence',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from public.sar_evidence x where x.school_id=v_school and x.academic_year_id=p_year and x.verification_status='verified'),
 'teacher_summary',(select coalesce(jsonb_agg(z),'[]'::jsonb) from (
   select item_code,count(*)::integer as n,round(avg(rating),2) as mean_rating
   from public.sar_teacher_assessments a
   join public.sar_teacher_submissions sub on sub.school_id=a.school_id and sub.academic_year_id=a.academic_year_id and sub.teacher_user_id=a.teacher_user_id
   where a.school_id=v_school and a.academic_year_id=p_year and a.rating is not null group by item_code
 ) z)
 ) into v_snapshot
 from public.academic_years y join public.schools s on s.id=y.school_id where y.id=p_year;
 insert into public.sar_report_versions(school_id,academic_year_id,version_no,snapshot,approved_by)
 values(v_school,p_year,v_next,v_snapshot,(select auth.uid()));
 return v_next;
end $$;
revoke all on function public.sar_approve_report(uuid) from public,anon;
grant execute on function public.sar_approve_report(uuid) to authenticated;
