create or replace function public.review_line_student_claim(p_claim uuid,p_approve boolean)
returns void language plpgsql security definer set search_path='' as $$
declare c public.line_student_claims%rowtype;g uuid;
begin
 select * into c from public.line_student_claims where id=p_claim and status='pending' for update;
 if not found then raise exception 'claim_not_pending';end if;
 if not exists(select 1 from public.school_memberships where school_id=c.school_id and user_id=auth.uid() and active and role='school_admin') then raise exception 'not_authorized';end if;
 if p_approve then
  -- One school-authorized guardian identity can represent several children.
  select guardian_id into g from public.line_guardian_accounts where school_id=c.school_id and line_user_id=c.line_user_id limit 1;
  if g is null then
   insert into public.guardians(school_id,full_name_th) values(c.school_id,'ผู้ปกครอง LINE (รอปรับข้อมูล)') returning id into g;
   insert into public.line_guardian_accounts(school_id,guardian_id,line_user_id,verified_by) values(c.school_id,g,c.line_user_id,auth.uid());
  end if;
  -- Prevent silent takeover of existing child's primary guardian link.
  if exists(select 1 from public.student_guardians sg join public.line_guardian_accounts a on a.guardian_id=sg.guardian_id where sg.student_id=c.student_id and a.id is not null and a.guardian_id<>g)
  then raise exception 'student_already_linked_to_other_line';end if;
  insert into public.student_guardians(school_id,student_id,guardian_id,relationship) values(c.school_id,c.student_id,g,'ผู้ปกครอง')
  on conflict(student_id,guardian_id) do nothing;
  insert into public.line_guardian_link_audit(school_id,guardian_id,actor_user_id,action) values(c.school_id,g,auth.uid(),'approved');
 end if;
 update public.line_student_claims set status=case when p_approve then 'approved' else 'rejected' end,reviewed_by=auth.uid(),reviewed_at=now() where id=c.id;
end $$;
revoke all on function public.review_line_student_claim(uuid,boolean) from public,anon;
grant execute on function public.review_line_student_claim(uuid,boolean) to authenticated;