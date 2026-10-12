create or replace function public.edit_curriculum_subject(
 p_subject_id uuid,p_subject_code text,p_name_th text,
 p_grade_level text,p_category text,p_learning_hours integer
) returns void language plpgsql security definer set search_path=''
as $$
declare v_school uuid; v_version uuid; v_frozen timestamptz;
begin
 select s.school_id,s.curriculum_version_id,v.frozen_at
 into v_school,v_version,v_frozen
 from public.subjects s join public.curriculum_versions v
 on v.id=s.curriculum_version_id and v.school_id=s.school_id
 where s.id=p_subject_id for update of s;
 if v_school is null then raise exception 'Subject not found'; end if;
 if auth.uid() is null or not private.has_school_role(v_school,array['school_admin','academic']) then
  raise exception 'Academic editor permission required';
 end if;
 if v_frozen is not null then raise exception 'Curriculum version is frozen; copy to a new version'; end if;
 if exists(select 1 from public.course_offerings o where o.subject_id=p_subject_id) then
  raise exception 'Subject has teaching history; create a new curriculum version instead';
 end if;
 if length(trim(coalesce(p_subject_code,''))) not between 2 and 30
 or length(trim(coalesce(p_name_th,''))) not between 2 and 200
 or p_grade_level not in ('ป.1','ป.2','ป.3','ป.4','ป.5','ป.6','ม.1','ม.2','ม.3','ม.4','ม.5','ม.6')
 or p_category not in ('basic','additional','activity')
 or p_learning_hours is null or p_learning_hours < 0 or p_learning_hours > 2000 then
  raise exception 'Invalid subject details';
 end if;
 if exists(select 1 from public.subjects s where s.school_id=v_school
  and s.curriculum_version_id=v_version and s.subject_code=trim(p_subject_code) and s.id<>p_subject_id) then
  raise exception 'Duplicate subject code in this curriculum version';
 end if;
 update public.subjects set subject_code=trim(p_subject_code),name_th=trim(p_name_th),
 grade_level=p_grade_level,category=p_category,learning_hours=p_learning_hours
 where id=p_subject_id;
end;
$$;
revoke all on function public.edit_curriculum_subject(uuid,text,text,text,text,integer) from public,anon;
grant execute on function public.edit_curriculum_subject(uuid,text,text,text,text,integer) to authenticated;
