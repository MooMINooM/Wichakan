-- Revoke the release for both the previous and the new year if an
-- enrollment/offering/score is moved, and handle a deleted offering's term.
create or replace function private.line_invalidate_release_row(p_table text,p_row jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare v_school uuid;v_year uuid;
begin
 v_school=(p_row->>'school_id')::uuid;
 if p_table='student_course_scores' then
  select t.academic_year_id into v_year
   from public.course_offerings o join public.terms t on t.id=o.term_id
   where o.id=(p_row->>'course_offering_id')::uuid;
 elsif p_table='course_offerings' then
  select t.academic_year_id into v_year from public.terms t
   where t.id=(p_row->>'term_id')::uuid;
 elsif p_table in ('subject_score_settings','enrollments') then
  v_year=(p_row->>'academic_year_id')::uuid;
 end if;
 if v_school is not null and v_year is not null then
  update public.line_grade_publications set published_at=null,published_by=null
   where school_id=v_school and academic_year_id=v_year and published_at is not null;
 end if;
end $$;
revoke all on function private.line_invalidate_release_row(text,jsonb) from public,anon,authenticated;

create or replace function private.line_invalidate_release()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP in ('UPDATE','DELETE') then
  perform private.line_invalidate_release_row(TG_TABLE_NAME,to_jsonb(OLD));
 end if;
 if TG_OP in ('UPDATE','INSERT') then
  perform private.line_invalidate_release_row(TG_TABLE_NAME,to_jsonb(NEW));
 end if;
 if TG_OP='DELETE' then return OLD;else return NEW;end if;
end $$;
revoke all on function private.line_invalidate_release() from public,anon,authenticated;

-- Verify privileges are not publicly callable without school/LINE auth.
do $$
begin
 if has_function_privilege('anon','public.line_parent_portal_data(text,uuid,uuid,integer)','EXECUTE')
 or has_function_privilege('authenticated','public.line_parent_portal_data(text,uuid,uuid,integer)','EXECUTE')
 or has_function_privilege('anon','private.line_grade_rows(uuid,uuid,integer,uuid)','EXECUTE')
 or has_function_privilege('authenticated','private.line_grade_rows(uuid,uuid,integer,uuid)','EXECUTE')
 or has_function_privilege('anon','public.set_line_grade_publication(uuid,integer,boolean)','EXECUTE')
 then raise exception 'unsafe LINE grade function permissions';end if;
end $$;
