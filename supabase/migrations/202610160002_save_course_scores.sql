-- One request is one transaction: any row error rolls back every score in the batch.
-- Keep the single-row RPC for older clients and reuse its enrollment/cap/role checks.
create or replace function public.save_course_scores(p_offering_id uuid,p_rows jsonb)
returns void language plpgsql security invoker set search_path='' as $$
declare v_row jsonb;v_scores integer[];
begin
 if auth.uid() is null then raise exception 'กรุณาเข้าสู่ระบบ';end if;
 if jsonb_typeof(p_rows) is distinct from 'array' then raise exception 'ข้อมูลคะแนนต้องเป็นรายการ';end if;
 if jsonb_array_length(p_rows) not between 1 and 2000 then raise exception 'ต้องส่งคะแนน 1–2000 คน';end if;
 for v_row in select value from jsonb_array_elements(p_rows) loop
  if jsonb_typeof(v_row) is distinct from 'object' or jsonb_typeof(v_row->'student_id') is distinct from 'string'
   or (v_row->>'student_id')::uuid is null then raise exception 'ข้อมูลนักเรียนไม่ถูกต้อง';end if;
  if jsonb_typeof(v_row->'scores') is distinct from 'array' then raise exception 'ต้องส่งคะแนน 6 ช่อง';end if;
  if jsonb_array_length(v_row->'scores')<>6 then raise exception 'ต้องส่งคะแนน 6 ช่อง';end if;
  if exists(select 1 from jsonb_array_elements(v_row->'scores') n where n<>'null'::jsonb and
   (jsonb_typeof(n)<>'number' or n::text !~ '^[0-9]+$')) then raise exception 'คะแนนต้องเป็นจำนวนเต็มหรือเว้นว่าง';end if;
  if v_row->'special' is not null and v_row->'special'<>'null'::jsonb and
   (jsonb_typeof(v_row->'special')<>'string' or v_row->>'special' not in ('ร','มส')) then raise exception 'ผลพิเศษไม่ถูกต้อง';end if;
 end loop;
 if (select count(distinct (value->>'student_id')::uuid) from jsonb_array_elements(p_rows))<>jsonb_array_length(p_rows) then
  raise exception 'มีนักเรียนซ้ำในรายการคะแนน';end if;
 -- Stable lock order avoids deadlocks between overlapping class saves.
 for v_row in select value from jsonb_array_elements(p_rows) order by (value->>'student_id')::uuid loop
  select array_agg(case when n='null'::jsonb then null else (n::text)::integer end order by i)
   into v_scores from jsonb_array_elements(v_row->'scores') with ordinality as a(n,i);
  perform public.save_student_course_score(p_offering_id,(v_row->>'student_id')::uuid,v_scores,v_row->>'special');
 end loop;
end $$;
revoke all on function public.save_course_scores(uuid,jsonb) from public,anon;
grant execute on function public.save_course_scores(uuid,jsonb) to authenticated;
