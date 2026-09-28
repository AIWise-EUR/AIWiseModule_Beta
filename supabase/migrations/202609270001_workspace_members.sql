-- Run in the Supabase SQL Editor as the project administrator.
-- This creates membership only. No existing workspace content is migrated.
begin;

create table if not exists public.workspace_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.workspace_members enable row level security;
revoke all on table public.workspace_members from public, anon, authenticated;
grant select on table public.workspace_members to authenticated;
grant all on table public.workspace_members to service_role;

drop policy if exists workspace_members_read_self on public.workspace_members;
create policy workspace_members_read_self
  on public.workspace_members for select to authenticated
  using ((select auth.uid()) = user_id and active = true);

comment on table public.workspace_members is
  'Administrator-managed development-team membership. Users may read only their own active membership; they cannot enroll or promote themselves.';

commit;

-- Add approved users through the administrator's Table Editor after creating
-- their Auth account. Set user_id to that Auth user's UUID and active to true.
-- Future shared tables require their own membership-enforcing RLS policies.
