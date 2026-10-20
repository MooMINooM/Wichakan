create or replace function public.line_parent_years(p_line_user_id text)
returns jsonb language sql security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',y.id,'year_be',y.year_be) order by y.year_be desc),'[]'::jsonb)
 from public.academic_years y
 where auth.role()='service_role' and exists(
 select 1 from public.line_guardian_accounts a
 join public.student_guardians sg on sg.guardian_id=a.guardian_id and sg.school_id=a.school_id
 where a.line_user_id=p_line_user_id and a.school_id=y.school_id
 )
$$;
revoke all on function public.line_parent_years(text) from public,anon,authenticated;
grant execute on function public.line_parent_years(text) to service_role;