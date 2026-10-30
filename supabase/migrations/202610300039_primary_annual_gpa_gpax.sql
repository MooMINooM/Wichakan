-- WICHAKAN annual primary GPA/GPAX and semester secondary GPA/GPAX.
-- Same authorized transcript sources. Cumulative GPA is only across the
-- longest consecutive completed sequence of periods, starting at year/term 1.
-- Primary SchoolMIS annual grades combine PE and art; their already-confirmed
-- weights include both component course hours.
CREATE OR REPLACE FUNCTION public.schoolmis_student_semester_summary(p_school uuid, p_student uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_payload jsonb;
 v_grade int;
 v_year int;
 v_version uuid;
 v_result jsonb;
 v_level text;
 v_primary boolean;
 v_period_count integer;
begin
 -- Transcript performs school-scoped admin/registrar authorization and student validation.
 v_payload:=public.schoolmis_student_transcript(p_school,p_student);
 select substring(c.level_code from 3)::integer,y.year_be,c.level_code into v_grade,v_year,v_level
 from public.enrollments e
 join public.academic_years y on y.id=e.academic_year_id and y.school_id=e.school_id
 join public.classrooms c on c.id=e.classroom_id and c.school_id=e.school_id
 where e.school_id=p_school and e.student_id=p_student and c.level_code ~ '^(ป[.][1-6]|ม[.][1-3])
  and e.status in ('active','completed')
 order by y.year_be desc, case when e.status='active' then 0 else 1 end
 limit 1;
 if v_grade is null then
  return jsonb_build_object('terms','[]'::jsonb,'gpax',null,'completed_terms',0,
   'expected_terms',0,'period_type','none','status','not_supported');
 end if;
 v_primary := v_level like 'ป.%';
 v_period_count := case when v_primary then v_grade else v_grade*2 end;
 select cv.id into v_version from public.curriculum_versions cv
 where cv.school_id=p_school and cv.effective_year_be<=v_year
 order by cv.effective_year_be desc limit 1;
 with periods as (
   select n as sequence,
     case when v_primary then n else ((n+1)/2)::integer end as grade_no,
     case when v_primary then 'ป.'||n::text else 'ม.'||((n+1)/2)::text end as level_code,
     case when v_primary then 0 when n%2=1 then 1 else 2 end as term_no,
     v_year-(v_grade-(case when v_primary then n else ((n+1)/2)::integer end)) as year_be
   from generate_series(1,v_period_count) as n
 ),
 expected as (
   select p.*,coalesce((
     select count(*)::int from public.subjects s
     where s.school_id=p_school and s.curriculum_version_id=v_version
      and s.grade_level=p.level_code
      and s.category in ('basic','additional')
      and (
        (v_primary and p.term_no=0 and s.hour_basis='year'
          -- SchoolMIS/PP.6 primary grades combine health+PE and art+music.
          -- The transcript weights their 101 records with hours of both subjects.
          and s.subject_code !~ '^[พศ]1[1-6]102
   ),0) as expected_courses
   from periods p
 ),
 source_rows as (
   select r.year_be,r.level_code,r.term_no,r.subject_code,r.status,r.weight,
     case when r.status='ready' and r.grade ~ '^(0|[1-3]([.]5)?|4)$'
       then r.grade::numeric else null end as grade_value
   from jsonb_to_recordset(v_payload->'rows') as r(
     year_be integer,level_code text,term_no integer,subject_code text,
     status text,grade text,weight numeric,is_activity boolean)
   where not r.is_activity
    -- Avoid counting individual PE/music offerings twice when already included
    -- in the combined primary transcript's grade and official-hours weight.
    and (not v_primary or r.subject_code !~ '^[พศ]1[1-6]102
 raw as (
   select p.sequence,p.grade_no,p.level_code,p.term_no,p.year_be,p.expected_courses,
     count(r.subject_code)::int as subjects,
     count(r.subject_code) filter (
       where r.grade_value is null or r.status<>'ready' or r.weight is null or r.weight<=0
     )::int as pending,
     coalesce(sum(r.grade_value*r.weight) filter(
       where r.status='ready' and r.grade_value is not null and r.weight>0),0) as points,
     coalesce(sum(r.weight) filter(
       where r.status='ready' and r.grade_value is not null and r.weight>0),0) as credits
   from expected p left join source_rows r
    on r.year_be=p.year_be and r.level_code=p.level_code and r.term_no=p.term_no
   group by p.sequence,p.grade_no,p.level_code,p.term_no,p.year_be,p.expected_courses
 ),
 term_stats as (
   select raw.*,
     (expected_courses>0 and subjects=expected_courses and pending=0 and credits>0) as is_complete,
     case when subjects=0 then 'not_started'
       when subjects<expected_courses then 'missing_courses'
       when subjects>expected_courses then 'extra_courses'
       when pending>0 then 'incomplete_results'
       when credits<=0 then 'missing_credits'
       else 'complete' end as status
   from raw
 ),
 accum as (
   select t.*,
    sum(case when is_complete then 0 else 1 end) over(order by sequence) as failed_prefix,
    sum(case when is_complete then points else 0 end) over(order by sequence) as accumulated_points,
    sum(case when is_complete then credits else 0 end) over(order by sequence) as accumulated_credits
   from term_stats t
 ),
 shown as (
   select a.*,
      case when is_complete then round(points/credits,2) else null end as gpa,
      case when failed_prefix=0 and accumulated_credits>0
         then round(accumulated_points/accumulated_credits,2) else null end as gpax_to_date
   from accum a
 ),
 latest as (
   select sequence,gpax_to_date from shown where is_complete and failed_prefix=0
   order by sequence desc limit 1
 )
 select jsonb_build_object(
   'terms',coalesce((
     select jsonb_agg(jsonb_build_object(
       'sequence',s.sequence,'year_be',s.year_be,'level_code',s.level_code,
       'term_no',s.term_no,'subjects',s.subjects,'expected_subjects',s.expected_courses,
       'pending',s.pending,'credits',case when s.is_complete then s.credits else null end,
       'gpa',s.gpa,'gpax_to_date',s.gpax_to_date,'status',s.status,
       'complete',s.is_complete
     ) order by s.sequence) from shown s
   ),'[]'::jsonb),
   'gpax',(select l.gpax_to_date from latest l),
   'completed_terms',coalesce((select l.sequence from latest l),0),
   'expected_terms',v_period_count,
   'period_type',case when v_primary then 'year' else 'semester' end,
   'status',case when coalesce((select l.sequence from latest l),0)=0 then 'no_completed_terms'
     when (select l.sequence from latest l)=v_period_count then 'complete'
     else 'in_progress' end
 ) into v_result;
 return v_result;
end $function$

  and e.status in ('active','completed')
 order by y.year_be desc, case when e.status='active' then 0 else 1 end
 limit 1;
 if v_grade is null then
  return jsonb_build_object('terms','[]'::jsonb,'gpax',null,'completed_terms',0,
   'expected_terms',0,'status','not_secondary');
 end if;
 select cv.id into v_version from public.curriculum_versions cv
 where cv.school_id=p_school and cv.effective_year_be<=v_year
 order by cv.effective_year_be desc limit 1;
 with periods as (
   select n as sequence,((n+1)/2)::integer as grade_no,
     'ม.'||((n+1)/2)::text as level_code,
     case when n%2=1 then 1 else 2 end as term_no,
     v_year-(v_grade-((n+1)/2)::integer) as year_be
   from generate_series(1,v_grade*2) as n
 ),
 expected as (
   select p.*,coalesce((
     select count(*)::int from public.subjects s
     where s.school_id=p_school and s.curriculum_version_id=v_version
      and s.grade_level=p.level_code and s.semester_no=p.term_no
      and s.category in ('basic','additional')
      -- The six computer offerings are for teacher scores/PP.5 only, not official GPAX.
      and s.subject_code !~ '^ง2[1-3]20[12]$'
   ),0) as expected_courses
   from periods p
 ),
 source_rows as (
   select r.year_be,r.level_code,r.term_no,r.subject_code,r.status,r.weight,
     case when r.status='ready' and r.grade ~ '^(0|[1-3]([.]5)?|4)$'
       then r.grade::numeric else null end as grade_value
   from jsonb_to_recordset(v_payload->'rows') as r(
     year_be integer,level_code text,term_no integer,subject_code text,
     status text,grade text,weight numeric,is_activity boolean)
   where not r.is_activity
 ),
 raw as (
   select p.sequence,p.grade_no,p.level_code,p.term_no,p.year_be,p.expected_courses,
     count(r.subject_code)::int as subjects,
     count(r.subject_code) filter (
       where r.grade_value is null or r.status<>'ready' or r.weight is null or r.weight<=0
     )::int as pending,
     coalesce(sum(r.grade_value*r.weight) filter(
       where r.status='ready' and r.grade_value is not null and r.weight>0),0) as points,
     coalesce(sum(r.weight) filter(
       where r.status='ready' and r.grade_value is not null and r.weight>0),0) as credits
   from expected p left join source_rows r
    on r.year_be=p.year_be and r.level_code=p.level_code and r.term_no=p.term_no
   group by p.sequence,p.grade_no,p.level_code,p.term_no,p.year_be,p.expected_courses
 ),
 term_stats as (
   select raw.*,
     (expected_courses>0 and subjects=expected_courses and pending=0 and credits>0) as is_complete,
     case when subjects=0 then 'not_started'
       when subjects<expected_courses then 'missing_courses'
       when subjects>expected_courses then 'extra_courses'
       when pending>0 then 'incomplete_results'
       when credits<=0 then 'missing_credits'
       else 'complete' end as status
   from raw
 ),
 accum as (
   select t.*,
    sum(case when is_complete then 0 else 1 end) over(order by sequence) as failed_prefix,
    sum(case when is_complete then points else 0 end) over(order by sequence) as accumulated_points,
    sum(case when is_complete then credits else 0 end) over(order by sequence) as accumulated_credits
   from term_stats t
 ),
 shown as (
   select a.*,
      case when is_complete then round(points/credits,2) else null end as gpa,
      case when failed_prefix=0 and accumulated_credits>0
         then round(accumulated_points/accumulated_credits,2) else null end as gpax_to_date
   from accum a
 ),
 latest as (
   select sequence,gpax_to_date from shown where is_complete and failed_prefix=0
   order by sequence desc limit 1
 )
 select jsonb_build_object(
   'terms',coalesce((
     select jsonb_agg(jsonb_build_object(
       'sequence',s.sequence,'year_be',s.year_be,'level_code',s.level_code,
       'term_no',s.term_no,'subjects',s.subjects,'expected_subjects',s.expected_courses,
       'pending',s.pending,'credits',case when s.is_complete then s.credits else null end,
       'gpa',s.gpa,'gpax_to_date',s.gpax_to_date,'status',s.status,
       'complete',s.is_complete
     ) order by s.sequence) from shown s
   ),'[]'::jsonb),
   'gpax',(select l.gpax_to_date from latest l),
   'completed_terms',coalesce((select l.sequence from latest l),0),
   'expected_terms',v_grade*2,
   'status',case when coalesce((select l.sequence from latest l),0)=0 then 'no_completed_terms'
     when (select l.sequence from latest l)=v_grade*2 then 'complete'
     else 'in_progress' end
 ) into v_result;
 return v_result;
end $function$
)
        or
        (not v_primary and s.semester_no=p.term_no
          -- These secondary computer offerings are for PP.5 only, not official GPA.
          and s.subject_code !~ '^ง2[1-3]20[12]
   ),0) as expected_courses
   from periods p
 ),
 source_rows as (
   select r.year_be,r.level_code,r.term_no,r.subject_code,r.status,r.weight,
     case when r.status='ready' and r.grade ~ '^(0|[1-3]([.]5)?|4)$'
       then r.grade::numeric else null end as grade_value
   from jsonb_to_recordset(v_payload->'rows') as r(
     year_be integer,level_code text,term_no integer,subject_code text,
     status text,grade text,weight numeric,is_activity boolean)
   where not r.is_activity
 ),
 raw as (
   select p.sequence,p.grade_no,p.level_code,p.term_no,p.year_be,p.expected_courses,
     count(r.subject_code)::int as subjects,
     count(r.subject_code) filter (
       where r.grade_value is null or r.status<>'ready' or r.weight is null or r.weight<=0
     )::int as pending,
     coalesce(sum(r.grade_value*r.weight) filter(
       where r.status='ready' and r.grade_value is not null and r.weight>0),0) as points,
     coalesce(sum(r.weight) filter(
       where r.status='ready' and r.grade_value is not null and r.weight>0),0) as credits
   from expected p left join source_rows r
    on r.year_be=p.year_be and r.level_code=p.level_code and r.term_no=p.term_no
   group by p.sequence,p.grade_no,p.level_code,p.term_no,p.year_be,p.expected_courses
 ),
 term_stats as (
   select raw.*,
     (expected_courses>0 and subjects=expected_courses and pending=0 and credits>0) as is_complete,
     case when subjects=0 then 'not_started'
       when subjects<expected_courses then 'missing_courses'
       when subjects>expected_courses then 'extra_courses'
       when pending>0 then 'incomplete_results'
       when credits<=0 then 'missing_credits'
       else 'complete' end as status
   from raw
 ),
 accum as (
   select t.*,
    sum(case when is_complete then 0 else 1 end) over(order by sequence) as failed_prefix,
    sum(case when is_complete then points else 0 end) over(order by sequence) as accumulated_points,
    sum(case when is_complete then credits else 0 end) over(order by sequence) as accumulated_credits
   from term_stats t
 ),
 shown as (
   select a.*,
      case when is_complete then round(points/credits,2) else null end as gpa,
      case when failed_prefix=0 and accumulated_credits>0
         then round(accumulated_points/accumulated_credits,2) else null end as gpax_to_date
   from accum a
 ),
 latest as (
   select sequence,gpax_to_date from shown where is_complete and failed_prefix=0
   order by sequence desc limit 1
 )
 select jsonb_build_object(
   'terms',coalesce((
     select jsonb_agg(jsonb_build_object(
       'sequence',s.sequence,'year_be',s.year_be,'level_code',s.level_code,
       'term_no',s.term_no,'subjects',s.subjects,'expected_subjects',s.expected_courses,
       'pending',s.pending,'credits',case when s.is_complete then s.credits else null end,
       'gpa',s.gpa,'gpax_to_date',s.gpax_to_date,'status',s.status,
       'complete',s.is_complete
     ) order by s.sequence) from shown s
   ),'[]'::jsonb),
   'gpax',(select l.gpax_to_date from latest l),
   'completed_terms',coalesce((select l.sequence from latest l),0),
   'expected_terms',v_grade*2,
   'status',case when coalesce((select l.sequence from latest l),0)=0 then 'no_completed_terms'
     when (select l.sequence from latest l)=v_grade*2 then 'complete'
     else 'in_progress' end
 ) into v_result;
 return v_result;
end $function$

  and e.status in ('active','completed')
 order by y.year_be desc, case when e.status='active' then 0 else 1 end
 limit 1;
 if v_grade is null then
  return jsonb_build_object('terms','[]'::jsonb,'gpax',null,'completed_terms',0,
   'expected_terms',0,'status','not_secondary');
 end if;
 select cv.id into v_version from public.curriculum_versions cv
 where cv.school_id=p_school and cv.effective_year_be<=v_year
 order by cv.effective_year_be desc limit 1;
 with periods as (
   select n as sequence,((n+1)/2)::integer as grade_no,
     'ม.'||((n+1)/2)::text as level_code,
     case when n%2=1 then 1 else 2 end as term_no,
     v_year-(v_grade-((n+1)/2)::integer) as year_be
   from generate_series(1,v_grade*2) as n
 ),
 expected as (
   select p.*,coalesce((
     select count(*)::int from public.subjects s
     where s.school_id=p_school and s.curriculum_version_id=v_version
      and s.grade_level=p.level_code and s.semester_no=p.term_no
      and s.category in ('basic','additional')
      -- The six computer offerings are for teacher scores/PP.5 only, not official GPAX.
      and s.subject_code !~ '^ง2[1-3]20[12]$'
   ),0) as expected_courses
   from periods p
 ),
 source_rows as (
   select r.year_be,r.level_code,r.term_no,r.subject_code,r.status,r.weight,
     case when r.status='ready' and r.grade ~ '^(0|[1-3]([.]5)?|4)$'
       then r.grade::numeric else null end as grade_value
   from jsonb_to_recordset(v_payload->'rows') as r(
     year_be integer,level_code text,term_no integer,subject_code text,
     status text,grade text,weight numeric,is_activity boolean)
   where not r.is_activity
 ),
 raw as (
   select p.sequence,p.grade_no,p.level_code,p.term_no,p.year_be,p.expected_courses,
     count(r.subject_code)::int as subjects,
     count(r.subject_code) filter (
       where r.grade_value is null or r.status<>'ready' or r.weight is null or r.weight<=0
     )::int as pending,
     coalesce(sum(r.grade_value*r.weight) filter(
       where r.status='ready' and r.grade_value is not null and r.weight>0),0) as points,
     coalesce(sum(r.weight) filter(
       where r.status='ready' and r.grade_value is not null and r.weight>0),0) as credits
   from expected p left join source_rows r
    on r.year_be=p.year_be and r.level_code=p.level_code and r.term_no=p.term_no
   group by p.sequence,p.grade_no,p.level_code,p.term_no,p.year_be,p.expected_courses
 ),
 term_stats as (
   select raw.*,
     (expected_courses>0 and subjects=expected_courses and pending=0 and credits>0) as is_complete,
     case when subjects=0 then 'not_started'
       when subjects<expected_courses then 'missing_courses'
       when subjects>expected_courses then 'extra_courses'
       when pending>0 then 'incomplete_results'
       when credits<=0 then 'missing_credits'
       else 'complete' end as status
   from raw
 ),
 accum as (
   select t.*,
    sum(case when is_complete then 0 else 1 end) over(order by sequence) as failed_prefix,
    sum(case when is_complete then points else 0 end) over(order by sequence) as accumulated_points,
    sum(case when is_complete then credits else 0 end) over(order by sequence) as accumulated_credits
   from term_stats t
 ),
 shown as (
   select a.*,
      case when is_complete then round(points/credits,2) else null end as gpa,
      case when failed_prefix=0 and accumulated_credits>0
         then round(accumulated_points/accumulated_credits,2) else null end as gpax_to_date
   from accum a
 ),
 latest as (
   select sequence,gpax_to_date from shown where is_complete and failed_prefix=0
   order by sequence desc limit 1
 )
 select jsonb_build_object(
   'terms',coalesce((
     select jsonb_agg(jsonb_build_object(
       'sequence',s.sequence,'year_be',s.year_be,'level_code',s.level_code,
       'term_no',s.term_no,'subjects',s.subjects,'expected_subjects',s.expected_courses,
       'pending',s.pending,'credits',case when s.is_complete then s.credits else null end,
       'gpa',s.gpa,'gpax_to_date',s.gpax_to_date,'status',s.status,
       'complete',s.is_complete
     ) order by s.sequence) from shown s
   ),'[]'::jsonb),
   'gpax',(select l.gpax_to_date from latest l),
   'completed_terms',coalesce((select l.sequence from latest l),0),
   'expected_terms',v_grade*2,
   'status',case when coalesce((select l.sequence from latest l),0)=0 then 'no_completed_terms'
     when (select l.sequence from latest l)=v_grade*2 then 'complete'
     else 'in_progress' end
 ) into v_result;
 return v_result;
end $function$
)
      )
   ),0) as expected_courses
   from periods p
 ),
 source_rows as (
   select r.year_be,r.level_code,r.term_no,r.subject_code,r.status,r.weight,
     case when r.status='ready' and r.grade ~ '^(0|[1-3]([.]5)?|4)$'
       then r.grade::numeric else null end as grade_value
   from jsonb_to_recordset(v_payload->'rows') as r(
     year_be integer,level_code text,term_no integer,subject_code text,
     status text,grade text,weight numeric,is_activity boolean)
   where not r.is_activity
 ),
 raw as (
   select p.sequence,p.grade_no,p.level_code,p.term_no,p.year_be,p.expected_courses,
     count(r.subject_code)::int as subjects,
     count(r.subject_code) filter (
       where r.grade_value is null or r.status<>'ready' or r.weight is null or r.weight<=0
     )::int as pending,
     coalesce(sum(r.grade_value*r.weight) filter(
       where r.status='ready' and r.grade_value is not null and r.weight>0),0) as points,
     coalesce(sum(r.weight) filter(
       where r.status='ready' and r.grade_value is not null and r.weight>0),0) as credits
   from expected p left join source_rows r
    on r.year_be=p.year_be and r.level_code=p.level_code and r.term_no=p.term_no
   group by p.sequence,p.grade_no,p.level_code,p.term_no,p.year_be,p.expected_courses
 ),
 term_stats as (
   select raw.*,
     (expected_courses>0 and subjects=expected_courses and pending=0 and credits>0) as is_complete,
     case when subjects=0 then 'not_started'
       when subjects<expected_courses then 'missing_courses'
       when subjects>expected_courses then 'extra_courses'
       when pending>0 then 'incomplete_results'
       when credits<=0 then 'missing_credits'
       else 'complete' end as status
   from raw
 ),
 accum as (
   select t.*,
    sum(case when is_complete then 0 else 1 end) over(order by sequence) as failed_prefix,
    sum(case when is_complete then points else 0 end) over(order by sequence) as accumulated_points,
    sum(case when is_complete then credits else 0 end) over(order by sequence) as accumulated_credits
   from term_stats t
 ),
 shown as (
   select a.*,
      case when is_complete then round(points/credits,2) else null end as gpa,
      case when failed_prefix=0 and accumulated_credits>0
         then round(accumulated_points/accumulated_credits,2) else null end as gpax_to_date
   from accum a
 ),
 latest as (
   select sequence,gpax_to_date from shown where is_complete and failed_prefix=0
   order by sequence desc limit 1
 )
 select jsonb_build_object(
   'terms',coalesce((
     select jsonb_agg(jsonb_build_object(
       'sequence',s.sequence,'year_be',s.year_be,'level_code',s.level_code,
       'term_no',s.term_no,'subjects',s.subjects,'expected_subjects',s.expected_courses,
       'pending',s.pending,'credits',case when s.is_complete then s.credits else null end,
       'gpa',s.gpa,'gpax_to_date',s.gpax_to_date,'status',s.status,
       'complete',s.is_complete
     ) order by s.sequence) from shown s
   ),'[]'::jsonb),
   'gpax',(select l.gpax_to_date from latest l),
   'completed_terms',coalesce((select l.sequence from latest l),0),
   'expected_terms',v_grade*2,
   'status',case when coalesce((select l.sequence from latest l),0)=0 then 'no_completed_terms'
     when (select l.sequence from latest l)=v_grade*2 then 'complete'
     else 'in_progress' end
 ) into v_result;
 return v_result;
end $function$

  and e.status in ('active','completed')
 order by y.year_be desc, case when e.status='active' then 0 else 1 end
 limit 1;
 if v_grade is null then
  return jsonb_build_object('terms','[]'::jsonb,'gpax',null,'completed_terms',0,
   'expected_terms',0,'status','not_secondary');
 end if;
 select cv.id into v_version from public.curriculum_versions cv
 where cv.school_id=p_school and cv.effective_year_be<=v_year
 order by cv.effective_year_be desc limit 1;
 with periods as (
   select n as sequence,((n+1)/2)::integer as grade_no,
     'ม.'||((n+1)/2)::text as level_code,
     case when n%2=1 then 1 else 2 end as term_no,
     v_year-(v_grade-((n+1)/2)::integer) as year_be
   from generate_series(1,v_grade*2) as n
 ),
 expected as (
   select p.*,coalesce((
     select count(*)::int from public.subjects s
     where s.school_id=p_school and s.curriculum_version_id=v_version
      and s.grade_level=p.level_code and s.semester_no=p.term_no
      and s.category in ('basic','additional')
      -- The six computer offerings are for teacher scores/PP.5 only, not official GPAX.
      and s.subject_code !~ '^ง2[1-3]20[12]$'
   ),0) as expected_courses
   from periods p
 ),
 source_rows as (
   select r.year_be,r.level_code,r.term_no,r.subject_code,r.status,r.weight,
     case when r.status='ready' and r.grade ~ '^(0|[1-3]([.]5)?|4)$'
       then r.grade::numeric else null end as grade_value
   from jsonb_to_recordset(v_payload->'rows') as r(
     year_be integer,level_code text,term_no integer,subject_code text,
     status text,grade text,weight numeric,is_activity boolean)
   where not r.is_activity
 ),
 raw as (
   select p.sequence,p.grade_no,p.level_code,p.term_no,p.year_be,p.expected_courses,
     count(r.subject_code)::int as subjects,
     count(r.subject_code) filter (
       where r.grade_value is null or r.status<>'ready' or r.weight is null or r.weight<=0
     )::int as pending,
     coalesce(sum(r.grade_value*r.weight) filter(
       where r.status='ready' and r.grade_value is not null and r.weight>0),0) as points,
     coalesce(sum(r.weight) filter(
       where r.status='ready' and r.grade_value is not null and r.weight>0),0) as credits
   from expected p left join source_rows r
    on r.year_be=p.year_be and r.level_code=p.level_code and r.term_no=p.term_no
   group by p.sequence,p.grade_no,p.level_code,p.term_no,p.year_be,p.expected_courses
 ),
 term_stats as (
   select raw.*,
     (expected_courses>0 and subjects=expected_courses and pending=0 and credits>0) as is_complete,
     case when subjects=0 then 'not_started'
       when subjects<expected_courses then 'missing_courses'
       when subjects>expected_courses then 'extra_courses'
       when pending>0 then 'incomplete_results'
       when credits<=0 then 'missing_credits'
       else 'complete' end as status
   from raw
 ),
 accum as (
   select t.*,
    sum(case when is_complete then 0 else 1 end) over(order by sequence) as failed_prefix,
    sum(case when is_complete then points else 0 end) over(order by sequence) as accumulated_points,
    sum(case when is_complete then credits else 0 end) over(order by sequence) as accumulated_credits
   from term_stats t
 ),
 shown as (
   select a.*,
      case when is_complete then round(points/credits,2) else null end as gpa,
      case when failed_prefix=0 and accumulated_credits>0
         then round(accumulated_points/accumulated_credits,2) else null end as gpax_to_date
   from accum a
 ),
 latest as (
   select sequence,gpax_to_date from shown where is_complete and failed_prefix=0
   order by sequence desc limit 1
 )
 select jsonb_build_object(
   'terms',coalesce((
     select jsonb_agg(jsonb_build_object(
       'sequence',s.sequence,'year_be',s.year_be,'level_code',s.level_code,
       'term_no',s.term_no,'subjects',s.subjects,'expected_subjects',s.expected_courses,
       'pending',s.pending,'credits',case when s.is_complete then s.credits else null end,
       'gpa',s.gpa,'gpax_to_date',s.gpax_to_date,'status',s.status,
       'complete',s.is_complete
     ) order by s.sequence) from shown s
   ),'[]'::jsonb),
   'gpax',(select l.gpax_to_date from latest l),
   'completed_terms',coalesce((select l.sequence from latest l),0),
   'expected_terms',v_grade*2,
   'status',case when coalesce((select l.sequence from latest l),0)=0 then 'no_completed_terms'
     when (select l.sequence from latest l)=v_grade*2 then 'complete'
     else 'in_progress' end
 ) into v_result;
 return v_result;
end $function$
)
 ),
 raw as (
   select p.sequence,p.grade_no,p.level_code,p.term_no,p.year_be,p.expected_courses,
     count(r.subject_code)::int as subjects,
     count(r.subject_code) filter (
       where r.grade_value is null or r.status<>'ready' or r.weight is null or r.weight<=0
     )::int as pending,
     coalesce(sum(r.grade_value*r.weight) filter(
       where r.status='ready' and r.grade_value is not null and r.weight>0),0) as points,
     coalesce(sum(r.weight) filter(
       where r.status='ready' and r.grade_value is not null and r.weight>0),0) as credits
   from expected p left join source_rows r
    on r.year_be=p.year_be and r.level_code=p.level_code and r.term_no=p.term_no
   group by p.sequence,p.grade_no,p.level_code,p.term_no,p.year_be,p.expected_courses
 ),
 term_stats as (
   select raw.*,
     (expected_courses>0 and subjects=expected_courses and pending=0 and credits>0) as is_complete,
     case when subjects=0 then 'not_started'
       when subjects<expected_courses then 'missing_courses'
       when subjects>expected_courses then 'extra_courses'
       when pending>0 then 'incomplete_results'
       when credits<=0 then 'missing_credits'
       else 'complete' end as status
   from raw
 ),
 accum as (
   select t.*,
    sum(case when is_complete then 0 else 1 end) over(order by sequence) as failed_prefix,
    sum(case when is_complete then points else 0 end) over(order by sequence) as accumulated_points,
    sum(case when is_complete then credits else 0 end) over(order by sequence) as accumulated_credits
   from term_stats t
 ),
 shown as (
   select a.*,
      case when is_complete then round(points/credits,2) else null end as gpa,
      case when failed_prefix=0 and accumulated_credits>0
         then round(accumulated_points/accumulated_credits,2) else null end as gpax_to_date
   from accum a
 ),
 latest as (
   select sequence,gpax_to_date from shown where is_complete and failed_prefix=0
   order by sequence desc limit 1
 )
 select jsonb_build_object(
   'terms',coalesce((
     select jsonb_agg(jsonb_build_object(
       'sequence',s.sequence,'year_be',s.year_be,'level_code',s.level_code,
       'term_no',s.term_no,'subjects',s.subjects,'expected_subjects',s.expected_courses,
       'pending',s.pending,'credits',case when s.is_complete then s.credits else null end,
       'gpa',s.gpa,'gpax_to_date',s.gpax_to_date,'status',s.status,
       'complete',s.is_complete
     ) order by s.sequence) from shown s
   ),'[]'::jsonb),
   'gpax',(select l.gpax_to_date from latest l),
   'completed_terms',coalesce((select l.sequence from latest l),0),
   'expected_terms',v_grade*2,
   'status',case when coalesce((select l.sequence from latest l),0)=0 then 'no_completed_terms'
     when (select l.sequence from latest l)=v_grade*2 then 'complete'
     else 'in_progress' end
 ) into v_result;
 return v_result;
end $function$

  and e.status in ('active','completed')
 order by y.year_be desc, case when e.status='active' then 0 else 1 end
 limit 1;
 if v_grade is null then
  return jsonb_build_object('terms','[]'::jsonb,'gpax',null,'completed_terms',0,
   'expected_terms',0,'status','not_secondary');
 end if;
 select cv.id into v_version from public.curriculum_versions cv
 where cv.school_id=p_school and cv.effective_year_be<=v_year
 order by cv.effective_year_be desc limit 1;
 with periods as (
   select n as sequence,((n+1)/2)::integer as grade_no,
     'ม.'||((n+1)/2)::text as level_code,
     case when n%2=1 then 1 else 2 end as term_no,
     v_year-(v_grade-((n+1)/2)::integer) as year_be
   from generate_series(1,v_grade*2) as n
 ),
 expected as (
   select p.*,coalesce((
     select count(*)::int from public.subjects s
     where s.school_id=p_school and s.curriculum_version_id=v_version
      and s.grade_level=p.level_code and s.semester_no=p.term_no
      and s.category in ('basic','additional')
      -- The six computer offerings are for teacher scores/PP.5 only, not official GPAX.
      and s.subject_code !~ '^ง2[1-3]20[12]$'
   ),0) as expected_courses
   from periods p
 ),
 source_rows as (
   select r.year_be,r.level_code,r.term_no,r.subject_code,r.status,r.weight,
     case when r.status='ready' and r.grade ~ '^(0|[1-3]([.]5)?|4)$'
       then r.grade::numeric else null end as grade_value
   from jsonb_to_recordset(v_payload->'rows') as r(
     year_be integer,level_code text,term_no integer,subject_code text,
     status text,grade text,weight numeric,is_activity boolean)
   where not r.is_activity
 ),
 raw as (
   select p.sequence,p.grade_no,p.level_code,p.term_no,p.year_be,p.expected_courses,
     count(r.subject_code)::int as subjects,
     count(r.subject_code) filter (
       where r.grade_value is null or r.status<>'ready' or r.weight is null or r.weight<=0
     )::int as pending,
     coalesce(sum(r.grade_value*r.weight) filter(
       where r.status='ready' and r.grade_value is not null and r.weight>0),0) as points,
     coalesce(sum(r.weight) filter(
       where r.status='ready' and r.grade_value is not null and r.weight>0),0) as credits
   from expected p left join source_rows r
    on r.year_be=p.year_be and r.level_code=p.level_code and r.term_no=p.term_no
   group by p.sequence,p.grade_no,p.level_code,p.term_no,p.year_be,p.expected_courses
 ),
 term_stats as (
   select raw.*,
     (expected_courses>0 and subjects=expected_courses and pending=0 and credits>0) as is_complete,
     case when subjects=0 then 'not_started'
       when subjects<expected_courses then 'missing_courses'
       when subjects>expected_courses then 'extra_courses'
       when pending>0 then 'incomplete_results'
       when credits<=0 then 'missing_credits'
       else 'complete' end as status
   from raw
 ),
 accum as (
   select t.*,
    sum(case when is_complete then 0 else 1 end) over(order by sequence) as failed_prefix,
    sum(case when is_complete then points else 0 end) over(order by sequence) as accumulated_points,
    sum(case when is_complete then credits else 0 end) over(order by sequence) as accumulated_credits
   from term_stats t
 ),
 shown as (
   select a.*,
      case when is_complete then round(points/credits,2) else null end as gpa,
      case when failed_prefix=0 and accumulated_credits>0
         then round(accumulated_points/accumulated_credits,2) else null end as gpax_to_date
   from accum a
 ),
 latest as (
   select sequence,gpax_to_date from shown where is_complete and failed_prefix=0
   order by sequence desc limit 1
 )
 select jsonb_build_object(
   'terms',coalesce((
     select jsonb_agg(jsonb_build_object(
       'sequence',s.sequence,'year_be',s.year_be,'level_code',s.level_code,
       'term_no',s.term_no,'subjects',s.subjects,'expected_subjects',s.expected_courses,
       'pending',s.pending,'credits',case when s.is_complete then s.credits else null end,
       'gpa',s.gpa,'gpax_to_date',s.gpax_to_date,'status',s.status,
       'complete',s.is_complete
     ) order by s.sequence) from shown s
   ),'[]'::jsonb),
   'gpax',(select l.gpax_to_date from latest l),
   'completed_terms',coalesce((select l.sequence from latest l),0),
   'expected_terms',v_grade*2,
   'status',case when coalesce((select l.sequence from latest l),0)=0 then 'no_completed_terms'
     when (select l.sequence from latest l)=v_grade*2 then 'complete'
     else 'in_progress' end
 ) into v_result;
 return v_result;
end $function$
)
        or
        (not v_primary and s.semester_no=p.term_no
          -- These secondary computer offerings are for PP.5 only, not official GPA.
          and s.subject_code !~ '^ง2[1-3]20[12]
   ),0) as expected_courses
   from periods p
 ),
 source_rows as (
   select r.year_be,r.level_code,r.term_no,r.subject_code,r.status,r.weight,
     case when r.status='ready' and r.grade ~ '^(0|[1-3]([.]5)?|4)$'
       then r.grade::numeric else null end as grade_value
   from jsonb_to_recordset(v_payload->'rows') as r(
     year_be integer,level_code text,term_no integer,subject_code text,
     status text,grade text,weight numeric,is_activity boolean)
   where not r.is_activity
 ),
 raw as (
   select p.sequence,p.grade_no,p.level_code,p.term_no,p.year_be,p.expected_courses,
     count(r.subject_code)::int as subjects,
     count(r.subject_code) filter (
       where r.grade_value is null or r.status<>'ready' or r.weight is null or r.weight<=0
     )::int as pending,
     coalesce(sum(r.grade_value*r.weight) filter(
       where r.status='ready' and r.grade_value is not null and r.weight>0),0) as points,
     coalesce(sum(r.weight) filter(
       where r.status='ready' and r.grade_value is not null and r.weight>0),0) as credits
   from expected p left join source_rows r
    on r.year_be=p.year_be and r.level_code=p.level_code and r.term_no=p.term_no
   group by p.sequence,p.grade_no,p.level_code,p.term_no,p.year_be,p.expected_courses
 ),
 term_stats as (
   select raw.*,
     (expected_courses>0 and subjects=expected_courses and pending=0 and credits>0) as is_complete,
     case when subjects=0 then 'not_started'
       when subjects<expected_courses then 'missing_courses'
       when subjects>expected_courses then 'extra_courses'
       when pending>0 then 'incomplete_results'
       when credits<=0 then 'missing_credits'
       else 'complete' end as status
   from raw
 ),
 accum as (
   select t.*,
    sum(case when is_complete then 0 else 1 end) over(order by sequence) as failed_prefix,
    sum(case when is_complete then points else 0 end) over(order by sequence) as accumulated_points,
    sum(case when is_complete then credits else 0 end) over(order by sequence) as accumulated_credits
   from term_stats t
 ),
 shown as (
   select a.*,
      case when is_complete then round(points/credits,2) else null end as gpa,
      case when failed_prefix=0 and accumulated_credits>0
         then round(accumulated_points/accumulated_credits,2) else null end as gpax_to_date
   from accum a
 ),
 latest as (
   select sequence,gpax_to_date from shown where is_complete and failed_prefix=0
   order by sequence desc limit 1
 )
 select jsonb_build_object(
   'terms',coalesce((
     select jsonb_agg(jsonb_build_object(
       'sequence',s.sequence,'year_be',s.year_be,'level_code',s.level_code,
       'term_no',s.term_no,'subjects',s.subjects,'expected_subjects',s.expected_courses,
       'pending',s.pending,'credits',case when s.is_complete then s.credits else null end,
       'gpa',s.gpa,'gpax_to_date',s.gpax_to_date,'status',s.status,
       'complete',s.is_complete
     ) order by s.sequence) from shown s
   ),'[]'::jsonb),
   'gpax',(select l.gpax_to_date from latest l),
   'completed_terms',coalesce((select l.sequence from latest l),0),
   'expected_terms',v_grade*2,
   'status',case when coalesce((select l.sequence from latest l),0)=0 then 'no_completed_terms'
     when (select l.sequence from latest l)=v_grade*2 then 'complete'
     else 'in_progress' end
 ) into v_result;
 return v_result;
end $function$

  and e.status in ('active','completed')
 order by y.year_be desc, case when e.status='active' then 0 else 1 end
 limit 1;
 if v_grade is null then
  return jsonb_build_object('terms','[]'::jsonb,'gpax',null,'completed_terms',0,
   'expected_terms',0,'status','not_secondary');
 end if;
 select cv.id into v_version from public.curriculum_versions cv
 where cv.school_id=p_school and cv.effective_year_be<=v_year
 order by cv.effective_year_be desc limit 1;
 with periods as (
   select n as sequence,((n+1)/2)::integer as grade_no,
     'ม.'||((n+1)/2)::text as level_code,
     case when n%2=1 then 1 else 2 end as term_no,
     v_year-(v_grade-((n+1)/2)::integer) as year_be
   from generate_series(1,v_grade*2) as n
 ),
 expected as (
   select p.*,coalesce((
     select count(*)::int from public.subjects s
     where s.school_id=p_school and s.curriculum_version_id=v_version
      and s.grade_level=p.level_code and s.semester_no=p.term_no
      and s.category in ('basic','additional')
      -- The six computer offerings are for teacher scores/PP.5 only, not official GPAX.
      and s.subject_code !~ '^ง2[1-3]20[12]$'
   ),0) as expected_courses
   from periods p
 ),
 source_rows as (
   select r.year_be,r.level_code,r.term_no,r.subject_code,r.status,r.weight,
     case when r.status='ready' and r.grade ~ '^(0|[1-3]([.]5)?|4)$'
       then r.grade::numeric else null end as grade_value
   from jsonb_to_recordset(v_payload->'rows') as r(
     year_be integer,level_code text,term_no integer,subject_code text,
     status text,grade text,weight numeric,is_activity boolean)
   where not r.is_activity
 ),
 raw as (
   select p.sequence,p.grade_no,p.level_code,p.term_no,p.year_be,p.expected_courses,
     count(r.subject_code)::int as subjects,
     count(r.subject_code) filter (
       where r.grade_value is null or r.status<>'ready' or r.weight is null or r.weight<=0
     )::int as pending,
     coalesce(sum(r.grade_value*r.weight) filter(
       where r.status='ready' and r.grade_value is not null and r.weight>0),0) as points,
     coalesce(sum(r.weight) filter(
       where r.status='ready' and r.grade_value is not null and r.weight>0),0) as credits
   from expected p left join source_rows r
    on r.year_be=p.year_be and r.level_code=p.level_code and r.term_no=p.term_no
   group by p.sequence,p.grade_no,p.level_code,p.term_no,p.year_be,p.expected_courses
 ),
 term_stats as (
   select raw.*,
     (expected_courses>0 and subjects=expected_courses and pending=0 and credits>0) as is_complete,
     case when subjects=0 then 'not_started'
       when subjects<expected_courses then 'missing_courses'
       when subjects>expected_courses then 'extra_courses'
       when pending>0 then 'incomplete_results'
       when credits<=0 then 'missing_credits'
       else 'complete' end as status
   from raw
 ),
 accum as (
   select t.*,
    sum(case when is_complete then 0 else 1 end) over(order by sequence) as failed_prefix,
    sum(case when is_complete then points else 0 end) over(order by sequence) as accumulated_points,
    sum(case when is_complete then credits else 0 end) over(order by sequence) as accumulated_credits
   from term_stats t
 ),
 shown as (
   select a.*,
      case when is_complete then round(points/credits,2) else null end as gpa,
      case when failed_prefix=0 and accumulated_credits>0
         then round(accumulated_points/accumulated_credits,2) else null end as gpax_to_date
   from accum a
 ),
 latest as (
   select sequence,gpax_to_date from shown where is_complete and failed_prefix=0
   order by sequence desc limit 1
 )
 select jsonb_build_object(
   'terms',coalesce((
     select jsonb_agg(jsonb_build_object(
       'sequence',s.sequence,'year_be',s.year_be,'level_code',s.level_code,
       'term_no',s.term_no,'subjects',s.subjects,'expected_subjects',s.expected_courses,
       'pending',s.pending,'credits',case when s.is_complete then s.credits else null end,
       'gpa',s.gpa,'gpax_to_date',s.gpax_to_date,'status',s.status,
       'complete',s.is_complete
     ) order by s.sequence) from shown s
   ),'[]'::jsonb),
   'gpax',(select l.gpax_to_date from latest l),
   'completed_terms',coalesce((select l.sequence from latest l),0),
   'expected_terms',v_grade*2,
   'status',case when coalesce((select l.sequence from latest l),0)=0 then 'no_completed_terms'
     when (select l.sequence from latest l)=v_grade*2 then 'complete'
     else 'in_progress' end
 ) into v_result;
 return v_result;
end $function$
)
      )
   ),0) as expected_courses
   from periods p
 ),
 source_rows as (
   select r.year_be,r.level_code,r.term_no,r.subject_code,r.status,r.weight,
     case when r.status='ready' and r.grade ~ '^(0|[1-3]([.]5)?|4)$'
       then r.grade::numeric else null end as grade_value
   from jsonb_to_recordset(v_payload->'rows') as r(
     year_be integer,level_code text,term_no integer,subject_code text,
     status text,grade text,weight numeric,is_activity boolean)
   where not r.is_activity
 ),
 raw as (
   select p.sequence,p.grade_no,p.level_code,p.term_no,p.year_be,p.expected_courses,
     count(r.subject_code)::int as subjects,
     count(r.subject_code) filter (
       where r.grade_value is null or r.status<>'ready' or r.weight is null or r.weight<=0
     )::int as pending,
     coalesce(sum(r.grade_value*r.weight) filter(
       where r.status='ready' and r.grade_value is not null and r.weight>0),0) as points,
     coalesce(sum(r.weight) filter(
       where r.status='ready' and r.grade_value is not null and r.weight>0),0) as credits
   from expected p left join source_rows r
    on r.year_be=p.year_be and r.level_code=p.level_code and r.term_no=p.term_no
   group by p.sequence,p.grade_no,p.level_code,p.term_no,p.year_be,p.expected_courses
 ),
 term_stats as (
   select raw.*,
     (expected_courses>0 and subjects=expected_courses and pending=0 and credits>0) as is_complete,
     case when subjects=0 then 'not_started'
       when subjects<expected_courses then 'missing_courses'
       when subjects>expected_courses then 'extra_courses'
       when pending>0 then 'incomplete_results'
       when credits<=0 then 'missing_credits'
       else 'complete' end as status
   from raw
 ),
 accum as (
   select t.*,
    sum(case when is_complete then 0 else 1 end) over(order by sequence) as failed_prefix,
    sum(case when is_complete then points else 0 end) over(order by sequence) as accumulated_points,
    sum(case when is_complete then credits else 0 end) over(order by sequence) as accumulated_credits
   from term_stats t
 ),
 shown as (
   select a.*,
      case when is_complete then round(points/credits,2) else null end as gpa,
      case when failed_prefix=0 and accumulated_credits>0
         then round(accumulated_points/accumulated_credits,2) else null end as gpax_to_date
   from accum a
 ),
 latest as (
   select sequence,gpax_to_date from shown where is_complete and failed_prefix=0
   order by sequence desc limit 1
 )
 select jsonb_build_object(
   'terms',coalesce((
     select jsonb_agg(jsonb_build_object(
       'sequence',s.sequence,'year_be',s.year_be,'level_code',s.level_code,
       'term_no',s.term_no,'subjects',s.subjects,'expected_subjects',s.expected_courses,
       'pending',s.pending,'credits',case when s.is_complete then s.credits else null end,
       'gpa',s.gpa,'gpax_to_date',s.gpax_to_date,'status',s.status,
       'complete',s.is_complete
     ) order by s.sequence) from shown s
   ),'[]'::jsonb),
   'gpax',(select l.gpax_to_date from latest l),
   'completed_terms',coalesce((select l.sequence from latest l),0),
   'expected_terms',v_grade*2,
   'status',case when coalesce((select l.sequence from latest l),0)=0 then 'no_completed_terms'
     when (select l.sequence from latest l)=v_grade*2 then 'complete'
     else 'in_progress' end
 ) into v_result;
 return v_result;
end $function$

  and e.status in ('active','completed')
 order by y.year_be desc, case when e.status='active' then 0 else 1 end
 limit 1;
 if v_grade is null then
  return jsonb_build_object('terms','[]'::jsonb,'gpax',null,'completed_terms',0,
   'expected_terms',0,'status','not_secondary');
 end if;
 select cv.id into v_version from public.curriculum_versions cv
 where cv.school_id=p_school and cv.effective_year_be<=v_year
 order by cv.effective_year_be desc limit 1;
 with periods as (
   select n as sequence,((n+1)/2)::integer as grade_no,
     'ม.'||((n+1)/2)::text as level_code,
     case when n%2=1 then 1 else 2 end as term_no,
     v_year-(v_grade-((n+1)/2)::integer) as year_be
   from generate_series(1,v_grade*2) as n
 ),
 expected as (
   select p.*,coalesce((
     select count(*)::int from public.subjects s
     where s.school_id=p_school and s.curriculum_version_id=v_version
      and s.grade_level=p.level_code and s.semester_no=p.term_no
      and s.category in ('basic','additional')
      -- The six computer offerings are for teacher scores/PP.5 only, not official GPAX.
      and s.subject_code !~ '^ง2[1-3]20[12]$'
   ),0) as expected_courses
   from periods p
 ),
 source_rows as (
   select r.year_be,r.level_code,r.term_no,r.subject_code,r.status,r.weight,
     case when r.status='ready' and r.grade ~ '^(0|[1-3]([.]5)?|4)$'
       then r.grade::numeric else null end as grade_value
   from jsonb_to_recordset(v_payload->'rows') as r(
     year_be integer,level_code text,term_no integer,subject_code text,
     status text,grade text,weight numeric,is_activity boolean)
   where not r.is_activity
 ),
 raw as (
   select p.sequence,p.grade_no,p.level_code,p.term_no,p.year_be,p.expected_courses,
     count(r.subject_code)::int as subjects,
     count(r.subject_code) filter (
       where r.grade_value is null or r.status<>'ready' or r.weight is null or r.weight<=0
     )::int as pending,
     coalesce(sum(r.grade_value*r.weight) filter(
       where r.status='ready' and r.grade_value is not null and r.weight>0),0) as points,
     coalesce(sum(r.weight) filter(
       where r.status='ready' and r.grade_value is not null and r.weight>0),0) as credits
   from expected p left join source_rows r
    on r.year_be=p.year_be and r.level_code=p.level_code and r.term_no=p.term_no
   group by p.sequence,p.grade_no,p.level_code,p.term_no,p.year_be,p.expected_courses
 ),
 term_stats as (
   select raw.*,
     (expected_courses>0 and subjects=expected_courses and pending=0 and credits>0) as is_complete,
     case when subjects=0 then 'not_started'
       when subjects<expected_courses then 'missing_courses'
       when subjects>expected_courses then 'extra_courses'
       when pending>0 then 'incomplete_results'
       when credits<=0 then 'missing_credits'
       else 'complete' end as status
   from raw
 ),
 accum as (
   select t.*,
    sum(case when is_complete then 0 else 1 end) over(order by sequence) as failed_prefix,
    sum(case when is_complete then points else 0 end) over(order by sequence) as accumulated_points,
    sum(case when is_complete then credits else 0 end) over(order by sequence) as accumulated_credits
   from term_stats t
 ),
 shown as (
   select a.*,
      case when is_complete then round(points/credits,2) else null end as gpa,
      case when failed_prefix=0 and accumulated_credits>0
         then round(accumulated_points/accumulated_credits,2) else null end as gpax_to_date
   from accum a
 ),
 latest as (
   select sequence,gpax_to_date from shown where is_complete and failed_prefix=0
   order by sequence desc limit 1
 )
 select jsonb_build_object(
   'terms',coalesce((
     select jsonb_agg(jsonb_build_object(
       'sequence',s.sequence,'year_be',s.year_be,'level_code',s.level_code,
       'term_no',s.term_no,'subjects',s.subjects,'expected_subjects',s.expected_courses,
       'pending',s.pending,'credits',case when s.is_complete then s.credits else null end,
       'gpa',s.gpa,'gpax_to_date',s.gpax_to_date,'status',s.status,
       'complete',s.is_complete
     ) order by s.sequence) from shown s
   ),'[]'::jsonb),
   'gpax',(select l.gpax_to_date from latest l),
   'completed_terms',coalesce((select l.sequence from latest l),0),
   'expected_terms',v_grade*2,
   'status',case when coalesce((select l.sequence from latest l),0)=0 then 'no_completed_terms'
     when (select l.sequence from latest l)=v_grade*2 then 'complete'
     else 'in_progress' end
 ) into v_result;
 return v_result;
end $function$

CREATE OR REPLACE FUNCTION public.schoolmis_class_semester_summary(p_school uuid, p_academic_year_be integer, p_classroom uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_year uuid;v_level text;v_name text;v_summary jsonb;
begin
 if auth.uid() is null or not exists(
   select 1 from public.school_memberships m
   where m.school_id=p_school and m.user_id=auth.uid() and m.active
     and m.role in ('school_admin','registrar')
 ) then raise exception 'schoolmis_not_authorized';end if;
 select y.id,c.level_code,c.room_code into v_year,v_level,v_name
 from public.classrooms c join public.academic_years y
   on y.id=c.academic_year_id and y.school_id=c.school_id
 where c.id=p_classroom and c.school_id=p_school and y.year_be=p_academic_year_be;
 if v_year is null then raise exception 'schoolmis_classroom_not_found';end if;
 if v_level !~ '^(ป[.][1-6]|ม[.][1-3])
 select coalesce(jsonb_agg(
   jsonb_build_object('student_id',s.id,'student_no',s.student_no,
    'name',concat_ws(' ',coalesce(s.name_prefix_th,'')||s.first_name_th,s.last_name_th),
    'summary',public.schoolmis_student_semester_summary(p_school,s.id))
   order by s.student_no),'[]'::jsonb) into v_summary
 from public.students s where s.school_id=p_school
 and exists(select 1 from public.enrollments e
   where e.school_id=p_school and e.student_id=s.id
    and e.academic_year_id=v_year and e.classroom_id=p_classroom
    and e.status in ('active','completed'));
 return jsonb_build_object('year_be',p_academic_year_be,'level_code',v_level,
   'room_code',v_name,'students',v_summary);
end $function$
 then raise exception 'schoolmis_not_supported_classroom';end if;
 select coalesce(jsonb_agg(
   jsonb_build_object('student_id',s.id,'student_no',s.student_no,
    'name',concat_ws(' ',coalesce(s.name_prefix_th,'')||s.first_name_th,s.last_name_th),
    'summary',public.schoolmis_student_semester_summary(p_school,s.id))
   order by s.student_no),'[]'::jsonb) into v_summary
 from public.students s where s.school_id=p_school
 and exists(select 1 from public.enrollments e
   where e.school_id=p_school and e.student_id=s.id
    and e.academic_year_id=v_year and e.classroom_id=p_classroom
    and e.status in ('active','completed'));
 return jsonb_build_object('year_be',p_academic_year_be,'level_code',v_level,
   'room_code',v_name,'students',v_summary);
end $function$
