-- Admin-only aggregate SAR source data: never return a student's identity.
-- Period counts are per week and per term; do NOT assume one period is one hour.
create function public.sar_admin_auto_snapshot(p_year uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_school uuid;v_gender jsonb;v_load jsonb;v_unassigned bigint;
begin
 select y.school_id into v_school from public.academic_years y where y.id=p_year;
 if v_school is null or auth.uid() is null or not exists(
  select 1 from public.school_memberships m where m.school_id=v_school
   and m.user_id=auth.uid() and m.active and m.role='school_admin'
 ) then raise exception 'not_authorized';end if;

 with roster as (
  select distinct on(e.student_id) e.student_id,c.level_code,
   btrim(coalesce(s.name_prefix_th,'')) as prefix
  from public.enrollments e
  join public.students s on s.id=e.student_id and s.school_id=e.school_id
  join public.classrooms c on c.id=e.classroom_id and c.academic_year_id=e.academic_year_id and c.school_id=e.school_id
  where e.school_id=v_school and e.academic_year_id=p_year and e.status in ('active','completed')
  order by e.student_id,e.started_on desc nulls last,e.id
 ), counts as (
  select level_code,
   count(*)::integer as total,
   count(*) filter(where prefix in ('เด็กชาย','นาย','ด.ช.','ดช.'))::integer as male,
   count(*) filter(where prefix in ('เด็กหญิง','นางสาว','ด.ญ.','ดญ.','น.ส.'))::integer as female,
   count(*) filter(where prefix not in ('เด็กชาย','นาย','ด.ช.','ดช.','เด็กหญิง','นางสาว','ด.ญ.','ดญ.','น.ส.'))::integer as unknown
  from roster group by level_code
 )
 select coalesce(jsonb_agg(jsonb_build_object('level',level_code,'total',total,
   'male',male,'female',female,'unknown',unknown) order by level_code),'[]'::jsonb)
 into v_gender from counts;

 with weekly as (
  select ta.teacher_user_id as teacher_id,t.term_no,s.weekday_no,s.period_no,'course'::text as kind
  from public.timetable_slots s
  join public.terms t on t.id=s.term_id and t.school_id=v_school and t.academic_year_id=p_year
  join public.teaching_assignments ta on ta.course_offering_id=s.course_offering_id and ta.school_id=v_school
  where s.school_id=v_school
  union all
  select coalesce(a.teacher_user_id,h.teacher_user_id) as teacher_id,t.term_no,a.weekday_no,a.period_no,'activity'::text as kind
  from public.school_activity_schedules a
  join public.terms t on t.id=a.term_id and t.school_id=v_school and t.academic_year_id=p_year
  left join public.homeroom_assignments h on h.classroom_id=a.classroom_id
   and h.school_id=v_school and a.activity_type in ('club','scout') and a.teacher_user_id is null
  where a.school_id=v_school
 ), counts as (
  select w.teacher_id,w.term_no,
   count(distinct(w.weekday_no,w.period_no)) filter(where w.kind='course')::integer as course_periods,
   count(distinct(w.weekday_no,w.period_no)) filter(where w.kind='activity')::integer as activity_periods,
   count(distinct(w.weekday_no,w.period_no))::integer as total_periods
  from weekly w where w.teacher_id is not null group by w.teacher_id,w.term_no
 )
 select coalesce(jsonb_agg(jsonb_build_object('teacher_id',teacher_id,'term_no',term_no,
  'course_periods',course_periods,'activity_periods',activity_periods,'total_periods',total_periods)
  order by term_no,teacher_id),'[]'::jsonb)
 into v_load from counts;
 select count(*) into v_unassigned from public.school_activity_schedules a
 join public.terms t on t.id=a.term_id and t.academic_year_id=p_year and t.school_id=v_school
 where a.school_id=v_school and a.teacher_user_id is null
   and not exists(select 1 from public.homeroom_assignments h
    where h.school_id=v_school and h.classroom_id=a.classroom_id
      and a.activity_type in ('club','scout'));
 return jsonb_build_object('students',v_gender,'teaching_load',v_load,
   'activities_without_teacher',v_unassigned,'period_unit','periods_per_week');
end $$;
revoke all on function public.sar_admin_auto_snapshot(uuid) from public,anon;
grant execute on function public.sar_admin_auto_snapshot(uuid) to authenticated;
