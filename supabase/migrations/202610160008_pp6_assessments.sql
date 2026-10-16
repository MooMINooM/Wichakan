create table if not exists public.pp6_student_assessments(
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id),
 classroom_id uuid not null references public.classrooms(id),
 academic_year_id uuid not null references public.academic_years(id),
 student_id uuid not null references public.students(id),
 term_no integer not null check(term_no in (1,2)),
 desirable_traits text check(desirable_traits in ('ดีเยี่ยม','ดี','ผ่าน','ไม่ผ่าน')),
 reading_thinking_writing text check(reading_thinking_writing in ('ดีเยี่ยม','ดี','ผ่าน','ไม่ผ่าน')),
 learner_activities text check(learner_activities in ('ผ่าน','ไม่ผ่าน')),
 comment text,
 updated_by uuid not null,
 updated_at timestamptz not null default now(),
 unique(classroom_id,student_id,term_no)
);
alter table public.pp6_student_assessments enable row level security;
create policy pp6_assessments_read on public.pp6_student_assessments for select to authenticated using (
 private.has_school_role(school_id,array['school_admin','academic'])
 or exists(select 1 from public.homeroom_assignments h where h.school_id=pp6_student_assessments.school_id and h.classroom_id=pp6_student_assessments.classroom_id and h.teacher_user_id=auth.uid())
);
grant select on public.pp6_student_assessments to authenticated;
create or replace function public.save_pp6_assessment(p_classroom_id uuid,p_student_id uuid,p_term_no integer,p_traits text,p_reading text,p_activities text,p_comment text default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_school uuid;v_year uuid;
begin
 if auth.uid() is null then raise exception 'ต้องเข้าสู่ระบบ';end if;
 select school_id,academic_year_id into v_school,v_year from public.classrooms where id=p_classroom_id;
 if not found then raise exception 'ไม่พบห้องเรียน';end if;
 if not exists(select 1 from public.homeroom_assignments where classroom_id=p_classroom_id and school_id=v_school and teacher_user_id=auth.uid())
 and not private.has_school_role(v_school,array['school_admin','academic']) then raise exception 'ไม่มีสิทธิ์บันทึกผลประเมินห้องนี้';end if;
 if not exists(select 1 from public.enrollments where school_id=v_school and classroom_id=p_classroom_id and academic_year_id=v_year and student_id=p_student_id and status in ('active','completed')) then raise exception 'นักเรียนไม่ได้อยู่ในห้องนี้';end if;
 if p_term_no not in (1,2) then raise exception 'ภาคเรียนไม่ถูกต้อง';end if;
 if p_traits is not null and p_traits not in ('ดีเยี่ยม','ดี','ผ่าน','ไม่ผ่าน') then raise exception 'คุณลักษณะไม่ถูกต้อง';end if;
 if p_reading is not null and p_reading not in ('ดีเยี่ยม','ดี','ผ่าน','ไม่ผ่าน') then raise exception 'การอ่าน คิดวิเคราะห์และเขียนไม่ถูกต้อง';end if;
 if p_activities is not null and p_activities not in ('ผ่าน','ไม่ผ่าน') then raise exception 'กิจกรรมพัฒนาผู้เรียนไม่ถูกต้อง';end if;
 if length(coalesce(p_comment,''))>1000 then raise exception 'ความคิดเห็นยาวเกิน 1000 ตัวอักษร';end if;
 insert into public.pp6_student_assessments(school_id,classroom_id,academic_year_id,student_id,term_no,desirable_traits,reading_thinking_writing,learner_activities,comment,updated_by)
 values(v_school,p_classroom_id,v_year,p_student_id,p_term_no,p_traits,p_reading,p_activities,p_comment,auth.uid())
 on conflict(classroom_id,student_id,term_no) do update set desirable_traits=excluded.desirable_traits,reading_thinking_writing=excluded.reading_thinking_writing,learner_activities=excluded.learner_activities,comment=excluded.comment,updated_by=auth.uid(),updated_at=now();
end $$;
revoke all on function public.save_pp6_assessment(uuid,uuid,integer,text,text,text,text) from public,anon;
grant execute on function public.save_pp6_assessment(uuid,uuid,integer,text,text,text,text) to authenticated;