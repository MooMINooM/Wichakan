-- Review a completed historical curriculum worksheet in a single atomic transaction.
-- Every subject row gets its own provenance entry via the audited single-row verifier.
create or replace function public.schoolmis_verify_weights_batch(
 p_school uuid,p_rows jsonb
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare v_actor uuid:=auth.uid();v_row jsonb;v_updated integer:=0;v_count integer:=0;
 v_unique text[]:=array[]::text[];v_key text;
begin
 if v_actor is null or not exists(select 1 from public.school_memberships m where m.school_id=p_school
   and m.user_id=v_actor and m.active and m.role in ('school_admin','registrar'))
 then raise exception 'schoolmis_not_authorized';end if;
 if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 250
 then raise exception 'schoolmis_invalid_batch';end if;
 for v_row in select value from jsonb_array_elements(p_rows) loop
  if v_row->>'year' is null or v_row->>'level' is null or v_row->>'term' is null
   or v_row->>'subject_code' is null or v_row->>'weight' is null
   or v_row->>'evidence' is null
  then raise exception 'schoolmis_invalid_batch_row';end if;
  v_key:=concat_ws('|',v_row->>'year',v_row->>'level',v_row->>'term',v_row->>'subject_code');
  if v_key=any(v_unique) then raise exception 'schoolmis_duplicate_batch_row';end if;
  v_unique:=array_append(v_unique,v_key);
  v_updated:=v_updated+public.schoolmis_verify_weight(p_school,
    (v_row->>'year')::integer,v_row->>'level',(v_row->>'term')::integer,
    v_row->>'subject_code',(v_row->>'weight')::numeric,v_row->>'evidence');
  v_count:=v_count+1;
 end loop;
 return jsonb_build_object('subjects',v_count,'student_rows',v_updated);
end $fn$;
revoke all on function public.schoolmis_verify_weights_batch(uuid,jsonb) from public,anon;
grant execute on function public.schoolmis_verify_weights_batch(uuid,jsonb) to authenticated;
