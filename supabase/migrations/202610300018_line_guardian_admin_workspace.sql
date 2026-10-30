-- LINE OA admin workspace: read-only overview, per-child revocation and durable audit.
-- Existing student IDs and LINE account bindings are preserved.
create table if not exists public.line_student_link_audit (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id),
 student_id uuid not null references public.students(id),
 guardian_id uuid references public.guardians(id),
 actor_user_id uuid references auth.users(id),
 action text not null check (action in ('approved','rejected','revoked')),
 recorded_at timestamptz not null default now()
);
create index if not exists line_student_link_audit_school_time on public.line_student_link_audit(school_id,recorded_at desc);
alter table public.line_student_link_audit enable row level security;
revoke all on public.line_student_link_audit from public,anon,authenticated;

-- Audit every future claim decision, including resubmissions after an unlink.
create or replace function private.audit_line_claim_review()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_guardian uuid;
begin
 if new.status in ('approved','rejected') and new.reviewed_by is not null and old.status is distinct from new.status then
  select a.guardian_id into v_guardian from public.line_guardian_accounts a
  where a.school_id=new.school_id and a.line_user_id=new.line_user_id limit 1;
  insert into public.line_student_link_audit(school_id,student_id,guardian_id,actor_user_id,action)
  values(new.school_id,new.student_id,v_guardian,new.reviewed_by,new.status);
 end if;
 return new;
end $$;
revoke all on function private.audit_line_claim_review() from public,anon,authenticated;
drop trigger if exists line_claim_review_audit on public.line_student_claims;
create trigger line_claim_review_audit after update of status on public.line_student_claims
for each row execute function private.audit_line_claim_review();

create or replace function public.line_admin_guardian_overview()
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_school uuid;
begin
 select m.school_id into v_school from public.school_memberships m
 where m.user_id=auth.uid() and m.active and m.role='school_admin' order by m.id limit 1;
 if v_school is null then raise exception 'not_authorized'; end if;

 return jsonb_build_object(
  'requests',coalesce((
   select jsonb_agg(jsonb_build_object(
    'id',c.id,'student_id',c.student_id,'student_no',s.student_no,
    'student_name',concat(coalesce(s.name_prefix_th,''),s.first_name_th,' ',s.last_name_th),
    'created_at',c.created_at
   ) order by c.created_at desc,c.id)
   from public.line_student_claims c join public.students s on s.id=c.student_id
   where c.school_id=v_school and s.school_id=v_school and c.status='pending'
  ),'[]'::jsonb),
  'linked',coalesce((
   select jsonb_agg(jsonb_build_object(
    'guardian_id',a.guardian_id,'name',g.full_name_th,'verified_at',a.verified_at,
    'children',coalesce((
     select jsonb_agg(jsonb_build_object(
      'id',s.id,'student_no',s.student_no,
      'name',concat(coalesce(s.name_prefix_th,''),s.first_name_th,' ',s.last_name_th),
      'relationship',sg.relationship
     ) order by s.student_no)
     from public.student_guardians sg join public.students s on s.id=sg.student_id
     where sg.guardian_id=a.guardian_id and sg.school_id=v_school and s.school_id=v_school
    ),'[]'::jsonb)
   ) order by a.created_at,a.id)
   from public.line_guardian_accounts a join public.guardians g on g.id=a.guardian_id
   where a.school_id=v_school and g.school_id=v_school
  ),'[]'::jsonb),
  'history',coalesce((
   select jsonb_agg(jsonb_build_object(
    'id',e.event_id,'action',e.action,'recorded_at',e.recorded_at,
    'student_name',case when s.id is null then null else concat(coalesce(s.name_prefix_th,''),s.first_name_th,' ',s.last_name_th) end,
    'guardian_name',g.full_name_th,
    'actor_name',p.display_name
   ) order by e.recorded_at desc,e.event_id)
   from (
    select ('audit:'||x.id::text) as event_id,x.student_id,x.guardian_id,
           x.actor_user_id,x.action,x.recorded_at
    from public.line_student_link_audit x where x.school_id=v_school
    union all
    select ('legacy:'||c.id::text),c.student_id,a.guardian_id,c.reviewed_by,
           c.status,c.reviewed_at
    from public.line_student_claims c
    left join public.line_guardian_accounts a on a.school_id=c.school_id and a.line_user_id=c.line_user_id
    where c.school_id=v_school and c.status in ('approved','rejected') and c.reviewed_at is not null
     and not exists (
      select 1 from public.line_student_link_audit x
      where x.school_id=c.school_id and x.student_id=c.student_id
       and x.action=c.status and x.recorded_at=c.reviewed_at and x.actor_user_id=c.reviewed_by
     )
   ) e
   left join public.students s on s.id=e.student_id and s.school_id=v_school
   left join public.guardians g on g.id=e.guardian_id and g.school_id=v_school
   left join public.profiles p on p.user_id=e.actor_user_id
  ),'[]'::jsonb)
 );
end $$;
revoke all on function public.line_admin_guardian_overview() from public,anon;
grant execute on function public.line_admin_guardian_overview() to authenticated;

-- Unlink only one student, never other children of the same LINE account.
create or replace function public.line_admin_revoke_student_link(p_guardian uuid,p_student uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_school uuid; v_actor uuid:=auth.uid();
begin
 select a.school_id into v_school from public.line_guardian_accounts a
 join public.guardians g on g.id=a.guardian_id and g.school_id=a.school_id
 where a.guardian_id=p_guardian for update of a;
 if v_school is null or v_actor is null or not exists(
  select 1 from public.school_memberships m where m.school_id=v_school and m.user_id=v_actor and m.role='school_admin' and m.active
 ) then raise exception 'not_authorized'; end if;
 if not exists(select 1 from public.students s where s.id=p_student and s.school_id=v_school) then
  raise exception 'student_not_found';
 end if;
 perform 1 from public.student_guardians sg
 where sg.school_id=v_school and sg.guardian_id=p_guardian and sg.student_id=p_student for update;
 if not found then raise exception 'link_not_found'; end if;
 delete from public.student_guardians sg where sg.school_id=v_school and sg.guardian_id=p_guardian and sg.student_id=p_student;
 insert into public.line_student_link_audit(school_id,student_id,guardian_id,actor_user_id,action)
 values(v_school,p_student,p_guardian,v_actor,'revoked');
 if not exists(select 1 from public.student_guardians sg where sg.school_id=v_school and sg.guardian_id=p_guardian) then
  delete from public.line_guardian_accounts a where a.school_id=v_school and a.guardian_id=p_guardian;
  insert into public.line_guardian_link_audit(school_id,guardian_id,actor_user_id,action)
  values(v_school,p_guardian,v_actor,'revoked');
 end if;
end $$;
revoke all on function public.line_admin_revoke_student_link(uuid,uuid) from public,anon;
grant execute on function public.line_admin_revoke_student_link(uuid,uuid) to authenticated;

-- Re-claim after an explicit revocation/rejection; never replace an active link.
-- Retain original rate limiting and fixed-size citizen-ID verification batches.
create or replace function public.request_line_registration_batch(
 p_line_user_id text,p_citizen_id text,p_offset integer default 0,p_limit integer default 10
) returns text language plpgsql security definer set search_path='' as $$
declare v_count integer; v_seen integer:=0; v_match record;
begin
 if auth.role()<>'service_role' then raise exception 'forbidden'; end if;
 if p_line_user_id is null or length(p_line_user_id) not between 10 and 255
    or p_citizen_id !~ '^[0-9]{13}$' or p_offset<0 or p_offset>10000
    or p_limit<1 or p_limit>15 then return 'invalid'; end if;
 if p_offset=0 then
   select count(*) into v_count from private.line_registration_attempts
   where line_user_id=p_line_user_id and attempted_at>now()-interval '1 hour';
   if v_count>=5 then return 'rate_limited'; end if;
   insert into private.line_registration_attempts(line_user_id) values(p_line_user_id);
 end if;
 for v_match in
   select v.school_id,v.student_id,v.verifier from private.student_citizen_verifiers v
   join public.students s on s.id=v.student_id and s.status='active'
   order by v.student_id offset p_offset limit p_limit
 loop
   v_seen:=v_seen+1;
   if extensions.crypt(p_citizen_id,v_match.verifier)=v_match.verifier then
     insert into public.line_student_claims(school_id,student_id,line_user_id)
     values(v_match.school_id,v_match.student_id,p_line_user_id)
     on conflict(school_id,student_id,line_user_id) do update
       set status='pending',created_at=now(),reviewed_at=null,reviewed_by=null
     where line_student_claims.status<>'pending'
       and not exists (
        select 1 from public.student_guardians sg
        join public.line_guardian_accounts a on a.guardian_id=sg.guardian_id
        where sg.school_id=excluded.school_id and sg.student_id=excluded.student_id
          and a.school_id=excluded.school_id and a.line_user_id=excluded.line_user_id
       );
     return 'received';
   end if;
 end loop;
 if v_seen=0 then return 'done'; end if;
 return 'continue';
end $$;
revoke all on function public.request_line_registration_batch(text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.request_line_registration_batch(text,text,integer,integer) to service_role;
