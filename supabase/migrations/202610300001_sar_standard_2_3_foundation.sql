-- SAR foundation from the school's 2568 standard 2/3 assessment instrument.
-- 2: six school-management items; 3: nine teaching-process subitems.
-- Raw responses are 1..5; no inferred percentage/quality aggregation formula.
create table public.sar_assessment_items (
 code text primary key,
 standard_no smallint not null check (standard_no in (2,3)),
 section_code text not null,
 title text not null,
 item_order smallint not null,
 source_year_be integer not null default 2568,
 unique(standard_no,item_order)
);
insert into public.sar_assessment_items(code,standard_no,section_code,title,item_order) values
('2.1',2,'2.1','มีเป้าหมาย วิสัยทัศน์ และพันธกิจที่สถานศึกษากำหนดชัดเจน สอดคล้องกับบริบทของสถานศึกษา สามารถปฏิบัติได้จริง',1),
('2.2',2,'2.2','มีระบบบริหารจัดการคุณภาพของสถานศึกษาที่ส่งผลต่อการพัฒนาคุณภาพการศึกษาตามมาตรฐานที่กำหนดค่าเป้าหมายไว้',2),
('2.3',2,'2.3','มีการดำเนินงานพัฒนาวิชาการที่เน้นคุณภาพผู้เรียนอย่างรอบด้านตามหลักสูตรสถานศึกษาและทุกกลุ่มเป้าหมาย',3),
('2.4',2,'2.4','มีการพัฒนาครูและบุคลากรให้มีความเชี่ยวชาญทางวิชาชีพ',4),
('2.5',2,'2.5','มีการจัดสภาพแวดล้อมทางกายภาพและสังคมที่เอื้อต่อการจัดการเรียนรู้อย่างมีคุณภาพ',5),
('2.6',2,'2.6','มีการจัดระบบเทคโนโลยีสารสนเทศเพื่อสนับสนุนการบริหารจัดการและการจัดการเรียนรู้',6),
('3.1.1',3,'3.1','ครูทุกกลุ่มสาระการเรียนรู้จัดการเรียนรู้เน้นกระบวนการคิดและให้ผู้เรียนฝึกปฏิบัติจริงตามมาตรฐานและตัวชี้วัดของหลักสูตร สามารถนำไปประยุกต์ใช้ในชีวิตได้',1),
('3.1.2',3,'3.1','ครูมีนวัตกรรมในการจัดการเรียนรู้แบบ Active Learning',2),
('3.2.1',3,'3.2','ครูทุกกลุ่มสาระการเรียนรู้ใช้สื่อการเรียนรู้ที่หลากหลาย',3),
('3.2.2',3,'3.2','ครูทุกกลุ่มสาระการเรียนรู้ใช้เทคโนโลยีสารสนเทศในการจัดการเรียนรู้ มี Application',4),
('3.2.3',3,'3.2','ครูทุกกลุ่มสาระการเรียนรู้ใช้แหล่งเรียนรู้ทั้งภายในและภายนอกโรงเรียน ภูมิปัญญาท้องถิ่น บูรณาการในการจัดการเรียนการสอนให้ผู้เรียนฝึกปฏิบัติจริง',5),
('3.3.1',3,'3.3','ครูมีการบริหารจัดการชั้นเรียนเชิงบวก มีปฏิสัมพันธ์เชิงบวก ส่งผลให้นักเรียนรักการเรียนรู้',6),
('3.4.1',3,'3.4','ครูมีการตรวจสอบและประเมินผู้เรียนอย่างเป็นระบบและให้ข้อมูลย้อนกลับ นำผลมาพัฒนาผู้เรียน',7),
('3.4.2',3,'3.4','ครูมีเครื่องมือวัดและวิธีการประเมินผลที่เหมาะสมกับเป้าหมายของการเรียนรู้',8),
('3.5.1',3,'3.5','ครูและผู้มีส่วนเกี่ยวข้องแลกเปลี่ยนเรียนรู้และให้ข้อมูลสะท้อนกลับเพื่อพัฒนาและปรับปรุงการจัดการเรียนรู้',9);
alter table public.sar_assessment_items enable row level security;
revoke all on public.sar_assessment_items from anon,authenticated;
grant select on public.sar_assessment_items to authenticated;
create policy "sar_catalog_logged_in" on public.sar_assessment_items for select to authenticated using (auth.uid() is not null);

create table public.sar_year_settings(
 school_id uuid not null references public.schools(id) on delete cascade,
 academic_year_id uuid not null references public.academic_years(id) on delete cascade,
 target_standard_2 smallint check(target_standard_2 between 1 and 5),
 target_standard_3 smallint check(target_standard_3 between 1 and 5),
 notes text not null default '' check(length(notes)<=2000),
 status text not null default 'draft' check(status in ('draft','published')),
 published_at timestamptz,
 published_by uuid references auth.users(id),
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id),
 primary key(school_id,academic_year_id),
 constraint sar_targets_publication_consistent check (
  (status='draft' and published_at is null) or
  (status='published' and published_at is not null and
   target_standard_2 is not null and target_standard_3 is not null)
 )
);
alter table public.sar_year_settings enable row level security;
revoke all on public.sar_year_settings from anon,authenticated;
grant select on public.sar_year_settings to authenticated;
create policy "sar_year_staff_read_published_or_admin" on public.sar_year_settings
 for select to authenticated using (
 exists (select 1 from public.school_memberships m
  where m.school_id=sar_year_settings.school_id and m.user_id=auth.uid()
  and m.active and (m.role='school_admin' or (m.role='teacher' and sar_year_settings.status='published')))
 );

create table public.sar_teacher_assessments(
 school_id uuid not null references public.schools(id) on delete cascade,
 academic_year_id uuid not null references public.academic_years(id) on delete cascade,
 teacher_user_id uuid not null references auth.users(id) on delete cascade,
 item_code text not null references public.sar_assessment_items(code),
 rating smallint check(rating between 1 and 5),
 note text not null default '' check(length(note)<=2000),
 updated_at timestamptz not null default now(),
 primary key(school_id,academic_year_id,teacher_user_id,item_code)
);
create index sar_assessment_year_idx on public.sar_teacher_assessments(school_id,academic_year_id);
alter table public.sar_teacher_assessments enable row level security;
revoke all on public.sar_teacher_assessments from anon,authenticated;
grant select on public.sar_teacher_assessments to authenticated;
create policy "sar_assessment_own_or_admin_read" on public.sar_teacher_assessments
 for select to authenticated using (
 exists(select 1 from public.school_memberships m
  where m.school_id=sar_teacher_assessments.school_id and m.user_id=auth.uid() and m.active
   and (m.role='school_admin' or (m.role='teacher' and sar_teacher_assessments.teacher_user_id=auth.uid())))
 );

create table public.sar_teacher_submissions(
 school_id uuid not null references public.schools(id) on delete cascade,
 academic_year_id uuid not null references public.academic_years(id) on delete cascade,
 teacher_user_id uuid not null references auth.users(id) on delete cascade,
 submitted_at timestamptz not null default now(),
 primary key(school_id,academic_year_id,teacher_user_id)
);
alter table public.sar_teacher_submissions enable row level security;
revoke all on public.sar_teacher_submissions from anon,authenticated;
grant select on public.sar_teacher_submissions to authenticated;
create policy "sar_submitted_own_or_admin_read" on public.sar_teacher_submissions
 for select to authenticated using (
 exists(select 1 from public.school_memberships m
  where m.school_id=sar_teacher_submissions.school_id and m.user_id=auth.uid() and m.active
   and (m.role='school_admin' or (m.role='teacher' and sar_teacher_submissions.teacher_user_id=auth.uid())))
 );

create function public.sar_set_year_targets(
 p_year uuid,p_target_2 smallint,p_target_3 smallint,
 p_notes text,p_publish boolean default false
) returns void language plpgsql security definer set search_path='' as $$
declare v_school uuid;v_old_status text;
begin
 select y.school_id into v_school from public.academic_years y where y.id=p_year;
 if v_school is null or auth.uid() is null or not exists(
  select 1 from public.school_memberships m
  where m.school_id=v_school and m.user_id=auth.uid() and m.active and m.role='school_admin'
 ) then raise exception 'not_authorized';end if;
 if p_target_2 is not null and (p_target_2<1 or p_target_2>5) or
    p_target_3 is not null and (p_target_3<1 or p_target_3>5) or
    length(coalesce(p_notes,''))>2000
 then raise exception 'invalid_targets';end if;
 if p_publish and (p_target_2 is null or p_target_3 is null)
 then raise exception 'targets_required_before_publishing';end if;
 select status into v_old_status from public.sar_year_settings
 where school_id=v_school and academic_year_id=p_year for update;
 if v_old_status='published' then
  raise exception 'published_targets_are_locked';
 end if;
 insert into public.sar_year_settings(school_id,academic_year_id,
   target_standard_2,target_standard_3,notes,status,published_at,published_by,updated_at,updated_by)
 values(v_school,p_year,p_target_2,p_target_3,btrim(coalesce(p_notes,'')),
  case when p_publish then 'published' else 'draft' end,
  case when p_publish then now() else null end,
  case when p_publish then auth.uid() else null end,now(),auth.uid())
 on conflict (school_id,academic_year_id) do update set
  target_standard_2=excluded.target_standard_2,
  target_standard_3=excluded.target_standard_3,
  notes=excluded.notes,status=excluded.status,
  published_at=excluded.published_at,published_by=excluded.published_by,
  updated_at=now(),updated_by=auth.uid();
end $$;
revoke all on function public.sar_set_year_targets(uuid,smallint,smallint,text,boolean) from public,anon;
grant execute on function public.sar_set_year_targets(uuid,smallint,smallint,text,boolean) to authenticated;

create function public.sar_save_teacher_assessment(
 p_year uuid,p_answers jsonb,p_submit boolean default false
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_school uuid;v_expected integer;v_complete integer;v_arr_count integer;
begin
 select y.school_id into v_school from public.academic_years y where y.id=p_year;
 if v_school is null or auth.uid() is null or not exists(
  select 1 from public.school_memberships m
   where m.school_id=v_school and m.user_id=auth.uid() and m.active and m.role='teacher'
 ) then raise exception 'not_authorized';end if;
 if not exists(select 1 from public.sar_year_settings s
  where s.school_id=v_school and s.academic_year_id=p_year and s.status='published'
 ) then raise exception 'sar_targets_not_published';end if;
 if exists(select 1 from public.sar_teacher_submissions s
  where s.school_id=v_school and s.academic_year_id=p_year and s.teacher_user_id=auth.uid()
 ) then raise exception 'assessment_already_submitted';end if;
 if p_answers is null or jsonb_typeof(p_answers)<>'array'
 then raise exception 'answers_must_be_array';end if;
 v_arr_count=jsonb_array_length(p_answers);
 select count(*) into v_expected from public.sar_assessment_items;
 if v_arr_count>v_expected then raise exception 'too_many_answers';end if;
 if (select count(distinct x.code) from jsonb_to_recordset(p_answers) as x(code text,rating smallint,note text))<>v_arr_count
 then raise exception 'duplicate_answer';end if;
 if exists (
  select 1 from jsonb_to_recordset(p_answers) as x(code text,rating smallint,note text)
  where x.code is null or not exists(select 1 from public.sar_assessment_items i where i.code=x.code)
   or (x.rating is not null and x.rating not between 1 and 5)
   or length(coalesce(x.note,''))>2000
 ) then raise exception 'invalid_answer';end if;
 insert into public.sar_teacher_assessments(school_id,academic_year_id,teacher_user_id,item_code,rating,note,updated_at)
 select v_school,p_year,auth.uid(),x.code,x.rating,btrim(coalesce(x.note,'')),now()
 from jsonb_to_recordset(p_answers) as x(code text,rating smallint,note text)
 on conflict (school_id,academic_year_id,teacher_user_id,item_code) do update
  set rating=excluded.rating,note=excluded.note,updated_at=now();
 select count(*) into v_complete from public.sar_teacher_assessments a
 where a.school_id=v_school and a.academic_year_id=p_year
  and a.teacher_user_id=auth.uid() and a.rating is not null;
 if p_submit then
  if v_complete<>v_expected then raise exception 'all_sar_items_required';end if;
  insert into public.sar_teacher_submissions(school_id,academic_year_id,teacher_user_id)
  values(v_school,p_year,auth.uid());
 end if;
 return jsonb_build_object('completed',v_complete,'expected',v_expected,'submitted',p_submit);
end $$;
revoke all on function public.sar_save_teacher_assessment(uuid,jsonb,boolean) from public,anon;
grant execute on function public.sar_save_teacher_assessment(uuid,jsonb,boolean) to authenticated;

create function public.sar_reopen_teacher_assessment(p_year uuid,p_teacher uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_school uuid;
begin
 select y.school_id into v_school from public.academic_years y where y.id=p_year;
 if v_school is null or auth.uid() is null or not exists (
  select 1 from public.school_memberships m where m.school_id=v_school
   and m.user_id=auth.uid() and m.active and m.role='school_admin'
 ) then raise exception 'not_authorized'; end if;
 if not exists (
  select 1 from public.school_memberships m where m.school_id=v_school
   and m.user_id=p_teacher and m.active and m.role='teacher'
 ) then raise exception 'teacher_not_in_school';end if;
 delete from public.sar_teacher_submissions where school_id=v_school
  and academic_year_id=p_year and teacher_user_id=p_teacher;
end $$;
revoke all on function public.sar_reopen_teacher_assessment(uuid,uuid) from public,anon;
grant execute on function public.sar_reopen_teacher_assessment(uuid,uuid) to authenticated;
