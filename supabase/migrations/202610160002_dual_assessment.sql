alter table public.subject_score_settings drop constraint if exists subject_score_settings_exact_100;
create or replace function public.check_score_setting_level() returns trigger language plpgsql set search_path='' as $$
declare v_level text;v_total1 integer;v_total2 integer;
begin
 select grade_level into v_level from public.subjects where id=new.subject_id and school_id=new.school_id;
 if v_level is null then raise exception 'ไม่พบระดับชั้นของรายวิชา';end if;
 v_total1=new.term1_coursework+new.term1_midterm+new.term1_final;
 v_total2=new.term2_coursework+new.term2_midterm+new.term2_final;
 if v_level like 'ม.%' then
  if v_total1<>100 or v_total2<>100 then raise exception 'มัธยมศึกษา: ภาคเรียนที่ 1 และ 2 ต้องเต็มภาคเรียนละ 100';end if;
 elsif v_level like 'ป.%' then
  if v_total1+v_total2<>100 then raise exception 'ประถมศึกษา: คะแนนเต็มรวมทั้งปีต้องเท่ากับ 100';end if;
 else raise exception 'ระบบบันทึกเกรดนี้รองรับระดับ ป. และ ม. เท่านั้น';end if;
 return new;
end $$;
drop trigger if exists trg_check_score_setting_level on public.subject_score_settings;
create trigger trg_check_score_setting_level before insert or update on public.subject_score_settings
 for each row execute function public.check_score_setting_level();
create or replace function public.save_subject_score_settings(p_school_id uuid,p_year_id uuid,p_subject_id uuid,p_scores integer[])
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_level text;v_t1 integer;v_t2 integer;
begin
 if not private.has_school_role(p_school_id,array['school_admin']) then raise exception 'เฉพาะ Admin เท่านั้น';end if;
 if p_scores is null or array_length(p_scores,1) is distinct from 6 or array_lower(p_scores,1)<>1
 or exists(select 1 from unnest(p_scores) n where n is null or n<0 or n>100) then raise exception 'คะแนนทั้ง 6 ช่องต้องเป็นจำนวนเต็ม 0–100';end if;
 perform 1 from public.academic_years where id=p_year_id and school_id=p_school_id;
 if not found then raise exception 'ปีการศึกษาไม่ถูกต้อง';end if;
 select grade_level into v_level from public.subjects where id=p_subject_id and school_id=p_school_id;
 if v_level is null then raise exception 'รายวิชาไม่ถูกต้อง';end if;
 v_t1=p_scores[1]+p_scores[2]+p_scores[3];v_t2=p_scores[4]+p_scores[5]+p_scores[6];
 if v_level like 'ม.%' then
  if v_t1<>100 or v_t2<>100 then raise exception 'มัธยมศึกษา: คะแนนเต็มแต่ละภาคเรียนต้องเท่ากับ 100';end if;
 elsif v_level like 'ป.%' then
  if v_t1+v_t2<>100 then raise exception 'ประถมศึกษา: คะแนนเต็มสองภาคเรียนต้องรวมเท่ากับ 100';end if;
 else raise exception 'ระดับชั้นนี้ไม่รองรับการตั้งค่าเกรด';end if;
 if exists(select 1 from public.student_course_scores s
 join public.course_offerings o on o.id=s.course_offering_id
 join public.terms t on t.id=o.term_id
 where s.school_id=p_school_id and o.subject_id=p_subject_id and t.academic_year_id=p_year_id) then
 raise exception 'เริ่มบันทึกคะแนนแล้ว ไม่สามารถเปลี่ยนคะแนนเต็มได้';end if;
 insert into public.subject_score_settings(school_id,academic_year_id,subject_id,term1_coursework,term1_midterm,term1_final,term2_coursework,term2_midterm,term2_final,updated_by)
 values(p_school_id,p_year_id,p_subject_id,p_scores[1],p_scores[2],p_scores[3],p_scores[4],p_scores[5],p_scores[6],auth.uid())
 on conflict(school_id,academic_year_id,subject_id) do update set
 term1_coursework=excluded.term1_coursework,term1_midterm=excluded.term1_midterm,term1_final=excluded.term1_final,
 term2_coursework=excluded.term2_coursework,term2_midterm=excluded.term2_midterm,term2_final=excluded.term2_final,updated_at=now(),updated_by=auth.uid() returning id into v_id;
 return v_id;
end $$;
revoke all on function public.save_subject_score_settings(uuid,uuid,uuid,integer[]) from public,anon;
grant execute on function public.save_subject_score_settings(uuid,uuid,uuid,integer[]) to authenticated;