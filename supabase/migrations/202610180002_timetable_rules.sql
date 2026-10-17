create table if not exists public.timetable_rules(
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id),
 term_id uuid not null references public.terms(id),
 kind text not null check(kind in ('school_break','teacher_unavailable','subject_day_block')),
 weekday_no integer not null check(weekday_no between 1 and 7),
 period_no integer check(period_no between 1 and 20),
 teacher_user_id uuid,
 subject_id uuid references public.subjects(id),
 label text not null default '',
 created_at timestamptz not null default now(),
 check (
  (kind='school_break' and period_no is not null and teacher_user_id is null and subject_id is null) or
  (kind='teacher_unavailable' and period_no is not null and teacher_user_id is not null and subject_id is null) or
  (kind='subject_day_block' and period_no is null and teacher_user_id is null and subject_id is not null)
 )
);
create index if not exists timetable_rules_term on public.timetable_rules(term_id,weekday_no,period_no);
alter table public.timetable_rules enable row level security;
create policy timetable_rules_read on public.timetable_rules for select to authenticated using (exists(select 1 from public.school_memberships m where m.school_id=timetable_rules.school_id and m.user_id=auth.uid() and m.active));
grant select on public.timetable_rules to authenticated;
create or replace function public.manage_timetable_rule(p_term_id uuid,p_kind text,p_weekday integer,p_period integer default null,p_teacher uuid default null,p_subject uuid default null,p_label text default '',p_rule_id uuid default null,p_delete boolean default false) returns uuid language plpgsql security definer set search_path='' as $$
declare v_school uuid;v_id uuid;
begin
 select school_id into v_school from public.terms where id=p_term_id;
 if not found or auth.uid() is null or not private.has_school_role(v_school,array['school_admin','academic']) then raise exception 'ไม่มีสิทธิ์จัดการเงื่อนไข';end if;
 perform pg_advisory_xact_lock(hashtext(p_term_id::text));
 if p_delete then
  delete from public.timetable_rules where id=p_rule_id and school_id=v_school and term_id=p_term_id returning id into v_id;
  if v_id is null then raise exception 'ไม่พบเงื่อนไขที่จะลบ';end if;
  return v_id;
 end if;
 if p_kind not in ('school_break','teacher_unavailable','subject_day_block') or p_weekday not between 1 and 7 then raise exception 'ประเภทหรือวันไม่ถูกต้อง';end if;
 if p_kind='subject_day_block' then
  if p_subject is null or p_period is not null or not exists(select 1 from public.subjects where id=p_subject and school_id=v_school) then raise exception 'กรุณาเลือกรายวิชาในโรงเรียน';end if;
 elsif p_period not between 1 and 20 then raise exception 'กรุณาระบุคาบ 1-20';
 elsif p_kind='teacher_unavailable' and (p_teacher is null or not exists(select 1 from public.school_memberships where school_id=v_school and user_id=p_teacher and active)) then raise exception 'ไม่พบครูในโรงเรียน';end if;
 if exists(select 1 from public.timetable_rules where term_id=p_term_id and kind=p_kind and weekday_no=p_weekday and period_no is not distinct from p_period and teacher_user_id is not distinct from p_teacher and subject_id is not distinct from p_subject and (p_rule_id is null or id<>p_rule_id)) then raise exception 'มีเงื่อนไขนี้แล้ว';end if;
 if p_kind='school_break' and exists(select 1 from public.timetable_slots where term_id=p_term_id and weekday_no=p_weekday and period_no=p_period) then raise exception 'มีตารางสอนในคาบนี้ กรุณาย้ายคาบก่อนกำหนดเป็นพัก';end if;
 if p_kind='teacher_unavailable' and exists(select 1 from public.timetable_slots ts join public.teaching_assignments ta on ta.course_offering_id=ts.course_offering_id where ts.term_id=p_term_id and ts.weekday_no=p_weekday and ts.period_no=p_period and ta.teacher_user_id=p_teacher) then raise exception 'ครูมีคาบสอนในช่วงนี้แล้ว กรุณาย้ายคาบก่อน';end if;
 if p_kind='subject_day_block' and exists(select 1 from public.timetable_slots ts join public.course_offerings o on o.id=ts.course_offering_id where ts.term_id=p_term_id and ts.weekday_no=p_weekday and o.subject_id=p_subject) then raise exception 'รายวิชานี้มีคาบสอนวันดังกล่าวแล้ว กรุณาย้ายคาบก่อน';end if;
 if p_rule_id is null then
  insert into public.timetable_rules(school_id,term_id,kind,weekday_no,period_no,teacher_user_id,subject_id,label) values(v_school,p_term_id,p_kind,p_weekday,p_period,p_teacher,p_subject,left(coalesce(p_label,''),120)) returning id into v_id;
 else
  update public.timetable_rules set kind=p_kind,weekday_no=p_weekday,period_no=p_period,teacher_user_id=p_teacher,subject_id=p_subject,label=left(coalesce(p_label,''),120) where id=p_rule_id and school_id=v_school and term_id=p_term_id returning id into v_id;
  if v_id is null then raise exception 'ไม่พบเงื่อนไข';end if;
 end if;
 return v_id;
end $$;
revoke all on function public.manage_timetable_rule(uuid,text,integer,integer,uuid,uuid,text,uuid,boolean) from public,anon;
grant execute on function public.manage_timetable_rule(uuid,text,integer,integer,uuid,uuid,text,uuid,boolean) to authenticated;