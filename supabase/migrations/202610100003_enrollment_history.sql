-- Wichakan v0.3: year-specific enrollments and immutable movement history.
-- Built for a development database. The previous migrations must exist.

create table public.enrollment_events (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id),
 enrollment_id uuid not null references public.enrollments(id),
 student_id uuid not null,
 academic_year_id uuid not null,
 event_type text not null check(event_type in ('admitted','room_changed','status_changed')),
 previous_classroom_id uuid,
 new_classroom_id uuid,
 previous_status text,
 new_status text not null,
 reason text,
 actor_user_id uuid not null,
 recorded_at timestamptz not null default now(),
 foreign key(student_id,school_id) references public.students(id,school_id),
 foreign key(academic_year_id,school_id) references public.academic_years(id,school_id)
);
create index enrollment_events_student_idx on public.enrollment_events(school_id,student_id,recorded_at desc);
create index enrollments_school_year_idx on public.enrollments(school_id,academic_year_id);

create or replace function private.log_enrollment_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid;
begin
 v_actor := auth.uid();
 if v_actor is null then raise exception 'Authenticated actor required'; end if;
 if tg_op = 'UPDATE' and (new.school_id,new.student_id,new.academic_year_id,new.id)
   is distinct from (old.school_id,old.student_id,old.academic_year_id,old.id) then
   raise exception 'Enrollment identity/year cannot be changed';
 end if;
 if tg_op = 'INSERT' then
  insert into public.enrollment_events(school_id,enrollment_id,student_id,academic_year_id,event_type,new_classroom_id,new_status,actor_user_id)
  values(new.school_id,new.id,new.student_id,new.academic_year_id,'admitted',new.classroom_id,new.status,v_actor);
 elsif (old.classroom_id,old.status) is distinct from (new.classroom_id,new.status) then
  insert into public.enrollment_events(school_id,enrollment_id,student_id,academic_year_id,event_type,previous_classroom_id,new_classroom_id,previous_status,new_status,reason,actor_user_id)
  values(new.school_id,new.id,new.student_id,new.academic_year_id,
    case when old.classroom_id is distinct from new.classroom_id then 'room_changed' else 'status_changed' end,
    old.classroom_id,new.classroom_id,old.status,new.status,
    nullif(current_setting('wichakan.change_reason',true),''),v_actor);
 end if;
 return new;
end; $$;

create trigger enrollment_change_history after insert or update on public.enrollments
for each row execute function private.log_enrollment_change();

alter table public.enrollment_events enable row level security;
-- Staff can read history, but clients cannot mutate the event log.
create policy "school staff view enrollment events" on public.enrollment_events
for select to authenticated using(private.has_school_role(school_id,array['school_admin','director','academic','registrar','teacher']));

create policy "school staff view years" on public.academic_years
for select to authenticated using(private.has_school_role(school_id,array['school_admin','director','academic','registrar','teacher']));
create policy "school staff view classrooms" on public.classrooms
for select to authenticated using(private.has_school_role(school_id,array['school_admin','director','academic','registrar','teacher']));
create policy "school staff view enrollments" on public.enrollments
for select to authenticated using(private.has_school_role(school_id,array['school_admin','director','academic','registrar','teacher']));
create policy "registrar creates enrollment" on public.enrollments
for insert to authenticated with check(private.has_school_role(school_id,array['school_admin','registrar']));
create policy "registrar updates enrollment" on public.enrollments
for update to authenticated
using(private.has_school_role(school_id,array['school_admin','registrar']))
with check(private.has_school_role(school_id,array['school_admin','registrar']));

-- To ensure mandatory reasons are preserved for transfers and status changes,
-- disallow direct UPDATE from clients; mutations use the following checked RPC.
revoke update on public.enrollments from authenticated;
create or replace function public.change_student_enrollment(
 p_enrollment_id uuid,p_classroom_id uuid,p_status text,p_reason text
) returns void language plpgsql security definer set search_path = ''
as $$
declare v_enrollment public.enrollments%rowtype;
begin
 select * into v_enrollment from public.enrollments where id=p_enrollment_id for update;
 if not found then raise exception 'Enrollment not found'; end if;
 if not private.has_school_role(v_enrollment.school_id,array['school_admin','registrar']) then
   raise exception 'Access denied';
 end if;
 if p_reason is null or length(trim(p_reason)) < 3 then raise exception 'Reason required (3+ characters)'; end if;
 if p_status not in ('active','transferred','withdrawn','completed') then raise exception 'Invalid status'; end if;
 if not exists(select 1 from public.classrooms c
   where c.id=p_classroom_id and c.school_id=v_enrollment.school_id and c.academic_year_id=v_enrollment.academic_year_id)
 then raise exception 'Classroom must belong to same school and year'; end if;
 perform set_config('wichakan.change_reason',trim(p_reason),true);
 update public.enrollments set classroom_id=p_classroom_id,status=p_status where id=p_enrollment_id;
 perform set_config('wichakan.change_reason','',true);
end; $$;
revoke all on function public.change_student_enrollment(uuid,uuid,text,text) from public;
grant execute on function public.change_student_enrollment(uuid,uuid,text,text) to authenticated;

-- Academic-year and classrooms are deliberately provisioned by an authorized
-- admin process. Do not allow all registrars to create entire school calendars.
-- Production migration TODO: enforce consistent student status through controlled transitions,
-- backfill history for legacy enrollments, and add graduation approvals.
