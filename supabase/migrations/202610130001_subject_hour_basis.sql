alter table public.subjects add column if not exists hour_basis text;
alter table public.subjects drop constraint if exists subjects_hour_basis_check;
alter table public.subjects add constraint subjects_hour_basis_check check (hour_basis in ('year','term'));
comment on column public.subjects.hour_basis is 'year=hours per academic year; term=hours per semester; NULL=legacy unspecified, requires manual review';
create or replace function public.edit_curriculum_subject_with_hours(
 p_subject_id uuid,p_subject_code text,p_name_th text,
 p_grade_level text,p_category text,p_learning_hours integer,p_hour_basis text
) returns void language plpgsql security definer set search_path=''
as $$
begin
 if p_hour_basis is null or p_hour_basis not in ('year','term') then
  raise exception 'Select annual or semester hours';
 end if;
 -- Reuse existing guarded RPC for permission, frozen-version, duplicate-code and history rules.
 perform public.edit_curriculum_subject(p_subject_id,p_subject_code,p_name_th,p_grade_level,p_category,p_learning_hours);
 update public.subjects set hour_basis=p_hour_basis where id=p_subject_id;
end;
$$;
revoke all on function public.edit_curriculum_subject_with_hours(uuid,text,text,text,text,integer,text) from public,anon;
grant execute on function public.edit_curriculum_subject_with_hours(uuid,text,text,text,text,integer,text) to authenticated;
