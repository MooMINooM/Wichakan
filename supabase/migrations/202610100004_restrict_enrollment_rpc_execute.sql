-- Align repository schema with Supabase security hardening migration.
-- PostgreSQL grants EXECUTE to PUBLIC for functions by default.
revoke execute on function public.change_student_enrollment(uuid,uuid,text,text) from public, anon;
grant execute on function public.change_student_enrollment(uuid,uuid,text,text) to authenticated;
