-- Preserve a cancellation audit before removing an unused course offering.
create table if not exists public.course_offering_cancellations(
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id),
 original_offering_id uuid not null,
 term_id uuid not null,
 classroom_id uuid not null,
 subject_id uuid not null,
 cancelled_by uuid not null references auth.users(id),
 cancelled_at timestamptz not null default now(),
 reason text not null,
 unique(original_offering_id)
);
alter table public.course_offering_cancellations enable row level security;
create policy "authorized staff read offering cancellations"
on public.course_offering_cancellations for select to authenticated
using(private.has_school_role(school_id,array['school_admin','academic','director','registrar']));

create or replace function public.cancel_unused_course_offering(
 p_offering_id uuid,p_reason text
) returns void language plpgsql security definer set search_path=''
as $$
declare v_offering public.course_offerings%rowtype;
begin
 select * into v_offering from public.course_offerings where id=p_offering_id for update;
 if not found then raise exception 'Offering not found'; end if;
 if auth.uid() is null or not private.has_school_role(v_offering.school_id,array['school_admin','academic']) then
  raise exception 'Academic editor permission required';
 end if;
 if length(trim(coalesce(p_reason,''))) not between 5 and 300 then
  raise exception 'Please provide a reason between 5 and 300 characters';
 end if;
 if exists(select 1 from public.teaching_assignments where course_offering_id=p_offering_id) then
  raise exception 'Remove active teacher assignments before cancelling this offering';
 end if;
 -- Do not delete any offering having dependent rows beyond direct teacher assignments.
 -- Foreign keys on future grade tables should be RESTRICT/NO ACTION, not CASCADE.
 insert into public.course_offering_cancellations
 (school_id,original_offering_id,term_id,classroom_id,subject_id,cancelled_by,reason)
 values(v_offering.school_id,v_offering.id,v_offering.term_id,v_offering.classroom_id,v_offering.subject_id,auth.uid(),trim(p_reason));
 delete from public.course_offerings where id=p_offering_id;
end;
$$;
revoke all on function public.cancel_unused_course_offering(uuid,text) from public,anon;
grant execute on function public.cancel_unused_course_offering(uuid,text) to authenticated;
