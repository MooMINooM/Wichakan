-- OAuth refresh tokens are readable only by server-side service_role; never accessible via browser.
create table public.sar_drive_connections(
 school_id uuid primary key references public.schools(id) on delete cascade,
 connected_by uuid not null references auth.users(id),
 refresh_token text not null,
 root_folder_id text,
 updated_at timestamptz not null default now()
);
alter table public.sar_drive_connections enable row level security;
revoke all on public.sar_drive_connections from public,anon,authenticated;
grant select,insert,update,delete on public.sar_drive_connections to service_role;
