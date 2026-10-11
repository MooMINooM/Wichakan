-- v0.5: school-scoped curriculum management and safe, all-or-nothing group promotion.
create policy "staff read curricula" on public.curricula for select to authenticated using(private.has_school_role(school_id,array['school_admin','academic','director','registrar','teacher']));
create policy "academic insert curricula" on public.curricula for insert to authenticated with check(private.has_school_role(school_id,array['school_admin','academic']));
create policy "staff read curriculum versions" on public.curriculum_versions for select to authenticated using(private.has_school_role(school_id,array['school_admin','academic','director','registrar','teacher']));
create policy "academic insert curriculum versions" on public.curriculum_versions for insert to authenticated with check(private.has_school_role(school_id,array['school_admin','academic']));
create policy "staff read subjects" on public.subjects for select to authenticated using(private.has_school_role(school_id,array['school_admin','academic','director','registrar','teacher']));
create policy "academic insert subjects" on public.subjects for insert to authenticated with check(private.has_school_role(school_id,array['school_admin','academic']));

-- Force clients to use an audited RPC for batch promotion, rather than mass-changing prior years.
create or replace function public.promote_students_batch(
 p_school_id uuid,
 p_source_classroom_id uuid,
 p_target_classroom_id uuid,
 p_student_ids uuid[]
) returns integer language plpgsql security definer set search_path = ''
as $$
declare v_source public.classrooms%rowtype;
 v_target public.classrooms%rowtype;
 v_expected integer;
 v_eligible integer;
begin
 if not private.has_school_role(p_school_id,array['school_admin','registrar']) then raise exception 'Access denied'; end if;
 if p_student_ids is null or array_length(p_student_ids,1) is null or array_length(p_student_ids,1)>150 then raise exception 'Select 1 to 150 students'; end if;
 select * into v_source from public.classrooms where id=p_source_classroom_id and school_id=p_school_id;
 select * into v_target from public.classrooms where id=p_target_classroom_id and school_id=p_school_id;
 if v_source.id is null or v_target.id is null then raise exception 'Classroom missing'; end if;
 if v_source.academic_year_id=v_target.academic_year_id then raise exception 'Destination must be another academic year'; end if;
 if (select year_be from public.academic_years where id=v_target.academic_year_id) <=
    (select year_be from public.academic_years where id=v_source.academic_year_id) then raise exception 'Destination year must be later'; end if;
 select count(distinct x) into v_expected from unnest(p_student_ids) as x;
 if v_expected<>array_length(p_student_ids,1) then raise exception 'Duplicate selected student'; end if;
 select count(*) into v_eligible from public.enrollments e
  where e.school_id=p_school_id and e.classroom_id=p_source_classroom_id and e.student_id=any(p_student_ids)
    and e.status in ('active','completed');
 if v_eligible<>v_expected then raise exception 'Students are not eligible from source room'; end if;
 if exists(select 1 from public.enrollments e where e.student_id=any(p_student_ids) and e.academic_year_id=v_target.academic_year_id)
 then raise exception 'One or more students already enrolled in destination year'; end if;
 insert into public.enrollments(school_id,student_id,academic_year_id,classroom_id,status)
 select p_school_id,e.student_id,v_target.academic_year_id,v_target.id,'active'
 from public.enrollments e where e.school_id=p_school_id and e.classroom_id=v_source.id and e.student_id=any(p_student_ids);
 return v_expected;
end;
$$;
revoke all on function public.promote_students_batch(uuid,uuid,uuid,uuid[]) from public,anon;
grant execute on function public.promote_students_batch(uuid,uuid,uuid,uuid[]) to authenticated;
