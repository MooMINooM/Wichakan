-- Classroom scorecard for admins and registrars. Grades come from the same
-- student semester engine as the individual transcript; no duplicate math.
create or replace function public.schoolmis_class_semester_summary(
 p_school uuid,p_academic_year_be integer,p_classroom uuid
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare v_year uuid;v_level text;v_name text;v_summary jsonb;
begin
 if auth.uid() is null or not exists(
   select 1 from public.school_memberships m
   where m.school_id=p_school and m.user_id=auth.uid() and m.active
     and m.role in ('school_admin','registrar')
 ) then raise exception 'schoolmis_not_authorized';end if;
 select y.id,c.level_code,c.room_code into v_year,v_level,v_name
 from public.classrooms c join public.academic_years y
   on y.id=c.academic_year_id and y.school_id=c.school_id
 where c.id=p_classroom and c.school_id=p_school and y.year_be=p_academic_year_be;
 if v_year is null then raise exception 'schoolmis_classroom_not_found';end if;
 if v_level !~ '^ม[.][1-3]$' then raise exception 'schoolmis_not_secondary_classroom';end if;
 select coalesce(jsonb_agg(
   jsonb_build_object('student_id',s.id,'student_no',s.student_no,
    'name',concat_ws(' ',coalesce(s.name_prefix_th,'')||s.first_name_th,s.last_name_th),
    'summary',public.schoolmis_student_semester_summary(p_school,s.id))
   order by s.student_no),'[]'::jsonb) into v_summary
 from public.students s where s.school_id=p_school
 and exists(select 1 from public.enrollments e
   where e.school_id=p_school and e.student_id=s.id
    and e.academic_year_id=v_year and e.classroom_id=p_classroom
    and e.status in ('active','completed'));
 return jsonb_build_object('year_be',p_academic_year_be,'level_code',v_level,
   'room_code',v_name,'students',v_summary);
end $fn$;
revoke all on function public.schoolmis_class_semester_summary(uuid,integer,uuid) from public,anon;
grant execute on function public.schoolmis_class_semester_summary(uuid,integer,uuid) to authenticated;
