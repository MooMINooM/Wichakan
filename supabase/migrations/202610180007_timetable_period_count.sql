create table if not exists public.timetable_term_settings(
 term_id uuid primary key references public.terms(id),
 school_id uuid not null references public.schools(id),
 periods_per_day integer not null default 8 check(periods_per_day between 1 and 20),
 updated_by uuid not null,
 updated_at timestamptz not null default now()
);
alter table public.timetable_term_settings enable row level security;
create policy timetable_term_settings_read on public.timetable_term_settings for select to authenticated using(exists(select 1 from public.school_memberships m where m.school_id=timetable_term_settings.school_id and m.user_id=auth.uid() and m.active));
grant select on public.timetable_term_settings to authenticated;
create or replace function public.set_timetable_period_count(p_term_id uuid,p_count integer)
returns void language plpgsql security definer set search_path='' as $$
declare v_school uuid;
begin
 select school_id into v_school from public.terms where id=p_term_id;
 if v_school is null or auth.uid() is null or not private.has_school_role(v_school,array['school_admin','academic']) then raise exception 'Not authorized';end if;
 if p_count not between 1 and 20 then raise exception 'Period count must be between 1 and 20';end if;
 perform pg_advisory_xact_lock(hashtext(p_term_id::text));
 if exists(select 1 from public.timetable_slots where term_id=p_term_id and period_no>p_count) then raise exception 'Move scheduled lessons beyond the new last period before reducing period count';end if;
 if exists(select 1 from public.timetable_rules where term_id=p_term_id and period_no>p_count) then raise exception 'Remove constraints beyond the new last period before reducing period count';end if;
 insert into public.timetable_term_settings(term_id,school_id,periods_per_day,updated_by) values(p_term_id,v_school,p_count,auth.uid())
 on conflict(term_id) do update set periods_per_day=excluded.periods_per_day,updated_at=now(),updated_by=auth.uid();
end $$;
revoke all on function public.set_timetable_period_count(uuid,integer) from public,anon;
grant execute on function public.set_timetable_period_count(uuid,integer) to authenticated;
create or replace function public.timetable_period_limit_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if new.period_no>coalesce((select periods_per_day from public.timetable_term_settings where term_id=new.term_id),8) then raise exception 'Period exceeds timetable daily limit';end if;
 return new;
end $$;
create trigger timetable_period_limit_guard before insert or update on public.timetable_slots for each row execute function public.timetable_period_limit_guard();