-- Durable per-student LINE link audit. The client only gets school-scoped SELECT.
create table if not exists public.line_guardian_child_audit(
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id),
 guardian_id uuid not null references public.guardians(id),
 student_id uuid not null references public.students(id),
 actor_user_id uuid references auth.users(id),
 action text not null check(action in ('approved','revoked')),
 recorded_at timestamptz not null default now()
);
alter table public.line_guardian_child_audit enable row level security;
do $$
begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='line_guardian_child_audit' and policyname='admin read guardian child audit') then
  create policy "admin read guardian child audit" on public.line_guardian_child_audit for select to authenticated using(
   exists(select 1 from public.school_memberships m where m.school_id=line_guardian_child_audit.school_id and m.user_id=auth.uid() and m.active and m.role='school_admin'));
 end if;
end $$;
grant select on public.line_guardian_child_audit to authenticated;
