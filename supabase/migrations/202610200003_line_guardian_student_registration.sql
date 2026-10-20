create or replace function public.register_line_guardian_for_student(p_student uuid,p_full_name text,p_relationship text,p_phone text default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_school uuid;v_guardian uuid;v_name text;v_relation text;
begin
 select school_id into v_school from public.students where id=p_student and status='active';
 if v_school is null or not exists(select 1 from public.school_memberships where school_id=v_school and user_id=auth.uid() and active and role='school_admin') then raise exception 'not_authorized';end if;
 v_name=btrim(coalesce(p_full_name,''));v_relation=btrim(coalesce(p_relationship,''));
 if length(v_name)<2 or length(v_name)>200 or v_relation not in ('บิดา','มารดา','ผู้ปกครอง','ญาติ') then raise exception 'invalid_guardian';end if;
 if p_phone is not null and (length(p_phone)>25 or p_phone !~ '^[0-9+ -]+$') then raise exception 'invalid_phone';end if;
 -- If the same student's guardian record is already present, avoid generating duplicates.
 select g.id into v_guardian from public.guardians g join public.student_guardians sg on sg.guardian_id=g.id and sg.school_id=g.school_id where sg.student_id=p_student and g.school_id=v_school and g.full_name_th=v_name limit 1;
 if v_guardian is null then
  insert into public.guardians(school_id,full_name_th,phone) values(v_school,v_name,nullif(btrim(coalesce(p_phone,'')),'')) returning id into v_guardian;
 end if;
 insert into public.student_guardians(school_id,student_id,guardian_id,relationship) values(v_school,p_student,v_guardian,v_relation) on conflict(student_id,guardian_id) do update set relationship=excluded.relationship;
 return v_guardian;
end $$;
revoke all on function public.register_line_guardian_for_student(uuid,text,text,text) from public,anon;
grant execute on function public.register_line_guardian_for_student(uuid,text,text,text) to authenticated;