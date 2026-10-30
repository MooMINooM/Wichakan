-- School administrator RLS read access to connected guardian records.
do $$
begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='guardians' and policyname='admin read line guardians') then
  create policy "admin read line guardians" on public.guardians for select to authenticated using(
   exists(select 1 from public.school_memberships m where m.school_id=guardians.school_id and m.user_id=auth.uid() and m.active and m.role='school_admin'));
 end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='student_guardians' and policyname='admin read student guardians') then
  create policy "admin read student guardians" on public.student_guardians for select to authenticated using(
   exists(select 1 from public.school_memberships m where m.school_id=student_guardians.school_id and m.user_id=auth.uid() and m.active and m.role='school_admin'));
 end if;
end $$;
