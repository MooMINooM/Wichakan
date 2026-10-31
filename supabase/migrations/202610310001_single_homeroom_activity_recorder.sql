-- Designate exactly one homeroom recorder per classroom for club/scout.
-- An existing classroom without an explicit choice uses its earliest homeroom assignment.
alter table public.homeroom_assignments
 add column is_activity_recorder boolean not null default false;

create unique index homeroom_one_activity_recorder_per_room
 on public.homeroom_assignments(classroom_id)
 where is_activity_recorder;

create or replace function private.activity_homeroom_recorder(p_room uuid)
returns uuid language sql stable security invoker set search_path='' as $$
 select h.teacher_user_id
 from public.homeroom_assignments h
 where h.classroom_id=p_room
 order by h.is_activity_recorder desc,h.created_at,h.id
 limit 1;
$$;
revoke all on function private.activity_homeroom_recorder(uuid) from public,anon;
grant execute on function private.activity_homeroom_recorder(uuid) to authenticated;

-- Only school administrators can choose among already assigned homeroom teachers.
-- Column-limited UPDATE keeps the rest of a homeroom assignment immutable via this policy.
create policy "academic update activity recorder"
 on public.homeroom_assignments for update to authenticated
 using(private.has_school_role(school_id,array['school_admin','academic']))
 with check(private.has_school_role(school_id,array['school_admin','academic']));
grant update(is_activity_recorder) on public.homeroom_assignments to authenticated;

create or replace function public.assign_activity_homeroom_recorder(p_room uuid,p_teacher uuid)
returns void language plpgsql security invoker set search_path='' as $$
declare v_school uuid;
begin
 select c.school_id into v_school from public.classrooms c where c.id=p_room;
 if auth.uid() is null or v_school is null
    or not private.has_school_role(v_school,array['school_admin','academic']) then
  raise exception 'ไม่มีสิทธิ์กำหนดครูบันทึกกิจกรรม';
 end if;
 perform pg_advisory_xact_lock(hashtext(p_room::text));
 if not exists (
  select 1 from public.homeroom_assignments h
  join public.school_memberships m on m.school_id=h.school_id
    and m.user_id=h.teacher_user_id and m.active and m.role='teacher'
  where h.classroom_id=p_room and h.school_id=v_school and h.teacher_user_id=p_teacher
 ) then
  raise exception 'ต้องเลือกครูประจำชั้นที่ได้รับมอบหมายและยังปฏิบัติงานอยู่';
 end if;
 update public.homeroom_assignments
 set is_activity_recorder=false
 where school_id=v_school and classroom_id=p_room and is_activity_recorder;
 update public.homeroom_assignments
 set is_activity_recorder=true
 where school_id=v_school and classroom_id=p_room and teacher_user_id=p_teacher;
end $$;
revoke all on function public.assign_activity_homeroom_recorder(uuid,uuid) from public,anon;
grant execute on function public.assign_activity_homeroom_recorder(uuid,uuid) to authenticated;

-- Recording is scoped to exactly one teacher for club/scout, and to the scheduled
-- teacher for SSS/guidance/ethics. Administrative roles manage assignments; they
-- do not acquire a whole-school teacher workload on the recording page.
create or replace function private.can_assess_school_activity(p_room uuid,p_kind text,p_period integer)
returns boolean language sql stable security invoker set search_path='' as $$
 with activity as (
  select s.teacher_user_id,t.term_no,c.school_id,c.level_code
  from public.classrooms c
  join public.school_activity_schedules s on s.classroom_id=c.id and s.school_id=c.school_id
  join public.terms t on t.id=s.term_id and t.school_id=s.school_id
   and t.academic_year_id=c.academic_year_id
  where c.id=p_room and s.activity_type=p_kind
   and p_kind in ('sss','guidance','ethics','club','scout')
   and ((c.level_code like 'ป.%' and p_period=0)
      or (c.level_code like 'ม.%' and p_period in (1,2)))
 ), applicable as (
  select * from activity a
  where p_period=0 or a.term_no=p_period
   or not exists(select 1 from activity b where b.term_no=p_period)
 )
 select coalesce(
  private.has_school_role((select school_id from activity limit 1),array['teacher'])
  and (
   (p_kind in ('club','scout')
    and exists(select 1 from applicable)
    and private.activity_homeroom_recorder(p_room)=auth.uid())
   or (p_kind in ('sss','guidance','ethics')
    and exists(select 1 from applicable where teacher_user_id=auth.uid()))
  ),false);
$$;
revoke all on function private.can_assess_school_activity(uuid,text,integer) from public,anon;
grant execute on function private.can_assess_school_activity(uuid,text,integer) to authenticated;
