-- Limit autonomous LINE attempts per LINE user, without exposing school or student data.
create table if not exists private.line_registration_attempts (
 line_user_id text not null,
 attempted_at timestamptz not null default now()
);
revoke all on private.line_registration_attempts from public,anon,authenticated;
create index if not exists line_registration_attempts_lookup on private.line_registration_attempts(line_user_id,attempted_at);
-- Service-role-only function. It performs a fixed number of bounded bcrypt comparisons.
create or replace function public.request_line_registration(p_line_user_id text,p_citizen_id text)
returns text language plpgsql security definer set search_path='' as $$
declare v_count int; v_match record; v_guardian uuid;v_school uuid;
begin
 if auth.role()<>'service_role' then raise exception 'forbidden';end if;
 if p_line_user_id is null or length(p_line_user_id) not between 10 and 255 or p_citizen_id !~ '^[0-9]{13}$' then return 'invalid';end if;
 select count(*) into v_count from private.line_registration_attempts where line_user_id=p_line_user_id and attempted_at>now()-interval '1 hour';
 if v_count>=5 then return 'rate_limited';end if;
 insert into private.line_registration_attempts(line_user_id) values(p_line_user_id);
 select v.school_id,v.student_id into v_match from private.student_citizen_verifiers v
 join public.students s on s.id=v.student_id and s.status='active'
 where extensions.crypt(p_citizen_id,v.verifier)=v.verifier
 limit 1;
 if not found then return 'received';end if;
 v_school=v_match.school_id;
 -- A known citizen ID creates a pending request only, not a guardian binding.
 -- Same LINE account may have multiple children and each student gets an independent review.
 insert into public.line_student_claims(school_id,student_id,line_user_id)
 values(v_school,v_match.student_id,p_line_user_id)
 on conflict (school_id,student_id,line_user_id) do nothing;
 return 'received';
end $$;
revoke all on function public.request_line_registration(text,text) from public,anon,authenticated;
grant execute on function public.request_line_registration(text,text) to service_role;
create table if not exists public.line_student_claims (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id) on delete cascade,
 student_id uuid not null references public.students(id) on delete cascade,
 line_user_id text not null,
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 created_at timestamptz not null default now(),
 reviewed_at timestamptz,
 reviewed_by uuid references auth.users(id),
 unique(school_id,student_id,line_user_id)
);
alter table public.line_student_claims enable row level security;
revoke all on public.line_student_claims from anon,authenticated;
grant select on public.line_student_claims to authenticated;
create policy "line student claims admin read" on public.line_student_claims for select to authenticated using(exists(select 1 from public.school_memberships m where m.school_id=line_student_claims.school_id and m.user_id=auth.uid() and m.active and m.role='school_admin'));
