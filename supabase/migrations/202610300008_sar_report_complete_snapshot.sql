-- Include verified academic achievement and aggregated roster/teacher workload in the immutable report snapshot.
create or replace function public.sar_approve_report(p_year uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare v_school uuid;v_next integer;v_snapshot jsonb;
begin
 select school_id into v_school from public.academic_years where id=p_year;
 if v_school is null or not exists(select 1 from public.school_memberships m where m.school_id=v_school
 and m.user_id=(select auth.uid()) and m.active and m.role='school_admin')
 then raise exception 'not_authorized';end if;
 if not exists(select 1 from public.sar_year_settings s where s.school_id=v_school and s.academic_year_id=p_year and s.status='published')
 then raise exception 'targets_not_published';end if;
 -- Requires all primary topics reviewed. Avoid pretending absent evidence was assessed.
 if exists(select 1 from public.sar_target_topics t where t.code<>'overall' and not exists(
  select 1 from public.sar_quality_reviews q where q.school_id=v_school and q.academic_year_id=p_year
   and q.code=t.code and q.review_status='reviewed'))
 then raise exception 'review_all_topics_before_approval';end if;
 perform pg_advisory_xact_lock(hashtext(v_school::text||p_year::text));
 select coalesce(max(version_no),0)+1 into v_next from public.sar_report_versions
 where school_id=v_school and academic_year_id=p_year;
 select jsonb_build_object('year',y.year_be,'school',s.name_th,'captured_at',now(),
 'targets',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from public.sar_indicator_targets x where x.school_id=v_school and x.academic_year_id=p_year),
 'measurements',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from public.sar_indicator_measurements x where x.school_id=v_school and x.academic_year_id=p_year),
 'reviews',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from public.sar_quality_reviews x where x.school_id=v_school and x.academic_year_id=p_year),
 'national_tests',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from public.sar_national_tests x where x.school_id=v_school and x.academic_year_id=p_year),
 'context',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from public.sar_context x where x.school_id=v_school and x.academic_year_id=p_year),
 'evidence',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from public.sar_evidence x where x.school_id=v_school and x.academic_year_id=p_year and x.verification_status='verified'),
 'academic_summary',public.sar_admin_academic_summary(p_year),
 'roster',public.sar_admin_auto_snapshot(p_year),
 'teacher_summary',(select coalesce(jsonb_agg(z),'[]'::jsonb) from (
   select item_code,count(*)::integer as n,round(avg(rating),2) as mean_rating
   from public.sar_teacher_assessments a
   join public.sar_teacher_submissions sub on sub.school_id=a.school_id and sub.academic_year_id=a.academic_year_id and sub.teacher_user_id=a.teacher_user_id
   where a.school_id=v_school and a.academic_year_id=p_year and a.rating is not null group by item_code
 ) z)
 ) into v_snapshot
 from public.academic_years y join public.schools s on s.id=y.school_id where y.id=p_year;
 insert into public.sar_report_versions(school_id,academic_year_id,version_no,snapshot,approved_by)
 values(v_school,p_year,v_next,v_snapshot,(select auth.uid()));
 return v_next;
end $$;

revoke all on function public.sar_approve_report(uuid) from public,anon;
grant execute on function public.sar_approve_report(uuid) to authenticated;
