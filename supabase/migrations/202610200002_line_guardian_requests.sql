create table if not exists public.line_guardian_invites (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id) on delete cascade,
 guardian_id uuid not null references public.guardians(id) on delete cascade,
 invite_code text not null unique default upper(encode(gen_random_bytes(16),'hex')),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '24 hours'),
 used_at timestamptz,
 unique(school_id,guardian_id,invite_code)
);
create table if not exists public.line_guardian_requests (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id) on delete cascade,
 guardian_id uuid not null references public.guardians(id) on delete cascade,
 line_user_id text not null check (length(line_user_id) between 10 and 255),
 status text not null default 'pending' check (status in ('pending','approved','rejected')),
 created_at timestamptz not null default now(),
 reviewed_at timestamptz,
 reviewed_by uuid references auth.users(id),
 unique(school_id,guardian_id,line_user_id)
);
create unique index if not exists line_pending_guardian_once on public.line_guardian_requests(school_id,guardian_id) where status='pending';
alter table public.line_guardian_invites enable row level security;
alter table public.line_guardian_requests enable row level security;
revoke all on public.line_guardian_invites,public.line_guardian_requests from anon,authenticated;
grant select on public.line_guardian_invites,public.line_guardian_requests to authenticated;
create policy "admin read line invites" on public.line_guardian_invites for select to authenticated using (exists(select 1 from public.school_memberships m where m.school_id=line_guardian_invites.school_id and m.user_id=auth.uid() and m.active and m.role='school_admin'));
create policy "admin read line requests" on public.line_guardian_requests for select to authenticated using (exists(select 1 from public.school_memberships m where m.school_id=line_guardian_requests.school_id and m.user_id=auth.uid() and m.active and m.role='school_admin'));
create or replace function public.create_line_guardian_invite(p_guardian uuid)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare v_school uuid;v_code text;
begin
 select g.school_id into v_school from public.guardians g where g.id=p_guardian;
 if v_school is null or not exists(select 1 from public.school_memberships m where m.school_id=v_school and m.user_id=auth.uid() and m.active and m.role='school_admin') then raise exception 'not_authorized';end if;
 update public.line_guardian_invites set used_at=now() where guardian_id=p_guardian and used_at is null;
 insert into public.line_guardian_invites(school_id,guardian_id,created_by) values(v_school,p_guardian,auth.uid()) returning invite_code into v_code;
 return v_code;
end $$;
revoke all on function public.create_line_guardian_invite(uuid) from public,anon;
grant execute on function public.create_line_guardian_invite(uuid) to authenticated;
create or replace function public.review_line_guardian_request(p_request uuid,p_approve boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.line_guardian_requests%rowtype;
begin
 select * into r from public.line_guardian_requests where id=p_request and status='pending' for update;
 if not found then raise exception 'request_not_pending';end if;
 if not exists(select 1 from public.school_memberships m where m.school_id=r.school_id and m.user_id=auth.uid() and m.active and m.role='school_admin') then raise exception 'not_authorized';end if;
 if p_approve then
  if exists(select 1 from public.line_guardian_accounts a where a.school_id=r.school_id and (a.guardian_id=r.guardian_id or a.line_user_id=r.line_user_id)) then raise exception 'existing_binding_requires_revoke';end if;
  insert into public.line_guardian_accounts(school_id,guardian_id,line_user_id,verified_by) values(r.school_id,r.guardian_id,r.line_user_id,auth.uid());
  insert into public.line_guardian_link_audit(school_id,guardian_id,actor_user_id,action) values(r.school_id,r.guardian_id,auth.uid(),'approved');
 end if;
 update public.line_guardian_requests set status=case when p_approve then 'approved' else 'rejected' end,reviewed_by=auth.uid(),reviewed_at=now() where id=r.id;
end $$;
revoke all on function public.review_line_guardian_request(uuid,boolean) from public,anon;
grant execute on function public.review_line_guardian_request(uuid,boolean) to authenticated;
