-- Release control is separate from completing or saving teacher grades.
create table if not exists public.line_grade_publications (
 school_id uuid not null references public.schools(id) on delete cascade,
 academic_year_id uuid not null references public.academic_years(id) on delete cascade,
 term_no integer not null check(term_no in (1,2)),
 published_at timestamptz,
 published_by uuid references auth.users(id),
 primary key(school_id,academic_year_id,term_no)
);
alter table public.line_grade_publications enable row level security;
revoke all on public.line_grade_publications from anon,authenticated;
grant select on public.line_grade_publications to authenticated;
create policy "admins view LINE grade publication" on public.line_grade_publications
 for select to authenticated using(exists(select 1 from public.school_memberships m where m.school_id=line_grade_publications.school_id and m.user_id=auth.uid() and m.active and m.role='school_admin'));
create or replace function public.set_line_grade_publication(p_year uuid,p_term integer,p_publish boolean)
returns void language plpgsql security definer set search_path='' as $$
declare school uuid;
begin
 select school_id into school from public.academic_years where id=p_year;
 if school is null or p_term not in (1,2) or not exists(select 1 from public.school_memberships where school_id=school and user_id=auth.uid() and active and role='school_admin')
 then raise exception 'not_authorized'; end if;
 insert into public.line_grade_publications(school_id,academic_year_id,term_no,published_at,published_by)
 values(school,p_year,p_term,case when p_publish then now() else null end,auth.uid())
 on conflict(school_id,academic_year_id,term_no)
 do update set published_at=excluded.published_at,published_by=excluded.published_by;
end $$;
revoke all on function public.set_line_grade_publication(uuid,integer,boolean) from public,anon;
grant execute on function public.set_line_grade_publication(uuid,integer,boolean) to authenticated;

-- Expose only approved children and explicitly published score rows.
-- This routine is service_role only, with LINE ID Token verified by the calling Edge Function.
create or replace function public.line_parent_portal_data(p_line_user_id text,p_student_id uuid default null,p_year uuid default null,p_term integer default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_students jsonb; v_scores jsonb; v_authorized boolean;
begin
 if auth.role()<>'service_role' or p_line_user_id is null or length(p_line_user_id) not between 10 and 255
 then raise exception 'forbidden';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',coalesce(s.name_prefix_th,'')||s.first_name_th||' '||s.last_name_th,'student_no',s.student_no) order by s.student_no),'[]'::jsonb)
 into v_students
 from public.line_guardian_accounts a
 join public.student_guardians sg on sg.guardian_id=a.guardian_id and sg.school_id=a.school_id
 join public.students s on s.id=sg.student_id and s.school_id=sg.school_id and s.status='active'
 where a.line_user_id=p_line_user_id;
 if p_student_id is null or p_year is null or p_term is null then
  return jsonb_build_object('students',v_students,'grades','[]'::jsonb);
 end if;
 select exists(
 select 1 from public.line_guardian_accounts a
 join public.student_guardians sg on sg.guardian_id=a.guardian_id and sg.school_id=a.school_id
 join public.students s on s.id=sg.student_id and s.school_id=a.school_id and s.status='active'
 join public.academic_years y on y.id=p_year and y.school_id=a.school_id
 join public.line_grade_publications pub on pub.school_id=a.school_id and pub.academic_year_id=y.id and pub.term_no=p_term and pub.published_at is not null
 where a.line_user_id=p_line_user_id and sg.student_id=p_student_id
 ) into v_authorized;
 if not v_authorized then return jsonb_build_object('students',v_students,'grades','[]'::jsonb,'published',false);end if;
 -- Only complete scores. Secondary term grades are 100 per semester.
 -- Primary grades are annual and only shown in term 2 after both terms are complete.
 select coalesce(jsonb_agg(jsonb_build_object(
   'subject',q.name_th,'subject_code',q.subject_code,'grade',q.grade,'total',q.total
 ) order by q.subject_code),'[]'::jsonb) into v_scores
 from (
  select distinct on (sub.id) sub.id,sub.name_th,sub.subject_code,
   case when sc.special_result is not null then sc.special_result
    when co.level_code like 'ม.%' and p_term=1 then
     case when (sc.term1_coursework+sc.term1_midterm+sc.term1_final)>=80 then '4'
          when (sc.term1_coursework+sc.term1_midterm+sc.term1_final)>=75 then '3.5'
          when (sc.term1_coursework+sc.term1_midterm+sc.term1_final)>=70 then '3'
          when (sc.term1_coursework+sc.term1_midterm+sc.term1_final)>=65 then '2.5'
          when (sc.term1_coursework+sc.term1_midterm+sc.term1_final)>=60 then '2'
          when (sc.term1_coursework+sc.term1_midterm+sc.term1_final)>=55 then '1.5'
          when (sc.term1_coursework+sc.term1_midterm+sc.term1_final)>=50 then '1' else '0' end
    else
     case when (case when co.level_code like 'ม.%' then sc.term2_coursework+sc.term2_midterm+sc.term2_final
                     else sc.term1_coursework+sc.term1_midterm+sc.term1_final+sc.term2_coursework+sc.term2_midterm+sc.term2_final end)>=80 then '4'
          when (case when co.level_code like 'ม.%' then sc.term2_coursework+sc.term2_midterm+sc.term2_final else sc.term1_coursework+sc.term1_midterm+sc.term1_final+sc.term2_coursework+sc.term2_midterm+sc.term2_final end)>=75 then '3.5'
          when (case when co.level_code like 'ม.%' then sc.term2_coursework+sc.term2_midterm+sc.term2_final else sc.term1_coursework+sc.term1_midterm+sc.term1_final+sc.term2_coursework+sc.term2_midterm+sc.term2_final end)>=70 then '3'
          when (case when co.level_code like 'ม.%' then sc.term2_coursework+sc.term2_midterm+sc.term2_final else sc.term1_coursework+sc.term1_midterm+sc.term1_final+sc.term2_coursework+sc.term2_midterm+sc.term2_final end)>=65 then '2.5'
          when (case when co.level_code like 'ม.%' then sc.term2_coursework+sc.term2_midterm+sc.term2_final else sc.term1_coursework+sc.term1_midterm+sc.term1_final+sc.term2_coursework+sc.term2_midterm+sc.term2_final end)>=60 then '2'
          when (case when co.level_code like 'ม.%' then sc.term2_coursework+sc.term2_midterm+sc.term2_final else sc.term1_coursework+sc.term1_midterm+sc.term1_final+sc.term2_coursework+sc.term2_midterm+sc.term2_final end)>=55 then '1.5'
          when (case when co.level_code like 'ม.%' then sc.term2_coursework+sc.term2_midterm+sc.term2_final else sc.term1_coursework+sc.term1_midterm+sc.term1_final+sc.term2_coursework+sc.term2_midterm+sc.term2_final end)>=50 then '1' else '0' end end as grade,
   case when co.level_code like 'ม.%' and p_term=1 then sc.term1_coursework+sc.term1_midterm+sc.term1_final
        when co.level_code like 'ม.%' then sc.term2_coursework+sc.term2_midterm+sc.term2_final
        else sc.term1_coursework+sc.term1_midterm+sc.term1_final+sc.term2_coursework+sc.term2_midterm+sc.term2_final end as total
  from public.student_course_scores sc
  join public.course_offerings o on o.id=sc.course_offering_id
  join public.terms t on t.id=o.term_id
  join public.classrooms co on co.id=o.classroom_id
  join public.subjects sub on sub.id=o.subject_id
  where sc.student_id=p_student_id and sc.is_complete and t.academic_year_id=p_year
   and (co.level_code like 'ม.%' or p_term=2)
   and (co.level_code not like 'ม.%' or t.term_no=p_term)
   and (sc.special_result is not null or (
       (co.level_code like 'ม.%' and p_term=1 and sc.term1_coursework is not null and sc.term1_midterm is not null and sc.term1_final is not null)
       or (co.level_code like 'ม.%' and p_term=2 and sc.term2_coursework is not null and sc.term2_midterm is not null and sc.term2_final is not null)
       or (co.level_code not like 'ม.%' and sc.term1_coursework is not null and sc.term1_midterm is not null and sc.term1_final is not null and sc.term2_coursework is not null and sc.term2_midterm is not null and sc.term2_final is not null)
    ))
  order by sub.id, o.id
 ) q;
 return jsonb_build_object('students',v_students,'grades',v_scores,'published',true);
end $$;
revoke all on function public.line_parent_portal_data(text,uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.line_parent_portal_data(text,uuid,uuid,integer) to service_role;
