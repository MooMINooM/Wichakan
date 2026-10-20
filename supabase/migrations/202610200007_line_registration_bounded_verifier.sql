-- Bounded citizen verifier comparison avoids PostgREST statement timeouts.
-- Only service_role can call this; the caller must verify LINE's ID token.
create or replace function public.request_line_registration_batch(
 p_line_user_id text,p_citizen_id text,p_offset integer default 0,p_limit integer default 10
) returns text language plpgsql security definer set search_path='' as $$
declare v_count integer; v_match record;
begin
 if auth.role()<>'service_role' then raise exception 'forbidden'; end if;
 if p_line_user_id is null or length(p_line_user_id) not between 10 and 255
    or p_citizen_id !~ '^[0-9]{13}$' or p_offset<0 or p_offset>10000
    or p_limit<1 or p_limit>15 then return 'invalid'; end if;
 if p_offset=0 then
   select count(*) into v_count from private.line_registration_attempts
   where line_user_id=p_line_user_id and attempted_at>now()-interval '1 hour';
   if v_count>=5 then return 'rate_limited'; end if;
   insert into private.line_registration_attempts(line_user_id) values(p_line_user_id);
 end if;
 for v_match in
   select v.school_id,v.student_id,v.verifier from private.student_citizen_verifiers v
   join public.students s on s.id=v.student_id and s.status='active'
   order by v.student_id offset p_offset limit p_limit
 loop
   if extensions.crypt(p_citizen_id,v_match.verifier)=v_match.verifier then
     insert into public.line_student_claims(school_id,student_id,line_user_id)
     values(v_match.school_id,v_match.student_id,p_line_user_id)
     on conflict(school_id,student_id,line_user_id) do nothing;
     return 'received';
   end if;
 end loop;
 return 'continue';
end $$;
revoke all on function public.request_line_registration_batch(text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.request_line_registration_batch(text,text,integer,integer) to service_role;
-- The legacy unbounded routine must not remain callable.
revoke all on function public.request_line_registration(text,text) from public,anon,authenticated,service_role;
