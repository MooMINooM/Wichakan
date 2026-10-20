-- DMC citizen IDs are never stored as plaintext or exposed by Data API.
create extension if not exists pgcrypto with schema extensions;
create table if not exists private.student_citizen_verifiers (
 student_id uuid primary key references public.students(id) on delete cascade,
 school_id uuid not null references public.schools(id) on delete cascade,
 verifier text not null,
 updated_at timestamptz not null default now()
);
revoke all on private.student_citizen_verifiers from public,anon,authenticated;
create or replace function public.import_dmc_citizen_verifiers(p_school uuid,p_rows jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb; student uuid; citizen text; number text; first text; last text; n int:=0; mismatch int:=0;
begin
 if not private.has_school_role(p_school,array['school_admin','registrar']) then raise exception 'not_authorized';end if;
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>1000 then raise exception 'invalid_rows';end if;
 for r in select value from jsonb_array_elements(p_rows) loop
  citizen=trim(coalesce(r->>'citizen_id',''));number=trim(coalesce(r->>'student_no',''));
  first=trim(coalesce(r->>'first_name_th',''));last=trim(coalesce(r->>'last_name_th',''));
  if citizen !~ '^[0-9]{13}$' then raise exception 'invalid_citizen_id'; end if;
  select id into student from public.students where school_id=p_school and student_no=number and first_name_th=first and last_name_th=last and status='active';
  if student is null then mismatch=mismatch+1;continue;end if;
  insert into private.student_citizen_verifiers(student_id,school_id,verifier)
  values(student,p_school,extensions.crypt(citizen,extensions.gen_salt('bf',10)))
  on conflict(student_id) do update set verifier=excluded.verifier,updated_at=now();
  n=n+1;student=null;
 end loop;
 return jsonb_build_object('updated',n,'unmatched',mismatch);
end $$;
revoke all on function public.import_dmc_citizen_verifiers(uuid,jsonb) from public,anon;
grant execute on function public.import_dmc_citizen_verifiers(uuid,jsonb) to authenticated;
