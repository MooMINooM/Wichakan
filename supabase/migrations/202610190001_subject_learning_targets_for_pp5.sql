create table if not exists public.subject_learning_targets (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id) on delete cascade,
 subject_id uuid not null references public.subjects(id) on delete cascade,
 target_type text not null default 'indicator' check (target_type in ('indicator','learning_outcome')),
 standard_code text,
 standard_description text,
 target_code text,
 target_description text not null,
 indicator_phase text check (indicator_phase in ('intermediate','final') or indicator_phase is null),
 display_order integer not null default 0,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists subject_learning_targets_subject_idx on public.subject_learning_targets(subject_id,display_order);
alter table public.subject_learning_targets enable row level security;
create policy "school members can read learning targets" on public.subject_learning_targets for select to authenticated using (exists(select 1 from public.school_memberships m where m.school_id=subject_learning_targets.school_id and m.user_id=auth.uid() and m.active));
create policy "school admin manages learning targets" on public.subject_learning_targets for all to authenticated using (exists(select 1 from public.school_memberships m where m.school_id=subject_learning_targets.school_id and m.user_id=auth.uid() and m.active and m.role='school_admin')) with check (exists(select 1 from public.school_memberships m where m.school_id=subject_learning_targets.school_id and m.user_id=auth.uid() and m.active and m.role='school_admin'));
