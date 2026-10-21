-- A grade release is a reviewed snapshot of the current academic records:
-- automatically close any open release if relevant source data are changed.
create or replace function private.line_invalidate_release()
returns trigger language plpgsql security definer set search_path='' as $$
declare r jsonb;v_school uuid;v_year uuid;v_offering uuid;
begin
 if TG_OP='DELETE' then r=to_jsonb(OLD);else r=to_jsonb(NEW);end if;
 v_school=(r->>'school_id')::uuid;
 if TG_TABLE_NAME='student_course_scores' then
  v_offering=(r->>'course_offering_id')::uuid;
 elsif TG_TABLE_NAME='course_offerings' then
  v_offering=(r->>'id')::uuid;
 end if;
 if v_offering is not null then
  select t.academic_year_id into v_year
  from public.course_offerings o join public.terms t on t.id=o.term_id
  where o.id=v_offering;
 elsif TG_TABLE_NAME in ('subject_score_settings','enrollments') then
  v_year=(r->>'academic_year_id')::uuid;
 end if;
 if v_school is not null and v_year is not null then
  update public.line_grade_publications
   set published_at=null,published_by=null
   where school_id=v_school and academic_year_id=v_year and published_at is not null;
 end if;
 if TG_OP='DELETE' then return OLD;else return NEW;end if;
end $$;
revoke all on function private.line_invalidate_release() from public,anon,authenticated;
drop trigger if exists line_revoke_scores on public.student_course_scores;
create trigger line_revoke_scores after insert or update or delete
 on public.student_course_scores for each row execute function private.line_invalidate_release();
drop trigger if exists line_revoke_settings on public.subject_score_settings;
create trigger line_revoke_settings after insert or update or delete
 on public.subject_score_settings for each row execute function private.line_invalidate_release();
drop trigger if exists line_revoke_enrollment on public.enrollments;
create trigger line_revoke_enrollment after insert or update or delete
 on public.enrollments for each row execute function private.line_invalidate_release();
drop trigger if exists line_revoke_offering on public.course_offerings;
create trigger line_revoke_offering after insert or update or delete
 on public.course_offerings for each row execute function private.line_invalidate_release();
