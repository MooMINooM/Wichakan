-- Admin-only revocation: one child at a time, preserves siblings and a durable trail.
-- Archived claim must be removed so the parent may re-register this child later.
create or replace function public.line_admin_revoke_student_link(p_guardian uuid,p_student uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_school uuid;v_line text;v_actor uuid:=auth.uid();
begin
 select a.school_id,a.line_user_id into v_school,v_line
 from public.line_guardian_accounts a where a.guardian_id=p_guardian for update;
 if v_school is null or v_actor is null or not exists(
  select 1 from public.school_memberships m
  where m.school_id=v_school and m.user_id=v_actor and m.role='school_admin' and m.active
 ) then raise exception 'not_authorized';end if;
 if not exists(select 1 from public.students s where s.id=p_student and s.school_id=v_school)
 then raise exception 'student_not_found';end if;
 perform 1 from public.student_guardians sg
 where sg.school_id=v_school and sg.guardian_id=p_guardian and sg.student_id=p_student for update;
 if not found then raise exception 'link_not_found';end if;
 insert into public.line_guardian_child_audit(school_id,guardian_id,student_id,actor_user_id,action,recorded_at)
 select v_school,p_guardian,p_student,c.reviewed_by,'approved',coalesce(c.reviewed_at,c.created_at)
 from public.line_student_claims c
 where c.school_id=v_school and c.student_id=p_student and c.line_user_id=v_line and c.status='approved';
 insert into public.line_guardian_child_audit(school_id,guardian_id,student_id,actor_user_id,action)
 values(v_school,p_guardian,p_student,v_actor,'revoked');
 delete from public.student_guardians sg
 where sg.school_id=v_school and sg.guardian_id=p_guardian and sg.student_id=p_student;
 delete from public.line_student_claims c
 where c.school_id=v_school and c.student_id=p_student and c.line_user_id=v_line;
 if not exists(select 1 from public.student_guardians sg where sg.school_id=v_school and sg.guardian_id=p_guardian) then
  delete from public.line_guardian_accounts a
  where a.school_id=v_school and a.guardian_id=p_guardian;
  insert into public.line_guardian_link_audit(school_id,guardian_id,actor_user_id,action)
  values(v_school,p_guardian,v_actor,'revoked');
 end if;
end $$;
revoke all on function public.line_admin_revoke_student_link(uuid,uuid) from public,anon;
grant execute on function public.line_admin_revoke_student_link(uuid,uuid) to authenticated;
