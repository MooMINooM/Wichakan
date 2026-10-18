-- The verified 2569 semester-one schedule shows anti-corruption and basic math.
-- Preserve one-to-one per-room mapping while reversing legacy backwards integrations.
do $$
declare v_school uuid:='39b470d8-52e8-43d7-9774-4e5d8cf7875f';v_term uuid;v_count int;
begin
 select t.id into v_term from public.terms t join public.academic_years y on y.id=t.academic_year_id where t.school_id=v_school and t.term_no=1 and y.year_be=2569;
 if v_term is null then raise exception 'Missing 2569 term one';end if;
 if exists(select 1 from public.timetable_slots where term_id=v_term) then raise exception 'Refuse mapping reversal after lessons were scheduled';end if;
 delete from public.timetable_course_integrations where term_id=v_term and school_id=v_school and (
  integrated_offering_id in (select o.id from public.course_offerings o join public.subjects s on s.id=o.subject_id where o.term_id=v_term and (s.subject_code in ('ค21101','ค22101','ค23101') or s.name_th like 'การป้องกันการทุจริต%'))
  or host_offering_id in (select o.id from public.course_offerings o join public.subjects s on s.id=o.subject_id where o.term_id=v_term and (s.subject_code in ('ค21101','ค22101','ค23101') or s.name_th like 'การป้องกันการทุจริต%'))
 );
 insert into public.timetable_course_integrations(integrated_offering_id,host_offering_id,school_id,term_id,created_by)
 select child.id,host.id,v_school,v_term,coalesce((select user_id from public.school_memberships where school_id=v_school and role='school_admin' and active order by id limit 1), (select user_id from public.school_memberships where school_id=v_school and role='academic' and active order by id limit 1))
 from public.course_offerings child join public.subjects cs on cs.id=child.subject_id
 join public.course_offerings host on host.classroom_id=child.classroom_id and host.term_id=child.term_id
 join public.subjects hs on hs.id=host.subject_id
 where child.term_id=v_term and child.school_id=v_school and (
  (cs.subject_code in ('ค21201','ค22201','ค23201') and hs.subject_code=replace(cs.subject_code,'2','1')) 
  or (cs.name_th like 'หน้าที่พลเมือง%' and hs.name_th like 'การป้องกันการทุจริต%')
 );
 get diagnostics v_count=row_count;
 if v_count<>12 then raise exception 'Expected 12 integrated links, found %',v_count;end if;
end $$;