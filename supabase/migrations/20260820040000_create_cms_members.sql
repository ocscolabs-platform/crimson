-- OCSCO Project Crimson CMS membership boundary.
-- Apply independently to each environment's Supabase project.
-- This migration defines membership and role checks only; it does not grant
-- content mutation access or seed an account-specific member.

create table public.cms_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'reviewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger cms_members_set_updated_at
before update on public.cms_members
for each row execute function public.cms_set_updated_at();

alter table public.cms_members enable row level security;

grant select on public.cms_members to authenticated;

create or replace function public.cms_current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.cms_members
  where user_id = auth.uid()
  limit 1;
$$;

create or replace function public.cms_has_role(allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.cms_current_role() = any(allowed_roles), false);
$$;

revoke all on function public.cms_current_role() from public;
revoke all on function public.cms_has_role(text[]) from public;
grant execute on function public.cms_current_role() to authenticated;
grant execute on function public.cms_has_role(text[]) to authenticated;

create policy "members can read their own membership"
  on public.cms_members for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.cms_has_role(array['owner']::text[])
  );

create policy "owners can manage memberships"
  on public.cms_members for all
  to authenticated
  using (public.cms_has_role(array['owner']::text[]))
  with check (public.cms_has_role(array['owner']::text[]));

comment on table public.cms_members is
  'Staging CMS membership map. Roles are owner, editor, or reviewer. Content mutation policies are intentionally separate.';
comment on column public.cms_members.role is
  'owner: manage access; editor: prepare content; reviewer: review content. Publishing permissions require a later policy decision.';
