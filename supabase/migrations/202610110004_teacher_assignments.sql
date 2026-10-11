-- v0.6: annual homeroom allocations and subject teacher assignments.
create table public.homeroom_assignments (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id),
 classroom_id uuid not null,
 teacher_user_id uuid not null references public.profiles(user_id),
 created_at timestamptz not null default now(),
 unique(classroom_id,teacher_user_id),
 foreign key(classroom_id,school_id) references public.classrooms(id,school_id)
);
alter table public.homeroom_assignments enable row level security;
create policy "staff read homerooms" on public.homeroom_assignments for select to authenticated
 using(private.has_school_role(school_id,array['school_admin','director','academic','registrar','teacher']));
create policy "academic add homerooms" on public.homeroom_assignments for insert to authenticated
 with check(private.has_school_role(school_id,array['school_admin','academic'])
 and exists(select 1 from public.school_memberships m where m.school_id=homeroom_assignments.school_id and m.user_id=homeroom_assignments.teacher_user_id and m.active and m.role='teacher'));
create policy "academic remove homerooms" on public.homeroom_assignments for delete to authenticated
 using(private.has_school_role(school_id,array['school_admin','academic']));

-- Show school teacher directory to administration without exposing unrelated schools.
create policy "admins read school member roster" on public.school_memberships for select to authenticated
 using(private.has_school_role(school_id,array['school_admin','academic','director']));
create policy "staff read in-school names" on public.profiles for select to authenticated
 using(exists(select 1 from public.school_memberships m where m.user_id=profiles.user_id and m.active
 and private.has_school_role(m.school_id,array['school_admin','academic','director','registrar','teacher'])));

create policy "staff read class offerings" on public.course_offerings for select to authenticated
 using(private.has_school_role(school_id,array['school_admin','academic','director','registrar','teacher']));
create policy "academic create class offerings" on public.course_offerings for insert to authenticated
 with check(private.has_school_role(school_id,array['school_admin','academic'])
 and exists(select 1 from public.terms t join public.classrooms c on c.academic_year_id=t.academic_year_id and c.school_id=t.school_id where t.id=term_id and c.id=classroom_id and t.school_id=course_offerings.school_id));
create policy "staff read subject teaching" on public.teaching_assignments for select to authenticated
 using(private.has_school_role(school_id,array['school_admin','academic','director','registrar','teacher']));
create policy "academic assign subject teachers" on public.teaching_assignments for insert to authenticated
 with check(private.has_school_role(school_id,array['school_admin','academic'])
 and exists(select 1 from public.school_memberships m where m.school_id=teaching_assignments.school_id and m.user_id=teacher_user_id and m.active and m.role='teacher'));
create policy "academic unassign subject teachers" on public.teaching_assignments for delete to authenticated
 using(private.has_school_role(school_id,array['school_admin','academic']));
