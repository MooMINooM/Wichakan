create table public.student_course_scores (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id),
 course_offering_id uuid not null references public.course_offerings(id),
 student_id uuid not null references public.students(id),
 term1_coursework integer check(term1_coursework>=0),
 term1_midterm integer check(term1_midterm>=0),
 term1_final integer check(term1_final>=0),
 term2_coursework integer check(term2_coursework>=0),
 term2_midterm integer check(term2_midterm>=0),
 term2_final integer check(term2_final>=0),
 special_result text check(special_result in ('ร','มส')),
 is_complete boolean not null default false,
 updated_by uuid not null,
 updated_at timestamptz not null default now(),
 unique(course_offering_id,student_id)
);
alter table public.student_course_scores enable row level security;
create policy score_read on public.student_course_scores for select to authenticated using (
 private.has_school_role(school_id,array['school_admin','academic','registrar'])
 or exists(select 1 from public.teaching_assignments a where a.school_id=student_course_scores.school_id and a.course_offering_id=student_course_scores.course_offering_id and a.teacher_user_id=auth.uid()));
grant select on public.student_course_scores to authenticated;
create or replace function public.save_student_course_score(
 p_offering_id uuid,p_student_id uuid,p_scores integer[],p_special text default null
) returns void language plpgsql security definer set search_path='' as $$
declare v_o record;v_y uuid;v_settings public.subject_score_settings%rowtype;v_caps integer[];v_complete boolean;v_i integer;
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
 v_complete=p_special is not null or array_position(p_scores,null) is null;
 insert into public.student_course_scores(school_id,course_offering_id,student_id,
 term1_coursework,term1_midterm,term1_final,term2_coursework,term2_midterm,term2_final,special_result,is_complete,updated_by)
 values(v_o.school_id,p_offering_id,p_student_id,p_scores[1],p_scores[2],p_scores[3],p_scores[4],p_scores[5],p_scores[6],p_special,v_complete,auth.uid())
 on conflict(course_offering_id,student_id) do update set
 term1_coursework=excluded.term1_coursework,term1_midterm=excluded.term1_midterm,term1_final=excluded.term1_final,
 term2_coursework=excluded.term2_coursework,term2_midterm=excluded.term2_midterm,term2_final=excluded.term2_final,
 special_result=excluded.special_result,is_complete=excluded.is_complete,updated_by=auth.uid(),updated_at=now();
end $$;
revoke all on function public.save_student_course_score(uuid,uuid,integer[],text) from public,anon;
grant execute on function public.save_student_course_score(uuid,uuid,integer[],text) to authenticated;
create or replace function public.save_subject_score_settings(p_school_id uuid,p_year_id uuid,p_subject_id uuid,p_scores integer[])
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if not private.has_school_role(p_school_id,array['school_admin']) then raise exception 'เฉพาะ Admin เท่านั้น';end if;
 if p_scores is null or array_length(p_scores,1) is distinct from 6 or array_lower(p_scores,1)<>1
 or exists(select 1 from unnest(p_scores) n where n is null or n<0 or n>100)
 or (select sum(n) from unnest(p_scores) n)<>100 then raise exception 'คะแนนทั้ง 6 ช่องต้องรวม 100';end if;
 perform 1 from public.academic_years where id=p_year_id and school_id=p_school_id;
 if not found then raise exception 'ปีการศึกษาไม่ถูกต้อง';end if;
 perform 1 from public.subjects where id=p_subject_id and school_id=p_school_id;
 if not found then raise exception 'รายวิชาไม่ถูกต้อง';end if;
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