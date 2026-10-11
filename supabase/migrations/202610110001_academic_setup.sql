-- Wichakan v0.4: manage academic years, terms and classrooms.
-- Only authenticated school_admin or academic staff may change academic setup.
create policy "academic staff create years" on public.academic_years
 for insert to authenticated with check(private.has_school_role(school_id,array['school_admin','academic']));
create policy "academic staff update years" on public.academic_years
 for update to authenticated
 using(private.has_school_role(school_id,array['school_admin','academic']))
 with check(private.has_school_role(school_id,array['school_admin','academic']));

create policy "academic staff create terms" on public.terms
 for insert to authenticated with check(private.has_school_role(school_id,array['school_admin','academic']));
create policy "staff view terms" on public.terms
 for select to authenticated
 using(private.has_school_role(school_id,array['school_admin','director','academic','registrar','teacher']));

create policy "academic staff create classrooms" on public.classrooms
 for insert to authenticated with check(private.has_school_role(school_id,array['school_admin','academic']));

-- Exactly one active academic year per school; school administrators may
-- activate an existing year via a controlled RPC.
create unique index academic_year_single_active_per_school
 on public.academic_years(school_id) where is_active = true;

create or replace function public.activate_academic_year(p_school_id uuid,p_year_id uuid)
returns void language plpgsql security invoker set search_path = ''
as $$
begin
 if not private.has_school_role(p_school_id,array['school_admin','academic']) then
  raise exception 'Access denied';
 end if;
 if not exists(select 1 from public.academic_years y where y.id=p_year_id and y.school_id=p_school_id) then
  raise exception 'Academic year is not in this school';
 end if;
 -- Prevent two competing activations within a school.
 perform pg_advisory_xact_lock(hashtextextended(p_school_id::text, 0));
 update public.academic_years set is_active = false where school_id=p_school_id and is_active;
 update public.academic_years set is_active = true where id=p_year_id and school_id=p_school_id;
end;
$$;
revoke all on function public.activate_academic_year(uuid,uuid) from public,anon;
grant execute on function public.activate_academic_year(uuid,uuid) to authenticated;
