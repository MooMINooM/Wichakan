create table if not exists public.subject_score_settings (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id),
 academic_year_id uuid not null references public.academic_years(id),
 subject_id uuid not null references public.subjects(id),
 term1_coursework integer not null default 30 check (term1_coursework between 0 and 100),
 term1_midterm integer not null default 10 check (term1_midterm between 0 and 100),
 term1_final integer not null default 10 check (term1_final between 0 and 100),
 term2_coursework integer not null default 30 check (term2_coursework between 0 and 100),
 term2_midterm integer not null default 10 check (term2_midterm between 0 and 100),
 term2_final integer not null default 10 check (term2_final between 0 and 100),
 updated_at timestamptz not null default now(),
 updated_by uuid,
 constraint subject_score_settings_exact_100 check (
 term1_coursework+term1_midterm+term1_final+term2_coursework+term2_midterm+term2_final=100),
 unique(school_id,academic_year_id,subject_id)
);
alter table public.subject_score_settings enable row level security;
revoke all on public.subject_score_settings from anon,authenticated;
create policy subject_score_settings_read on public.subject_score_settings for select to authenticated
 using (private.has_school_role(school_id,array['school_admin','academic','teacher','registrar']));
grant select on public.subject_score_settings to authenticated;
create or replace function public.save_subject_score_settings(
 p_school_id uuid,p_year_id uuid,p_subject_id uuid,p_scores integer[]
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if not private.has_school_role(p_school_id,array['school_admin']) then raise exception 'เฉพาะ Admin เท่านั้นที่ตั้งค่าคะแนนได้'; end if;
 if p_scores is null or array_length(p_scores,1) is distinct from 6 or array_lower(p_scores,1) <> 1 then
  raise exception 'ต้องกำหนดคะแนนเต็มทั้ง 6 ช่อง';
 end if;
 if exists(select 1 from unnest(p_scores) as n where n is null or n<0 or n>100)
   or (select sum(n) from unnest(p_scores) as n) <> 100 then
  raise exception 'คะแนนเต็มทั้ง 6 ช่องต้องรวมเท่ากับ 100 คะแนนพอดี';
 end if;
 perform 1 from public.academic_years where id=p_year_id and school_id=p_school_id;
 if not found then raise exception 'ปีการศึกษาไม่ตรงกับโรงเรียน'; end if;
 perform 1 from public.subjects where id=p_subject_id and school_id=p_school_id;
 if not found then raise exception 'รายวิชาไม่ตรงกับโรงเรียน'; end if;
 -- Lock score structure once actual score records for this year and subject exist (future-proof).
 if to_regclass('public.student_scores') is not null then
  -- A dedicated score workflow will check existing records and prevent unsafe edits.
  null;
 end if;
 insert into public.subject_score_settings(
 school_id,academic_year_id,subject_id,
 term1_coursework,term1_midterm,term1_final,term2_coursework,term2_midterm,term2_final,updated_by)
 values(p_school_id,p_year_id,p_subject_id,p_scores[1],p_scores[2],p_scores[3],p_scores[4],p_scores[5],p_scores[6],auth.uid())
 on conflict(school_id,academic_year_id,subject_id) do update set
 term1_coursework=excluded.term1_coursework,term1_midterm=excluded.term1_midterm,term1_final=excluded.term1_final,
 term2_coursework=excluded.term2_coursework,term2_midterm=excluded.term2_midterm,term2_final=excluded.term2_final,
 updated_at=now(),updated_by=auth.uid() returning id into v_id;
 return v_id;
end $$;
revoke all on function public.save_subject_score_settings(uuid,uuid,uuid,integer[]) from public,anon;
grant execute on function public.save_subject_score_settings(uuid,uuid,uuid,integer[]) to authenticated;