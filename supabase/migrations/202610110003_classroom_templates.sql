-- Permanent classroom templates, with year-specific classroom instances preserved.
create table public.classroom_templates (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id),
 level_code text not null,
 room_code text not null,
 is_active boolean not null default true,
 created_at timestamptz not null default now(),
 unique(school_id,level_code,room_code)
);
alter table public.classroom_templates enable row level security;
create policy "staff read classroom templates" on public.classroom_templates
 for select to authenticated
 using (private.has_school_role(school_id,array['school_admin','academic','director','registrar','teacher']));
create policy "academic insert classroom templates" on public.classroom_templates
 for insert to authenticated
 with check(private.has_school_role(school_id,array['school_admin','academic']));
create policy "academic update classroom templates" on public.classroom_templates
 for update to authenticated
 using(private.has_school_role(school_id,array['school_admin','academic']))
 with check(private.has_school_role(school_id,array['school_admin','academic']));

-- Import structures once from an existing year. Does not touch enrollments.
create or replace function public.import_classroom_templates(p_school_id uuid,p_year_id uuid)
returns integer language plpgsql security invoker set search_path = ''
as $$
declare v_added integer;
begin
 if not private.has_school_role(p_school_id,array['school_admin','academic']) then raise exception 'Access denied'; end if;
 if not exists(select 1 from public.academic_years where id=p_year_id and school_id=p_school_id) then raise exception 'Invalid year'; end if;
 insert into public.classroom_templates(school_id,level_code,room_code)
 select school_id,level_code,room_code from public.classrooms
 where school_id=p_school_id and academic_year_id=p_year_id
 on conflict(school_id,level_code,room_code) do nothing;
 get diagnostics v_added = row_count;
 return v_added;
end;
$$;
revoke all on function public.import_classroom_templates(uuid,uuid) from public,anon;
grant execute on function public.import_classroom_templates(uuid,uuid) to authenticated;

-- Idempotent preparation: inserts only missing rooms, never students or previous academic data.
create or replace function public.prepare_year_classrooms(p_school_id uuid,p_year_id uuid)
returns integer language plpgsql security invoker set search_path = ''
as $$
declare v_added integer;
begin
 if not private.has_school_role(p_school_id,array['school_admin','academic']) then raise exception 'Access denied'; end if;
 if not exists(select 1 from public.academic_years where id=p_year_id and school_id=p_school_id) then raise exception 'Invalid year'; end if;
 insert into public.classrooms(school_id,academic_year_id,level_code,room_code)
 select t.school_id,p_year_id,t.level_code,t.room_code
 from public.classroom_templates t where t.school_id=p_school_id and t.is_active
 on conflict(academic_year_id,level_code,room_code) do nothing;
 get diagnostics v_added = row_count;
 return v_added;
end;
$$;
revoke all on function public.prepare_year_classrooms(uuid,uuid) from public,anon;
grant execute on function public.prepare_year_classrooms(uuid,uuid) to authenticated;
