-- Authorized weight verification must preserve provenance; never assume current curriculum equals a historical curriculum.
create table if not exists public.schoolmis_weight_verifications(
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id),
 academic_year_be integer not null check(academic_year_be between 2500 and 2700),
 level_code text not null,
 term_no integer not null check(term_no between 0 and 2),
 subject_code text not null,
 weight_units numeric(6,2) not null check(weight_units>0 and weight_units<=30),
 evidence_note text not null check(length(evidence_note) between 10 and 500),
 reviewed_by uuid not null,
 affected_rows integer not null default 0,
 reviewed_at timestamptz not null default now()
);
create index if not exists schoolmis_weight_verifications_school_idx on public.schoolmis_weight_verifications(school_id,academic_year_be,level_code,term_no,subject_code,reviewed_at desc);
alter table public.schoolmis_weight_verifications enable row level security;
revoke all on public.schoolmis_weight_verifications from anon,authenticated;
grant select on public.schoolmis_weight_verifications to authenticated;
create policy schoolmis_weight_admin_read on public.schoolmis_weight_verifications for select to authenticated
 using (exists(select 1 from public.school_memberships m
   where m.school_id=schoolmis_weight_verifications.school_id
    and m.user_id=(select auth.uid()) and m.active and m.role in ('school_admin','registrar')));
create or replace function public.schoolmis_review_weights(p_school uuid)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare result jsonb;
begin
 if auth.uid() is null or not exists(select 1 from public.school_memberships m
    where m.user_id=auth.uid() and m.school_id=p_school and m.active and m.role in ('school_admin','registrar'))
 then raise exception 'schoolmis_not_authorized';end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'year',q.academic_year_be,'level',q.level_code,'term',q.term_no,'subject_code',q.subject_code,
  'name',q.subject_name,'group',q.subject_group,'students',q.students,
  'rows',q.row_count,'results_missing',q.results_missing,'weights_missing',q.weights_missing,
  'conflicting_weights',q.conflicting_weights,'weight',q.weight,
  'last_verification',v.evidence_note,'last_verified_at',v.reviewed_at
 ) order by q.academic_year_be desc,q.level_code,q.term_no,q.subject_code),'[]'::jsonb)
 into result
 from (
   select g.academic_year_be,g.level_code,g.term_no,g.subject_code,
    max(g.subject_name) as subject_name,max(g.subject_group) as subject_group,
    count(distinct g.student_id)::int as students,
    count(*)::int as row_count,
    count(*) filter(where g.grade_value is null)::int as results_missing,
    count(*) filter(where g.weight_units is null or not g.weight_confirmed)::int as weights_missing,
    (count(distinct g.weight_units)>1) as conflicting_weights,
    case when count(*) filter(where not g.weight_confirmed or g.weight_units is null)=0
      and count(distinct g.weight_units)=1 then max(g.weight_units) else null end as weight
   from public.schoolmis_grade_history g where g.school_id=p_school and not g.is_activity
   group by g.academic_year_be,g.level_code,g.term_no,g.subject_code
 ) q
 left join lateral (
  select v.evidence_note,v.reviewed_at from public.schoolmis_weight_verifications v
  where v.school_id=p_school and v.academic_year_be=q.academic_year_be and v.level_code=q.level_code
   and v.term_no=q.term_no and v.subject_code=q.subject_code
  order by v.reviewed_at desc limit 1
 ) v on true;
 return result;
end $fn$;
revoke all on function public.schoolmis_review_weights(uuid) from public,anon;
grant execute on function public.schoolmis_review_weights(uuid) to authenticated;

create or replace function public.schoolmis_verify_weight(
 p_school uuid,p_year integer,p_level text,p_term integer,p_subject_code text,
 p_weight numeric,p_evidence_note text
) returns integer language plpgsql security definer set search_path='' as $fn$
declare n integer;actor uuid:=auth.uid();
begin
 if actor is null or not exists(select 1 from public.school_memberships m
    where m.user_id=actor and m.school_id=p_school and m.active and m.role in ('school_admin','registrar'))
 then raise exception 'schoolmis_not_authorized';end if;
 if p_weight is null or p_weight<=0 or p_weight>30 or p_weight<>round(p_weight,2)
  or length(trim(coalesce(p_evidence_note,''))) not between 10 and 500
 then raise exception 'schoolmis_invalid_weight_or_evidence';end if;
 perform 1 from public.schoolmis_grade_history g where g.school_id=p_school
  and g.academic_year_be=p_year and g.level_code=p_level and g.term_no=p_term
  and g.subject_code=p_subject_code and not g.is_activity limit 1;
 if not found then raise exception 'schoolmis_historical_subject_not_found';end if;
 update public.schoolmis_grade_history g set weight_units=p_weight,weight_confirmed=true
 where g.school_id=p_school and g.academic_year_be=p_year and g.level_code=p_level
  and g.term_no=p_term and g.subject_code=p_subject_code and not g.is_activity;
 get diagnostics n=row_count;
 insert into public.schoolmis_weight_verifications(
  school_id,academic_year_be,level_code,term_no,subject_code,weight_units,
  evidence_note,reviewed_by,affected_rows)
 values(p_school,p_year,p_level,p_term,p_subject_code,p_weight,trim(p_evidence_note),actor,n);
 return n;
end $fn$;
revoke all on function public.schoolmis_verify_weight(uuid,integer,text,integer,text,numeric,text) from public,anon;
grant execute on function public.schoolmis_verify_weight(uuid,integer,text,integer,text,numeric,text) to authenticated;

-- Deprecated unaudited endpoint: replace UI callers with schoolmis_verify_weight.
revoke execute on function public.schoolmis_confirm_weight(uuid,integer,text,integer,text,numeric) from authenticated;
