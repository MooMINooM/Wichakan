-- SAR 2568 archived targets are transcribed from the school's Word announcement,
-- pages 150–152. Do NOT infer 2568 teacher scores or historical student enrolments.
-- Academic year 2568 is added as a non-active historical year.
create table if not exists public.sar_target_topics(
 code text primary key,
 standard_no smallint not null check(standard_no between 0 and 3),
 parent_code text,
 sort_order smallint not null unique,
 title text not null
);
alter table public.sar_target_topics enable row level security;
revoke all on public.sar_target_topics from anon,authenticated;
grant select on public.sar_target_topics to authenticated;
create policy "sar_targets_catalog_read" on public.sar_target_topics
 for select to authenticated using ((select auth.uid()) is not null);

insert into public.sar_target_topics(code,standard_no,parent_code,sort_order,title) values
('1',1,null,1,'คุณภาพของผู้เรียน'),
('1.1',1,'1',2,'ผลสัมฤทธิ์ทางวิชาการของผู้เรียน'),
('1.1.1',1,'1.1',3,'มีความสามารถในการอ่าน การเขียน การสื่อสารและการคิดคำนวณ'),
('1.1.2',1,'1.1',4,'มีความสามารถในการคิดวิเคราะห์ คิดอย่างมีวิจารณญาณ อภิปรายแลกเปลี่ยนความคิดเห็นและแก้ปัญหา'),
('1.1.3',1,'1.1',5,'มีความสามารถในการสร้างนวัตกรรม'),
('1.1.4',1,'1.1',6,'มีความสามารถในการใช้เทคโนโลยีสารสนเทศและการสื่อสาร'),
('1.1.5',1,'1.1',7,'มีผลสัมฤทธิ์ทางการเรียนตามหลักสูตรสถานศึกษา'),
('1.1.6',1,'1.1',8,'มีความรู้ ทักษะพื้นฐานและเจตคติที่ดีต่องานอาชีพ'),
('1.2',1,'1',9,'คุณลักษณะที่พึงประสงค์ของผู้เรียน'),
('1.2.1',1,'1.2',10,'การมีคุณลักษณะและค่านิยมที่ดีตามที่สถานศึกษากำหนด'),
('1.2.2',1,'1.2',11,'ความภูมิใจในท้องถิ่นและความเป็นไทย'),
('1.2.3',1,'1.2',12,'การยอมรับที่จะอยู่ร่วมกันบนความแตกต่างและหลากหลาย'),
('1.2.4',1,'1.2',13,'สุขภาวะทางร่างกายและลักษณะจิตสังคม'),
('2',2,null,14,'กระบวนการบริหารและการจัดการ'),
('2.1',2,'2',15,'มีเป้าหมาย วิสัยทัศน์ และพันธกิจที่สถานศึกษากำหนดชัดเจน'),
('2.2',2,'2',16,'มีระบบบริหารจัดการคุณภาพของสถานศึกษา'),
('2.3',2,'2',17,'ดำเนินงานพัฒนาวิชาการที่เน้นคุณภาพผู้เรียนรอบด้านตามหลักสูตรสถานศึกษาและทุกกลุ่มเป้าหมาย'),
('2.4',2,'2',18,'พัฒนาครูและบุคลากรให้มีความเชี่ยวชาญทางวิชาชีพ'),
('2.5',2,'2',19,'จัดสภาพแวดล้อมทางกายภาพและสังคมที่เอื้อต่อการจัดการเรียนรู้อย่างมีคุณภาพ'),
('2.6',2,'2',20,'จัดระบบเทคโนโลยีสารสนเทศเพื่อสนับสนุนการบริหารจัดการและการจัดการเรียนรู้'),
('3',3,null,21,'กระบวนการจัดการเรียนการสอนที่เน้นผู้เรียนเป็นสำคัญ'),
('3.1',3,'3',22,'จัดการเรียนรู้ผ่านกระบวนการคิดและปฏิบัติจริง และสามารถนำไปประยุกต์ใช้ในชีวิตได้'),
('3.2',3,'3',23,'ใช้สื่อ เทคโนโลยีสารสนเทศและแหล่งเรียนรู้ที่เอื้อต่อการเรียนรู้'),
('3.3',3,'3',24,'มีการบริหารจัดการชั้นเรียนเชิงบวก'),
('3.4',3,'3',25,'ตรวจสอบและประเมินผู้เรียนอย่างเป็นระบบ และนำผลมาพัฒนาผู้เรียน'),
('3.5',3,'3',26,'มีการแลกเปลี่ยนเรียนรู้และให้ข้อมูลสะท้อนกลับเพื่อพัฒนาและปรับปรุงการจัดการเรียนรู้'),
('overall',0,null,27,'สรุปผลการประเมินในภาพรวมของสถานศึกษา')
on conflict(code) do update set
 standard_no=excluded.standard_no,parent_code=excluded.parent_code,
 sort_order=excluded.sort_order,title=excluded.title;

-- School-specific data: do not activate 2568 or disturb 2569+.
insert into public.academic_years(school_id,year_be,is_active)
select s.id,2568,false from public.schools s
where s.id='39b470d8-52e8-43d7-9774-4e5d8cf7875f'
  and not exists(select 1 from public.academic_years y where y.school_id=s.id and y.year_be=2568);
-- Term dates for 2568 are unknown; avoid invented dates and student records.
insert into public.terms(school_id,academic_year_id,term_no)
select y.school_id,y.id,t.term_no from public.academic_years y
cross join (values(1),(2)) t(term_no)
where y.school_id='39b470d8-52e8-43d7-9774-4e5d8cf7875f' and y.year_be=2568
 and not exists(select 1 from public.terms old where old.academic_year_id=y.id and old.term_no=t.term_no);
-- A clearly labelled curriculum placeholder; no copying 2569 subjects into 2568.
insert into public.curriculum_versions(school_id,curriculum_id,version_label,effective_year_be)
select c.school_id,c.id,'2568 (รอตรวจสอบรายวิชา)',2568 from public.curricula c
where c.school_id='39b470d8-52e8-43d7-9774-4e5d8cf7875f'
  and not exists(select 1 from public.curriculum_versions v where v.curriculum_id=c.id and v.effective_year_be=2568);

insert into public.sar_indicator_targets(school_id,academic_year_id,section_code,target_percent)
select y.school_id,y.id,p.code,p.percent
from public.academic_years y
cross join (values
('1',80),
('1.1',70),
('1.1.1',64),
('1.1.2',73),
('1.1.3',55),
('1.1.4',80),
('1.1.5',69),
('1.1.6',80),
('1.2',90),
('1.2.1',90),
('1.2.2',90),
('1.2.3',90),
('1.2.4',90),
('2',88),
('2.1',90),
('2.2',90),
('2.3',90),
('2.4',85),
('2.5',90),
('2.6',85),
('3',91),
('3.1',95),
('3.2',90),
('3.3',90),
('3.4',90),
('3.5',90),
('overall',86)
) p(code,percent)
where y.school_id='39b470d8-52e8-43d7-9774-4e5d8cf7875f' and y.year_be=2568
on conflict(school_id,academic_year_id,section_code) do nothing;
-- A non-published review draft: the source Word contains the historical announcement;
-- publishing digital SAR is left to the school's Admin.
insert into public.sar_year_settings(school_id,academic_year_id,notes,status)
select y.school_id,y.id,
 'นำเข้าค่าเป้าหมายจากเอกสาร SAR ขั้นพื้นฐาน ปีการศึกษา 2568 หน้า 150–152 (ต้นฉบับ Word); รอตรวจสอบก่อนประกาศใน Wichakan',
 'draft'
from public.academic_years y
where y.school_id='39b470d8-52e8-43d7-9774-4e5d8cf7875f' and y.year_be=2568
on conflict(school_id,academic_year_id) do nothing;

-- Replace the obsolete 11-topic RPC with full three-standard table validation.
create or replace function public.sar_save_indicator_targets(
 p_year uuid,p_targets jsonb,p_notes text default '',p_publish boolean default false
) returns void language plpgsql security definer set search_path='' as $$
declare v_school uuid;v_old_status text;v_expected integer;v_count integer;
begin
 select y.school_id into v_school from public.academic_years y where y.id=p_year;
 if v_school is null or (select auth.uid()) is null or not exists(
  select 1 from public.school_memberships m
  where m.school_id=v_school and m.user_id=(select auth.uid()) and m.active and m.role='school_admin'
 ) then raise exception 'not_authorized';end if;
 if p_targets is null or jsonb_typeof(p_targets)<>'array' or length(coalesce(p_notes,''))>2000
 then raise exception 'invalid_targets';end if;
 select count(*) into v_expected from public.sar_target_topics;
 v_count=jsonb_array_length(p_targets);
 if v_count>v_expected or (select count(distinct x.section_code)
  from jsonb_to_recordset(p_targets) as x(section_code text,target_percent numeric))<>v_count
 then raise exception 'duplicate_or_excess_targets';end if;
 if exists(
  select 1 from jsonb_to_recordset(p_targets) as x(section_code text,target_percent numeric)
  where x.section_code is null or x.target_percent is null
   or x.target_percent<0 or x.target_percent>100
   or not exists(select 1 from public.sar_target_topics t where t.code=x.section_code)
 ) then raise exception 'invalid_indicator_target';end if;
 if p_publish and v_count<>v_expected then raise exception 'all_indicator_targets_required';end if;
 select s.status into v_old_status from public.sar_year_settings s
 where s.school_id=v_school and s.academic_year_id=p_year for update;
 if v_old_status='published' then raise exception 'published_targets_are_locked';end if;
 delete from public.sar_indicator_targets where school_id=v_school and academic_year_id=p_year;
 insert into public.sar_indicator_targets(school_id,academic_year_id,section_code,target_percent,updated_at,updated_by)
 select v_school,p_year,x.section_code,x.target_percent,now(),(select auth.uid())
 from jsonb_to_recordset(p_targets) as x(section_code text,target_percent numeric);
 insert into public.sar_year_settings(school_id,academic_year_id,
   target_standard_2,target_standard_3,notes,status,published_at,published_by,updated_at,updated_by)
 values(v_school,p_year,null,null,btrim(coalesce(p_notes,'')),
  case when p_publish then 'published' else 'draft' end,
  case when p_publish then now() else null end,
  case when p_publish then (select auth.uid()) else null end,now(),(select auth.uid()))
 on conflict(school_id,academic_year_id) do update
 set target_standard_2=null,target_standard_3=null,notes=excluded.notes,
  status=excluded.status,published_at=excluded.published_at,published_by=excluded.published_by,
  updated_at=now(),updated_by=(select auth.uid());
end $$;
revoke all on function public.sar_save_indicator_targets(uuid,jsonb,text,boolean) from public,anon;
grant execute on function public.sar_save_indicator_targets(uuid,jsonb,text,boolean) to authenticated;

create or replace function public.sar_save_teacher_assessment(
 p_year uuid,p_answers jsonb,p_submit boolean default false
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_school uuid;v_expected integer;v_complete integer;v_arr_count integer;v_target_count integer;
begin
 select y.school_id into v_school from public.academic_years y where y.id=p_year;
 if v_school is null or auth.uid() is null or not exists(
  select 1 from public.school_memberships m
   where m.school_id=v_school and m.user_id=auth.uid() and m.active and m.role='teacher'
 ) then raise exception 'not_authorized';end if;
 select count(*) into v_target_count from public.sar_indicator_targets st
  where st.school_id=v_school and st.academic_year_id=p_year;
 if v_target_count<>(select count(*) from public.sar_target_topics)
    or not exists(select 1 from public.sar_year_settings s where s.school_id=v_school
     and s.academic_year_id=p_year and s.status='published')
 then raise exception 'sar_indicator_targets_not_published';end if;
 if exists(select 1 from public.sar_teacher_submissions s where s.school_id=v_school
  and s.academic_year_id=p_year and s.teacher_user_id=auth.uid())
 then raise exception 'assessment_already_submitted';end if;
 if p_answers is null or jsonb_typeof(p_answers)<>'array' then raise exception 'answers_must_be_array';end if;
 v_arr_count=jsonb_array_length(p_answers);
 select count(*) into v_expected from public.sar_assessment_items;
 if v_arr_count>v_expected then raise exception 'too_many_answers';end if;
 if (select count(distinct x.code) from jsonb_to_recordset(p_answers)
  as x(code text,rating smallint,note text))<>v_arr_count
 then raise exception 'duplicate_answer';end if;
 if exists(select 1 from jsonb_to_recordset(p_answers) as x(code text,rating smallint,note text)
  where x.code is null or not exists(select 1 from public.sar_assessment_items i where i.code=x.code)
   or (x.rating is not null and x.rating not between 1 and 5)
   or length(coalesce(x.note,''))>2000)
 then raise exception 'invalid_answer';end if;
 insert into public.sar_teacher_assessments(school_id,academic_year_id,teacher_user_id,item_code,rating,note,updated_at)
 select v_school,p_year,auth.uid(),x.code,x.rating,btrim(coalesce(x.note,'')),now()
 from jsonb_to_recordset(p_answers) as x(code text,rating smallint,note text)
 on conflict(school_id,academic_year_id,teacher_user_id,item_code) do update
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
