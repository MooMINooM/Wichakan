-- v0.7 personnel management: one auth identity may hold multiple school roles.
-- Server-side guard: only a school administrator can grant or revoke memberships.
create unique index if not exists school_memberships_school_user_role_uq
on public.school_memberships(school_id,user_id,role);

create or replace function public.grant_school_staff_role(
 p_school_id uuid,p_user_id uuid,p_display_name text,p_role text
) returns void language plpgsql security definer set search_path = ''
as $$
begin
 if (select auth.uid()) is null or not private.has_school_role(p_school_id,array['school_admin']) then
  raise exception 'Administrator access required';
 end if;
 if p_user_id is null or p_role not in ('teacher','registrar','academic','director') then
  raise exception 'Invalid user or role';
 end if;
 if length(trim(coalesce(p_display_name,''))) not between 2 and 150 then raise exception 'Name must have 2-150 characters'; end if;
 if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'Create this user in Authentication first'; end if;
 insert into public.profiles(user_id,display_name) values(p_user_id,trim(p_display_name))
 on conflict(user_id) do update set display_name=excluded.display_name;
 insert into public.school_memberships(school_id,user_id,role,active)
 values(p_school_id,p_user_id,p_role,true)
 on conflict(school_id,user_id,role) do update set active=true;
end;
$$;
revoke all on function public.grant_school_staff_role(uuid,uuid,text,text) from public,anon;
grant execute on function public.grant_school_staff_role(uuid,uuid,text,text) to authenticated;

create or replace function public.set_school_staff_role_active(
 p_school_id uuid,p_user_id uuid,p_role text,p_active boolean
) returns void language plpgsql security definer set search_path = ''
as $$
begin
 if (select auth.uid()) is null or not private.has_school_role(p_school_id,array['school_admin']) then
  raise exception 'Administrator access required';
 end if;
 if p_role not in ('teacher','registrar','academic','director') or p_active is null then raise exception 'Invalid role change'; end if;
 update public.school_memberships set active=p_active
 where school_id=p_school_id and user_id=p_user_id and role=p_role;
 if not found then raise exception 'Membership not found'; end if;
end;
$$;
revoke all on function public.set_school_staff_role_active(uuid,uuid,text,boolean) from public,anon;
grant execute on function public.set_school_staff_role_active(uuid,uuid,text,boolean) to authenticated;
