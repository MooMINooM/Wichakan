create or replace function public.save_student_course_score(
 p_offering_id uuid,p_student_id uuid,p_scores integer[],p_special text default null
) returns void language plpgsql security definer set search_path='' as $$
declare v_o record;v_y uuid;v_settings public.subject_score_settings%rowtype;v_caps integer[];v_complete boolean;v_i integer;v_level text;v_term integer;
begin
 select o.school_id,o.subject_id,o.classroom_id,t.academic_year_id into v_o
 from public.course_offerings o join public.terms t on t.id=o.term_id
 where o.id=p_offering_id;
 if not found then raise exception 'ไม่พบรายวิชาที่เปิดสอน'; end if;
 if not exists(select 1 from public.teaching_assignments a where a.school_id=v_o.school_id and a.course_offering_id=p_offering_id and a.teacher_user_id=auth.uid())
 and not private.has_school_role(v_o.school_id,array['school_admin']) then
 raise exception 'ไม่มีสิทธิ์บันทึกคะแนนรายวิชานี้'; end if;
 perform 1 from public.enrollments e where e.school_id=v_o.school_id and e.student_id=p_student_id and e.classroom_id=v_o.classroom_id and e.academic_year_id=v_o.academic_year_id and e.status in ('active','completed');
 if not found then raise exception 'นักเรียนไม่ได้ลงทะเบียนในห้องของรายวิชานี้'; end if;
 select * into v_settings from public.subject_score_settings where school_id=v_o.school_id and academic_year_id=v_o.academic_year_id and subject_id=v_o.subject_id;
 if not found then raise exception 'Admin ยังไม่ได้กำหนดคะแนนเต็มของรายวิชา'; end if;
 if p_scores is null or array_length(p_scores,1) is distinct from 6 or array_lower(p_scores,1)<>1 then raise exception 'ต้องส่งคะแนน 6 ช่อง (เว้นว่างได้)';end if;
 v_caps=array[v_settings.term1_coursework,v_settings.term1_midterm,v_settings.term1_final,v_settings.term2_coursework,v_settings.term2_midterm,v_settings.term2_final];
 for v_i in 1..6 loop
 if p_scores[v_i] is not null and (p_scores[v_i]<0 or p_scores[v_i]>v_caps[v_i]) then raise exception 'คะแนนช่องที่ % เกินคะแนนเต็มหรือไม่ถูกต้อง',v_i;end if;
 end loop;
 if p_special is not null and p_special not in ('ร','มส') then raise exception 'ผลพิเศษไม่ถูกต้อง';end if;
 select grade_level into v_level from public.subjects where id=v_o.subject_id; select t.term_no into v_term from public.course_offerings o join public.terms t on t.id=o.term_id where o.id=p_offering_id;
 if v_level like 'ม.%' then
   v_complete=p_special is not null or (case when v_term=1 then array_position(p_scores[1:3],null) is null else array_position(p_scores[4:6],null) is null end);
 else
  v_complete=p_special is not null or array_position(p_scores,null) is null;
 end if;
 insert into public.student_course_scores(school_id,course_offering_id,student_id,
 term1_coursework,term1_midterm,term1_final,term2_coursework,term2_midterm,term2_final,special_result,is_complete,updated_by)
 values(v_o.school_id,p_offering_id,p_student_id,p_scores[1],p_scores[2],p_scores[3],p_scores[4],p_scores[5],p_scores[6],p_special,v_complete,auth.uid())
 on conflict(course_offering_id,student_id) do update set
 term1_coursework=excluded.term1_coursework,term1_midterm=excluded.term1_midterm,term1_final=excluded.term1_final,
 term2_coursework=excluded.term2_coursework,term2_midterm=excluded.term2_midterm,term2_final=excluded.term2_final,
 special_result=excluded.special_result,is_complete=excluded.is_complete,updated_by=auth.uid(),updated_at=now();
end $$;
