-- Single-school installation; retain school_id for relationships, permissions and audit.
do $$
begin
 if (select count(*) from public.schools) <> 1 then
   raise exception 'Single-school conversion refused: expected exactly one school';
 end if;
 update public.schools set name_th='โรงเรียนบ้านภูพระโนนผักหวาน',code='39020027'
 where code='WICHAKAN-DEMO' and name_th='โรงเรียนทดสอบ Wichakan';
 if not found then raise exception 'Demo school missing or already modified; verify manually'; end if;
end $$;

create or replace function public.remove_unused_student(p_student_id uuid,p_school_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare v_student_no text;
begin
 if (select auth.uid()) is null or not private.has_school_role(p_school_id,array['school_admin','registrar']) then
  raise exception 'ไม่มีสิทธิ์ลบนักเรียน';
 end if;
 select student_no into v_student_no from public.students
  where id=p_student_id and school_id=p_school_id for update;
 if not found then raise exception 'ไม่พบนักเรียนในโรงเรียนนี้'; end if;
 if exists(select 1 from public.enrollments where student_id=p_student_id and school_id=p_school_id)
 or exists(select 1 from public.enrollment_events where student_id=p_student_id and school_id=p_school_id)
 or exists(select 1 from public.student_guardians where student_id=p_student_id and school_id=p_school_id) then
   raise exception 'นักเรียนมีประวัติหรือข้อมูลผูกอยู่ ไม่อนุญาตให้ลบถาวร กรุณาเปลี่ยนสถานภาพแทน';
 end if;
 delete from public.students where id=p_student_id and school_id=p_school_id;
end $$;
revoke all on function public.remove_unused_student(uuid,uuid) from public,anon;
grant execute on function public.remove_unused_student(uuid,uuid) to authenticated;

create or replace function public.change_student_registry_status(p_student_id uuid,p_school_id uuid,p_status text)
returns void language plpgsql security definer set search_path=''
as $$
begin
 if (select auth.uid()) is null or not private.has_school_role(p_school_id,array['school_admin','registrar']) then
  raise exception 'ไม่มีสิทธิ์แก้ไขสถานภาพ';
 end if;
 if p_status not in ('active','transferred','graduated','inactive') then raise exception 'สถานภาพไม่ถูกต้อง'; end if;
 update public.students set status=p_status where id=p_student_id and school_id=p_school_id;
 if not found then raise exception 'ไม่พบนักเรียนในโรงเรียนนี้'; end if;
end $$;
revoke all on function public.change_student_registry_status(uuid,uuid,text) from public,anon;
grant execute on function public.change_student_registry_status(uuid,uuid,text) to authenticated;