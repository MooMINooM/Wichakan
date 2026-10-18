-- Verified schoolwide common activity periods from term 1/2569 teacher schedules.
-- Club: Wednesday last period. Scouts: Thursday last period.
do $$
declare v_school uuid:='39b470d8-52e8-43d7-9774-4e5d8cf7875f';v_term uuid;v_count int;
begin
 select t.id into v_term from public.terms t join public.academic_years y on y.id=t.academic_year_id where t.school_id=v_school and t.term_no=1 and y.year_be=2569;
 if v_term is null then raise exception 'Term 1/2569 missing';end if;
 insert into public.school_activity_schedules(school_id,term_id,classroom_id,activity_type,weekday_no,period_no,teacher_user_id)
 select v_school,v_term,c.id,k.kind,k.day,7,null
 from public.classrooms c
 cross join (values('club',3),('scout',4)) as k(kind,day)
 where c.school_id=v_school and c.academic_year_id=(select academic_year_id from public.terms where id=v_term) and (c.level_code like 'ป.%' or c.level_code like 'ม.%')
 on conflict(term_id,classroom_id,activity_type,weekday_no,period_no) do nothing;
 select count(*) into v_count from public.school_activity_schedules where term_id=v_term and activity_type in ('club','scout');
 if v_count<>18 then raise exception 'Expected 18 shared activities, found %',v_count;end if;
end $$;