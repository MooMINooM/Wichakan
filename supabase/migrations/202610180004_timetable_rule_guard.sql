create or replace function public.timetable_teacher_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if exists(select 1 from public.timetable_rules r join public.teaching_assignments a on a.teacher_user_id=r.teacher_user_id where a.course_offering_id=new.course_offering_id and r.term_id=new.term_id and r.weekday_no=new.weekday_no and r.period_no=new.period_no and r.kind='teacher_unavailable') then raise exception 'Teacher unavailable';end if;
 return new;
end $$;
create or replace function public.timetable_subject_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if exists(select 1 from public.timetable_rules r join public.course_offerings o on o.subject_id=r.subject_id where o.id=new.course_offering_id and r.term_id=new.term_id and r.weekday_no=new.weekday_no and r.kind='subject_day_block') then raise exception 'Subject prohibited on this day';end if;
 return new;
end $$;
create or replace function public.timetable_validate_rules() returns trigger language plpgsql set search_path='' as $$
begin
 if exists(select 1 from public.timetable_rules r where r.term_id=new.term_id and r.weekday_no=new.weekday_no and r.kind='school_break' and r.period_no=new.period_no) then raise exception 'School break period';end if;
 return new;
end $$;
drop trigger if exists timetable_rules_guard on public.timetable_slots;
create trigger timetable_rules_guard before insert or update on public.timetable_slots for each row execute function public.timetable_validate_rules();
drop trigger if exists timetable_teacher_guard on public.timetable_slots;
create trigger timetable_teacher_guard before insert or update on public.timetable_slots for each row execute function public.timetable_teacher_guard();
drop trigger if exists timetable_subject_guard on public.timetable_slots;
create trigger timetable_subject_guard before insert or update on public.timetable_slots for each row execute function public.timetable_subject_guard();