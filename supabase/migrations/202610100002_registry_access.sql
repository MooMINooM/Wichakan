-- Security policies for initial staff-facing student registry.
-- Bootstrap: an operator with secure administrative DB access must provision
-- profiles and school_memberships for existing auth users. Never expose service_role keys.
create schema if not exists private;
create or replace function private.has_school_role(p_school_id uuid,p_roles text[])
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists(
    select 1 from public.school_memberships m
    where m.school_id=p_school_id and m.user_id=(select auth.uid())
      and m.active=true and m.role=any(p_roles)
  );
$$;
revoke all on function private.has_school_role(uuid,text[]) from public;
grant usage on schema private to authenticated;
grant execute on function private.has_school_role(uuid,text[]) to authenticated;

create policy "members can read own memberships" on public.school_memberships
for select to authenticated using (user_id=(select auth.uid()));

create policy "members can read their schools" on public.schools
for select to authenticated
using (private.has_school_role(id,array['school_admin','director','academic','registrar','teacher']));

create policy "school staff can read students" on public.students
for select to authenticated
using (private.has_school_role(school_id,array['school_admin','director','academic','registrar','teacher']));

create policy "registrars can insert students" on public.students
for insert to authenticated
with check (private.has_school_role(school_id,array['school_admin','registrar']));

create policy "registrars can update students" on public.students
for update to authenticated
using (private.has_school_role(school_id,array['school_admin','registrar']))
with check (private.has_school_role(school_id,array['school_admin','registrar']));

-- No DELETE policy. Transfers and graduation are lifecycle changes, not deletion.
-- All other tables remain deny-by-default pending domain-specific access design.
