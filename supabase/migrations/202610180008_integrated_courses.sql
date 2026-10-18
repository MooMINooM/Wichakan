create table if not exists public.timetable_course_integrations (
 integrated_offering_id uuid primary key references public.course_offerings(id) on delete cascade,
 host_offering_id uuid not null references public.course_offerings(id) on delete cascade,
 school_id uuid not null references public.schools(id),
 term_id uuid not null references public.terms(id),
 created_by uuid not null,
 created_at timestamptz not null default now(),
 check (integrated_offering_id<>host_offering_id)
);
create index if not exists timetable_integrations_host on public.timetable_course_integrations(host_offering_id);
alter table public.timetable_course_integrations enable row level security;
create policy timetable_integrations_read on public.timetable_course_integrations for select to authenticated using(exists(select 1 from public.school_memberships m where m.school_id=timetable_course_integrations.school_id and m.user_id=auth.uid() and m.active));
grant select on public.timetable_course_integrations to authenticated;
create or replace function public.set_course_integration(p_integrated uuid,p_host uuid default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_school uuid;v_term uuid;v_room uuid;v_host_school uuid;v_host_term uuid;v_host_room uuid;
begin
 select school_id,term_id,classroom_id into v_school,v_term,v_room from public.course_offerings where id=p_integrated;
 if v_school is null or auth.uid() is null or not private.has_school_role(v_school,array['school_admin','academic']) then raise exception 'Not authorized';end if;
 perform pg_advisory_xact_lock(hashtext(v_term::text));
 if p_host is null then
  delete from public.timetable_course_integrations where integrated_offering_id=p_integrated and school_id=v_school;
  return;
 end if;
 select school_id,term_id,classroom_id into v_host_school,v_host_term,v_host_room from public.course_offerings where id=p_host;
 if p_host=p_integrated or v_host_school is distinct from v_school or v_host_term is distinct from v_term or v_host_room is distinct from v_room then raise exception 'Integrated and host courses must share term and classroom';end if;
 if exists(select 1 from public.timetable_course_integrations where integrated_offering_id=p_host) then raise exception 'Host must be a directly timetabled course';end if;
 if exists(select 1 from public.timetable_course_integrations where host_offering_id=p_integrated and integrated_offering_id<>p_integrated) then raise exception 'Cannot convert a course hosting integrations into an integrated course';end if;
 if exists(select 1 from public.timetable_slots where course_offering_id=p_integrated) then raise exception 'Move or remove dedicated lessons before integrating this course';end if;
 insert into public.timetable_course_integrations(integrated_offering_id,host_offering_id,school_id,term_id,created_by)
 values(p_integrated,p_host,v_school,v_term,auth.uid())
 on conflict(integrated_offering_id) do update set host_offering_id=excluded.host_offering_id,created_by=auth.uid(),created_at=now();
end $$;
revoke all on function public.set_course_integration(uuid,uuid) from public,anon;
grant execute on function public.set_course_integration(uuid,uuid) to authenticated;
create or replace function public.timetable_reject_integrated_slot()
returns trigger language plpgsql set search_path='' as $$
begin
 if exists(select 1 from public.timetable_course_integrations where integrated_offering_id=new.course_offering_id) then raise exception 'Integrated course uses its host timetable; remove integration before adding a dedicated period';end if;
 return new;
end $$;
create trigger timetable_integrated_slot_guard before insert or update on public.timetable_slots for each row execute function public.timetable_reject_integrated_slot();