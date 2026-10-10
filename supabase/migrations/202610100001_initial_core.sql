-- Wichakan v0.1 initial schema. Apply only to a development Supabase project.
-- App tables live in public, but are inaccessible to regular clients until explicit RLS policies are implemented.
create extension if not exists pgcrypto;

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name_th text not null,
  code text unique,
  created_at timestamptz not null default now()
);

create table public.academic_years (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  year_be integer not null check (year_be between 2500 and 2800),
  is_active boolean not null default false,
  unique(school_id, year_be),
  unique(id, school_id)
);

create table public.terms (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  academic_year_id uuid not null,
  term_no smallint not null check(term_no between 1 and 3),
  starts_on date,
  ends_on date,
  check (ends_on is null or starts_on is null or ends_on >= starts_on),
  foreign key (academic_year_id, school_id) references public.academic_years(id, school_id),
  unique(academic_year_id, term_no),
  unique(id, school_id)
);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table public.school_memberships (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  user_id uuid not null references public.profiles(user_id),
  role text not null check(role in ('school_admin','director','academic','registrar','teacher')),
  active boolean not null default true,
  unique(school_id, user_id, role)
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  student_no text not null,
  first_name_th text not null,
  last_name_th text not null,
  status text not null default 'active' check(status in ('active','transferred','graduated','inactive')),
  created_at timestamptz not null default now(),
  unique(school_id, student_no),
  unique(id, school_id)
);

create table public.guardians (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  full_name_th text not null,
  phone text,
  unique(id, school_id)
);

create table public.student_guardians (
  school_id uuid not null,
  student_id uuid not null,
  guardian_id uuid not null,
  relationship text not null,
  primary key(student_id, guardian_id),
  foreign key(student_id, school_id) references public.students(id, school_id),
  foreign key(guardian_id, school_id) references public.guardians(id, school_id)
);

create table public.classrooms (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  academic_year_id uuid not null,
  level_code text not null,
  room_code text not null,
  foreign key(academic_year_id, school_id) references public.academic_years(id, school_id),
  unique(academic_year_id, level_code, room_code),
  unique(id, school_id),
  unique(id, academic_year_id, school_id)
);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  academic_year_id uuid not null,
  student_id uuid not null,
  classroom_id uuid not null,
  started_on date,
  ended_on date,
  status text not null default 'active' check(status in ('active','transferred','withdrawn','completed')),
  check(ended_on is null or started_on is null or ended_on >= started_on),
  foreign key(academic_year_id, school_id) references public.academic_years(id, school_id),
  foreign key(student_id, school_id) references public.students(id, school_id),
  foreign key(classroom_id, academic_year_id, school_id) references public.classrooms(id, academic_year_id, school_id),
  unique(student_id, academic_year_id)
);

create table public.curricula (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  name_th text not null,
  unique(id, school_id)
);

create table public.curriculum_versions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  curriculum_id uuid not null,
  version_label text not null,
  effective_year_be integer not null,
  frozen_at timestamptz,
  foreign key(curriculum_id, school_id) references public.curricula(id, school_id),
  unique(curriculum_id, version_label),
  unique(id, school_id)
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  curriculum_version_id uuid not null,
  subject_code text not null,
  name_th text not null,
  learning_hours integer not null check (learning_hours >= 0),
  category text not null check(category in ('basic','additional','activity')),
  foreign key(curriculum_version_id, school_id) references public.curriculum_versions(id, school_id),
  unique(curriculum_version_id, subject_code),
  unique(id, school_id)
);

create table public.course_offerings (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  term_id uuid not null,
  subject_id uuid not null,
  classroom_id uuid not null,
  foreign key(term_id, school_id) references public.terms(id, school_id),
  foreign key(subject_id, school_id) references public.subjects(id, school_id),
  foreign key(classroom_id, school_id) references public.classrooms(id, school_id),
  unique(term_id, subject_id, classroom_id),
  unique(id, school_id)
);

create table public.teaching_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  course_offering_id uuid not null,
  teacher_user_id uuid not null references public.profiles(user_id),
  foreign key(course_offering_id, school_id) references public.course_offerings(id, school_id),
  unique(course_offering_id, teacher_user_id)
);

-- Row-level security defaults to deny all client access without applicable policies.
alter table public.schools enable row level security;
alter table public.academic_years enable row level security;
alter table public.terms enable row level security;
alter table public.profiles enable row level security;
alter table public.school_memberships enable row level security;
alter table public.students enable row level security;
alter table public.guardians enable row level security;
alter table public.student_guardians enable row level security;
alter table public.classrooms enable row level security;
alter table public.enrollments enable row level security;
alter table public.curricula enable row level security;
alter table public.curriculum_versions enable row level security;
alter table public.subjects enable row level security;
alter table public.course_offerings enable row level security;
alter table public.teaching_assignments enable row level security;

-- No client policies yet: deliberately do not use the service_role key from a browser.
