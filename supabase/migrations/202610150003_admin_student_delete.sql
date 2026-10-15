create table if not exists public.student_deletion_audit (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id),
 student_id uuid not null,
 actor_user_id uuid not null,
 deleted_at timestamptz not null default now(),
 enrollment_count integer not null default 0,
 event_count integer not null default 0,
 guardian_link_count integer not null default 0
);
alter table public.student_deletion_audit enable row level security;
revoke all on public.student_deletion_audit from anon,authenticated;
create or replace function public.admin_delete_student_with_history(p_school_id uuid,p_student_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare v_enrollments int;v_events int;v_guardians int;v_issued bigint;
begin
 if auth.uid() is null or not private.has_school_role(p_school_id,array['school_admin']) then
  raise exception 'อนุญาตเฉพาะผู้ดูแลระบบโรงเรียนเท่านั้น';
 end if;
 v_issued=coalesce(nullif(auth.jwt()->>'iat','')::bigint,0);
 if v_issued=0 or extract(epoch from now())-v_issued > 120 or extract(epoch from now())-v_issued < -30 then
  raise exception 'กรุณายืนยันรหัสผ่านผู้ดูแลระบบอีกครั้งก่อนลบ (ภายใน 2 นาที)';
 end if;
 perform 1 from public.students where id=p_student_id and school_id=p_school_id for update;
 if not found then raise exception 'ไม่พบนักเรียนในโรงเรียนนี้'; end if;
 select count(*) into v_enrollments from public.enrollments where student_id=p_student_id and school_id=p_school_id;
 select count(*) into v_events from public.enrollment_events where student_id=p_student_id and school_id=p_school_id;
 select count(*) into v_guardians from public.student_guardians where student_id=p_student_id and school_id=p_school_id;
 insert into public.student_deletion_audit(school_id,student_id,actor_user_id,enrollment_count,event_count,guardian_link_count)
 values(p_school_id,p_student_id,auth.uid(),v_enrollments,v_events,v_guardians);
 delete from public.enrollment_events where student_id=p_student_id and school_id=p_school_id;
 delete from public.enrollments where student_id=p_student_id and school_id=p_school_id;
 delete from public.student_guardians where student_id=p_student_id and school_id=p_school_id;
 delete from public.students where id=p_student_id and school_id=p_school_id;
end $$;
revoke all on function public.admin_delete_student_with_history(uuid,uuid) from public,anon;
grant execute on function public.admin_delete_student_with_history(uuid,uuid) to authenticated;