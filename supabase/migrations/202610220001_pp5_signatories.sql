-- School administrator sets PP5 cover signatories per academic year.
-- Keep the teacher's own signature separate from these appointed positions.
create table if not exists public.pp5_signatories (
 school_id uuid not null references public.schools(id) on delete cascade,
 academic_year_id uuid not null references public.academic_years(id) on delete cascade,
 assessment_head_name text not null default '' check (char_length(assessment_head_name) <= 150),
 academic_head_name text not null default '' check (char_length(academic_head_name) <= 150),
 director_name text not null default '' check (char_length(director_name) <= 150),
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id),
 primary key (school_id,academic_year_id)
);
alter table public.pp5_signatories enable row level security;
revoke all on public.pp5_signatories from anon,authenticated;
grant select on public.pp5_signatories to authenticated;
create policy "pp5_signatories_school_members_read" on public.pp5_signatories
 for select to authenticated
 using (private.has_school_role(school_id,array['school_admin','academic','teacher','registrar','director']));

create or replace function public.save_pp5_signatories(
 p_school_id uuid,p_year_id uuid,
 p_assessment_head text,p_academic_head text,p_director text
) returns void language plpgsql security definer set search_path='' as $$
declare
 v_assessment text:=btrim(coalesce(p_assessment_head,''));
 v_academic text:=btrim(coalesce(p_academic_head,''));
 v_director text:=btrim(coalesce(p_director,''));
begin
 if auth.uid() is null or not exists (
  select 1 from public.school_memberships m
  where m.school_id=p_school_id and m.user_id=auth.uid()
    and m.active and m.role='school_admin'
 ) then raise exception 'เฉพาะ Admin โรงเรียนเท่านั้นที่ตั้งค่าผู้ลงนาม ปพ.5 ได้';end if;
 if not exists(select 1 from public.academic_years y
  where y.id=p_year_id and y.school_id=p_school_id)
 then raise exception 'ปีการศึกษาไม่ตรงกับโรงเรียน'; end if;
 if char_length(v_assessment)>150 or char_length(v_academic)>150 or char_length(v_director)>150
 then raise exception 'ชื่อผู้ลงนามต้องไม่เกิน 150 อักขระ';end if;
 insert into public.pp5_signatories(
  school_id,academic_year_id,assessment_head_name,academic_head_name,
  director_name,updated_at,updated_by)
 values(p_school_id,p_year_id,v_assessment,v_academic,v_director,now(),auth.uid())
 on conflict(school_id,academic_year_id) do update set
  assessment_head_name=excluded.assessment_head_name,
  academic_head_name=excluded.academic_head_name,
  director_name=excluded.director_name,
  updated_at=now(),updated_by=auth.uid();
end $$;
revoke all on function public.save_pp5_signatories(uuid,uuid,text,text,text) from public,anon;
grant execute on function public.save_pp5_signatories(uuid,uuid,text,text,text) to authenticated;
