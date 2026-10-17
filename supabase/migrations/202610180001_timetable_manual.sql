create table if not exists public.timetable_periods (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id),
 period_no integer not null check (period_no between 1 and 20),
 starts_at time not null,
 ends_at time not null,
 unique (school_id,period_no),
 check(starts_at<ends_at)
);
create table if not exists public.timetable_slots (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id),
 term_id uuid not null references public.terms(id),
 course_offering_id uuid not null references public.course_offerings(id),
 weekday_no integer not null check(weekday_no between 1 and 7),
 period_no integer not null check(period_no between 1 and 20),
 locked boolean not null default false,
 updated_at timestamptz not null default now(),
 updated_by uuid not null,
 unique(term_id,course_offering_id,weekday_no,period_no)
);
create unique index if not exists timetable_slot_offering_position_unique on public.timetable_slots(term_id,course_offering_id,weekday_no,period_no);
create index if not exists timetable_slot_term_position on public.timetable_slots(term_id,weekday_no,period_no);
alter table public.timetable_periods enable row level security;
alter table public.timetable_slots enable row level security;
create policy timetable_periods_read on public.timetable_periods for select to authenticated using (exists(select 1 from public.school_memberships m where m.school_id=timetable_periods.school_id and m.user_id=auth.uid() and m.active));
create policy timetable_slots_read on public.timetable_slots for select to authenticated using (exists(select 1 from public.school_memberships m where m.school_id=timetable_slots.school_id and m.user_id=auth.uid() and m.active));
grant select on public.timetable_periods,public.timetable_slots to authenticated;
create or replace function public.save_timetable_slot(p_term_id uuid,p_offering_id uuid,p_weekday integer,p_period integer,p_locked boolean default false,p_slot_id uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_school uuid;v_room uuid;v_slot uuid;v_own_locked boolean;v_conflict text;
begin
 select o.school_id,o.classroom_id into v_school,v_room
 from public.course_offerings o join public.terms t on t.id=o.term_id and t.school_id=o.school_id
 where o.id=p_offering_id and o.term_id=p_term_id;
 if not found then raise exception 'ไม่พบรายวิชาที่เปิดสอนในภาคเรียนนี้';end if;
 if auth.uid() is null or not private.has_school_role(v_school,array['school_admin','academic']) then raise exception 'ไม่มีสิทธิ์จัดตารางสอน';end if;
 if p_weekday not between 1 and 7 or p_period not between 1 and 20 then raise exception 'วันหรือคาบไม่ถูกต้อง';end if;
 perform pg_advisory_xact_lock(hashtext(p_term_id::text));
 if p_slot_id is not null then
 select locked into v_own_locked from public.timetable_slots where id=p_slot_id and school_id=v_school and term_id=p_term_id and course_offering_id=p_offering_id for update;
 if not found then raise exception 'ไม่พบคาบที่จะแก้ไข';end if;
 if v_own_locked and (select (weekday_no,period_no) is distinct from (p_weekday,p_period) from public.timetable_slots where id=p_slot_id) then raise exception 'คาบนี้ถูกล็อก กรุณาปลดล็อกก่อนย้าย';end if;
 end if;
 if exists(select 1 from public.timetable_slots ts join public.course_offerings o on o.id=ts.course_offering_id where ts.term_id=p_term_id and ts.weekday_no=p_weekday and ts.period_no=p_period and o.classroom_id=v_room and (p_slot_id is null or ts.id<>p_slot_id)) then raise exception 'ห้องเรียนมีรายวิชาอื่นในวันและคาบนี้แล้ว';end if;
 if exists(select 1 from public.timetable_slots ts join public.teaching_assignments a on a.course_offering_id=ts.course_offering_id join public.teaching_assignments b on b.course_offering_id=p_offering_id and b.teacher_user_id=a.teacher_user_id where ts.term_id=p_term_id and ts.weekday_no=p_weekday and ts.period_no=p_period and (p_slot_id is null or ts.id<>p_slot_id)) then raise exception 'ครูผู้สอนมีคาบสอนซ้อนในช่วงเวลานี้';end if;
 if p_slot_id is null then
 insert into public.timetable_slots(school_id,term_id,course_offering_id,weekday_no,period_no,locked,updated_by)
 values(v_school,p_term_id,p_offering_id,p_weekday,p_period,p_locked,auth.uid()) returning id into v_slot;
 else
 update public.timetable_slots set weekday_no=p_weekday,period_no=p_period,locked=p_locked,updated_by=auth.uid(),updated_at=now() where id=p_slot_id returning id into v_slot;
 end if;
 return v_slot;
end $$;
create or replace function public.delete_timetable_slot(p_slot_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare v_school uuid;v_term uuid;v_locked boolean;
begin
 select school_id,term_id,locked into v_school,v_term,v_locked from public.timetable_slots where id=p_slot_id;
 if not found then raise exception 'ไม่พบคาบสอน';end if;
 if auth.uid() is null or not private.has_school_role(v_school,array['school_admin','academic']) then raise exception 'ไม่มีสิทธิ์ลบคาบสอน';end if;
 perform pg_advisory_xact_lock(hashtext(v_term::text));
 if v_locked then raise exception 'กรุณาปลดล็อกคาบก่อนลบ';end if;
 delete from public.timetable_slots where id=p_slot_id;
end $$;
revoke all on function public.save_timetable_slot(uuid,uuid,integer,integer,boolean,uuid),public.delete_timetable_slot(uuid) from public,anon;
grant execute on function public.save_timetable_slot(uuid,uuid,integer,integer,boolean,uuid),public.delete_timetable_slot(uuid) to authenticated;