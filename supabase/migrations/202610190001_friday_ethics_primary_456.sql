-- Ethics assembly on Friday period 7 is for P4-P6 only, not a schoolwide break.
-- Keep P4-P6 blocked even when no named activity teacher exists yet.
create or replace function public.timetable_validate_rules()
returns trigger language plpgsql set search_path='' as $$
declare v_grade text;
begin
 select c.level_code into v_grade from public.course_offerings o
 join public.classrooms c on c.id=o.classroom_id
 where o.id=new.course_offering_id;
 if exists (
  select 1 from public.timetable_rules r
  where r.term_id=new.term_id and r.weekday_no=new.weekday_no
    and r.kind='school_break' and r.period_no=new.period_no
    and not (r.weekday_no=5 and r.period_no=7 and r.label like '%อบรมคุณธรรม%')
 ) then raise exception 'School break period'; end if;
 if new.weekday_no=5 and new.period_no=7 and v_grade in ('ป.4','ป.5','ป.6')
 and exists (select 1 from public.terms t join public.academic_years y on y.id=t.academic_year_id where t.id=new.term_id and y.year_be=2569 and t.term_no=1)
 then raise exception 'Friday ethics reserved for P4-P6'; end if;
 return new;
end $$;
-- Remove only the invalid global school break in term 1 / 2569; the
-- per-grade restriction above remains effective for P4-P6.
delete from public.timetable_rules r using public.terms t,public.academic_years y
where r.term_id=t.id and t.academic_year_id=y.id
 and y.year_be=2569 and t.term_no=1 and r.kind='school_break'
 and r.weekday_no=5 and r.period_no=7 and r.label like '%อบรมคุณธรรม%';
-- Import previously blocked M3 career lesson on Friday 15:00-16:00.
do $$
declare v_offering uuid;v_school uuid;v_term uuid;v_admin uuid;
begin
 select o.id,o.school_id,o.term_id into v_offering,v_school,v_term
 from public.course_offerings o join public.subjects s on s.id=o.subject_id
 join public.classrooms c on c.id=o.classroom_id
 join public.terms t on t.id=o.term_id
 join public.academic_years y on y.id=t.academic_year_id
 where y.year_be=2569 and t.term_no=1 and c.level_code='ม.3'
 and c.room_code='1' and s.subject_code='ง23101';
 if v_offering is null then raise exception 'M3 career offering missing';end if;
 if exists (select 1 from public.timetable_slots ts join public.course_offerings o on o.id=ts.course_offering_id
 where ts.term_id=v_term and ts.weekday_no=5 and ts.period_no=7
 and o.classroom_id=(select classroom_id from public.course_offerings where id=v_offering) and ts.course_offering_id<>v_offering)
 then raise exception 'M3 Friday room occupied';end if;
 select m.user_id into v_admin from public.school_memberships m
 where m.school_id=v_school and m.active and m.role='school_admin' order by m.user_id limit 1;
 insert into public.timetable_slots(school_id,term_id,course_offering_id,weekday_no,period_no,locked,updated_by)
 values(v_school,v_term,v_offering,5,7,true,v_admin)
 on conflict(term_id,course_offering_id,weekday_no,period_no) do nothing;
end $$;