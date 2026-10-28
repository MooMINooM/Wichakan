-- The assigned activity teacher assesses; homeroom teachers are the fallback only
-- when the applicable year/semester has no assigned teacher. Existing RLS and RPC
-- both call this helper, so direct writes follow the same rule as the screen.
create or replace function private.can_assess_school_activity(p_room uuid,p_kind text,p_period integer)
returns boolean language sql stable security invoker set search_path='' as $$
 with activity as (
  select s.teacher_user_id,t.term_no,c.school_id,c.level_code
  from public.classrooms c
  join public.school_activity_schedules s on s.classroom_id=c.id and s.school_id=c.school_id
  join public.terms t on t.id=s.term_id and t.school_id=s.school_id and t.academic_year_id=c.academic_year_id
  where c.id=p_room and s.activity_type=p_kind and p_kind in ('sss','guidance','ethics','club','scout')
   and ((c.level_code like 'ป.%' and p_period=0) or (c.level_code like 'ม.%' and p_period in (1,2)))
 ), applicable as (
  select * from activity where p_period=0 or term_no=p_period or not exists(select 1 from activity where term_no=p_period)
 )
 select exists(select 1 from applicable a where
  private.has_school_role(a.school_id,array['school_admin','academic'])
  or (private.has_school_role(a.school_id,array['teacher']) and (
   a.teacher_user_id=auth.uid()
   or (not exists(select 1 from applicable where teacher_user_id is not null)
    and exists(select 1 from public.homeroom_assignments h where h.school_id=a.school_id and h.classroom_id=p_room and h.teacher_user_id=auth.uid()))
  ))
 );
$$;
revoke all on function private.can_assess_school_activity(uuid,text,integer) from public,anon;
grant execute on function private.can_assess_school_activity(uuid,text,integer) to authenticated;
