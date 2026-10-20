-- Guardian identity is approved by school staff before LINE can access any student record.
-- No policy permits anonymous users or teachers to read LINE identifiers.
create table if not exists public.line_guardian_accounts (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id) on delete cascade,
 guardian_id uuid not null references public.guardians(id) on delete cascade,
 line_user_id text not null check (length(line_user_id) between 10 and 255),
 verified_at timestamptz not null default now(),
 verified_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 unique (school_id, guardian_id),
 unique (school_id, line_user_id)
);
create index if not exists line_guardian_accounts_guardian_idx on public.line_guardian_accounts(guardian_id);
alter table public.line_guardian_accounts enable row level security;
revoke all on public.line_guardian_accounts from anon, authenticated;
grant select, insert, update, delete on public.line_guardian_accounts to authenticated;
create policy "line guardian account admin select" on public.line_guardian_accounts
 for select to authenticated using (exists (
 select 1 from public.school_memberships m where m.school_id=line_guardian_accounts.school_id
 and m.user_id=auth.uid() and m.active and m.role='school_admin'
));
create policy "line guardian account admin insert" on public.line_guardian_accounts
 for insert to authenticated with check (exists (
 select 1 from public.school_memberships m where m.school_id=line_guardian_accounts.school_id
 and m.user_id=auth.uid() and m.active and m.role='school_admin'
));
create policy "line guardian account admin update" on public.line_guardian_accounts
 for update to authenticated using (exists (
 select 1 from public.school_memberships m where m.school_id=line_guardian_accounts.school_id
 and m.user_id=auth.uid() and m.active and m.role='school_admin'
)) with check (exists (
 select 1 from public.school_memberships m where m.school_id=line_guardian_accounts.school_id
 and m.user_id=auth.uid() and m.active and m.role='school_admin'
));
create policy "line guardian account admin delete" on public.line_guardian_accounts
 for delete to authenticated using (exists (
 select 1 from public.school_memberships m where m.school_id=line_guardian_accounts.school_id
 and m.user_id=auth.uid() and m.active and m.role='school_admin'
));
-- Reviewable audit of approved and revoked bindings. No student score data is stored here.
create table if not exists public.line_guardian_link_audit (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id) on delete cascade,
 guardian_id uuid not null references public.guardians(id) on delete cascade,
 actor_user_id uuid references auth.users(id),
 action text not null check (action in ('approved','revoked')),
 recorded_at timestamptz not null default now()
);
alter table public.line_guardian_link_audit enable row level security;
revoke all on public.line_guardian_link_audit from anon, authenticated;
grant select, insert on public.line_guardian_link_audit to authenticated;
create policy "line guardian audit admin select" on public.line_guardian_link_audit
 for select to authenticated using (exists (
 select 1 from public.school_memberships m where m.school_id=line_guardian_link_audit.school_id
 and m.user_id=auth.uid() and m.active and m.role='school_admin'
));
create policy "line guardian audit admin insert" on public.line_guardian_link_audit
 for insert to authenticated with check (exists (
 select 1 from public.school_memberships m where m.school_id=line_guardian_link_audit.school_id
 and m.user_id=auth.uid() and m.active and m.role='school_admin'
) and actor_user_id=auth.uid());
