-- Course-level PP5 assessments; PP6 homeroom assessments remain separate.
create function private.valid_course_assessment_scores(v integer[],n integer)
returns boolean language sql immutable security invoker set search_path='' as $$
 select v is null or coalesce(array_ndims(v)=1 and array_lower(v,1)=1 and array_length(v,1)=n
 and array_position(v,null) is null and v <@ array[0,1,2,3],false)
$$;
revoke all on function private.valid_course_assessment_scores(integer[],integer) from public,anon;
grant execute on function private.valid_course_assessment_scores(integer[],integer) to authenticated;
create table public.course_student_assessments(
 school_id uuid not null references public.schools(id),
 course_offering_id uuid not null references public.course_offerings(id),
 student_id uuid not null references public.students(id),
 trait_scores integer[],reading_scores integer[],
 updated_by uuid not null default auth.uid(),updated_at timestamptz not null default now(),
 primary key(course_offering_id,student_id),
 check(private.valid_course_assessment_scores(trait_scores,8)),
 check(private.valid_course_assessment_scores(reading_scores,5))
);
create index course_assessment_school_idx on public.course_student_assessments(school_id);
create index course_assessment_student_idx on public.course_student_assessments(student_id);
alter table public.course_student_assessments enable row level security;
create function private.can_record_course_assessment(p_school uuid,p_offering uuid,p_student uuid)
returns boolean language sql stable security invoker set search_path='' as $$
 select auth.uid() is not null and exists(
 select 1 from public.course_offerings o join public.terms t on t.id=o.term_id and t.school_id=o.school_id
 join public.enrollments e on e.classroom_id=o.classroom_id and e.academic_year_id=t.academic_year_id and e.school_id=o.school_id
 where o.id=p_offering and o.school_id=p_school and e.student_id=p_student and e.status in ('active','completed')
 and exists(select 1 from public.school_memberships m where m.school_id=p_school and m.user_id=auth.uid() and m.active
 and (m.role in ('school_admin','academic') or (m.role='teacher' and exists(
 select 1 from public.teaching_assignments a where a.school_id=p_school and a.course_offering_id=p_offering and a.teacher_user_id=auth.uid())))))
$$;
revoke all on function private.can_record_course_assessment(uuid,uuid,uuid) from public,anon;
grant execute on function private.can_record_course_assessment(uuid,uuid,uuid) to authenticated;
create policy course_assessment_select on public.course_student_assessments for select to authenticated
 using(private.can_record_course_assessment(school_id,course_offering_id,student_id));
create policy course_assessment_insert on public.course_student_assessments for insert to authenticated
 with check(private.can_record_course_assessment(school_id,course_offering_id,student_id) and updated_by=(select auth.uid()));
create policy course_assessment_update on public.course_student_assessments for update to authenticated
 using(private.can_record_course_assessment(school_id,course_offering_id,student_id))
 with check(private.can_record_course_assessment(school_id,course_offering_id,student_id) and updated_by=(select auth.uid()));
revoke all on public.course_student_assessments from anon,authenticated;
grant select,insert,update on public.course_student_assessments to authenticated;
create function public.save_course_assessments(p_offering uuid,p_group text,p_rows jsonb)
returns void language plpgsql security invoker set search_path='' as $$
declare v_school uuid;v_row jsonb;v_scores integer[];v_student uuid;v_length integer;
begin
 if auth.uid() is null or p_group not in ('traits','reading') or p_group is null then raise exception 'Invalid assessment request';end if;
 if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 200 then raise exception 'Invalid assessment rows';end if;
 if (select count(distinct r->>'student_id') from jsonb_array_elements(p_rows) r)<>jsonb_array_length(p_rows) then raise exception 'Duplicate or missing students';end if;
 select school_id into v_school from public.course_offerings where id=p_offering;
 if v_school is null then raise exception 'Course not found';end if;
 v_length=case when p_group='traits' then 8 else 5 end;
 for v_row in select * from jsonb_array_elements(p_rows) loop
  v_student=(v_row->>'student_id')::uuid;
  if not private.can_record_course_assessment(v_school,p_offering,v_student) then raise exception 'No assessment permission or student not enrolled';end if;
  if jsonb_typeof(v_row->'scores') is distinct from 'array' then raise exception 'Missing assessment scores';end if;
  select array_agg(value::integer order by ord) into v_scores from jsonb_array_elements_text(v_row->'scores') with ordinality as x(value,ord);
  if v_scores is null or not private.valid_course_assessment_scores(v_scores,v_length) then raise exception 'Scores must have % integer values from 0 to 3',v_length;end if;
  insert into public.course_student_assessments(school_id,course_offering_id,student_id,trait_scores,reading_scores,updated_by)
  values(v_school,p_offering,v_student,case when p_group='traits' then v_scores end,case when p_group='reading' then v_scores end,auth.uid())
  on conflict(course_offering_id,student_id) do update set
   trait_scores=case when p_group='traits' then excluded.trait_scores else course_student_assessments.trait_scores end,
   reading_scores=case when p_group='reading' then excluded.reading_scores else course_student_assessments.reading_scores end,
   updated_by=auth.uid(),updated_at=now();
 end loop;
end $$;
revoke all on function public.save_course_assessments(uuid,text,jsonb) from public,anon;
grant execute on function public.save_course_assessments(uuid,text,jsonb) to authenticated;
