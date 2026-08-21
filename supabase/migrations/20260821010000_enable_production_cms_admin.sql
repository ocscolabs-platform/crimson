-- OCSCO Project Crimson canonical Production CMS boundary.
--
-- Apply once to the Production Supabase project after the public CMS
-- foundation migration. This enables the authenticated /admin surface and
-- the existing controlled editor policies. It does not create an account or
-- seed an account-specific user; create the owner in Supabase Auth and add
-- that user's UUID to public.cms_members separately.
--
-- The revision-based publishing migration will tighten the global-content
-- write path before the temporary two-database promotion bridge is removed.

create table if not exists public.cms_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'reviewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists cms_members_set_updated_at on public.cms_members;
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
  select role from public.cms_members where user_id = auth.uid() limit 1;
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

drop policy if exists "members can read their own membership" on public.cms_members;
create policy "members can read their own membership"
  on public.cms_members for select
  to authenticated
  using (user_id = auth.uid() or public.cms_has_role(array['owner']::text[]));

drop policy if exists "owners can manage memberships" on public.cms_members;
create policy "owners can manage memberships"
  on public.cms_members for all
  to authenticated
  using (public.cms_has_role(array['owner']::text[]))
  with check (public.cms_has_role(array['owner']::text[]));

-- Authenticated CMS members may inspect the full editorial boundary. The
-- anonymous policies in the Production boundary continue to expose only
-- published/visible content to the public website.
drop policy if exists "cms members can read all site settings" on public.site_settings;
create policy "cms members can read all site settings"
  on public.site_settings for select
  to authenticated using (public.cms_has_role(array['owner', 'editor', 'reviewer']::text[]));

drop policy if exists "cms members can read all navigation items" on public.navigation_items;
create policy "cms members can read all navigation items"
  on public.navigation_items for select
  to authenticated using (public.cms_has_role(array['owner', 'editor', 'reviewer']::text[]));

drop policy if exists "cms members can read all pages" on public.pages;
create policy "cms members can read all pages"
  on public.pages for select
  to authenticated using (public.cms_has_role(array['owner', 'editor', 'reviewer']::text[]));

drop policy if exists "cms members can read all page sections" on public.page_sections;
create policy "cms members can read all page sections"
  on public.page_sections for select
  to authenticated using (public.cms_has_role(array['owner', 'editor', 'reviewer']::text[]));

drop policy if exists "cms members can read all services" on public.services;
create policy "cms members can read all services"
  on public.services for select
  to authenticated
  using (
    public.cms_has_role(array['owner', 'editor', 'reviewer']::text[])
    and (status <> 'archived' or public.cms_has_role(array['owner']::text[]))
  );

drop policy if exists "cms members can read all case studies" on public.case_studies;
create policy "cms members can read all case studies"
  on public.case_studies for select
  to authenticated
  using (
    public.cms_has_role(array['owner', 'editor', 'reviewer']::text[])
    and (status <> 'archived' or public.cms_has_role(array['owner']::text[]))
  );

drop policy if exists "cms members can read case study relationships" on public.case_study_services;
create policy "cms members can read case study relationships"
  on public.case_study_services for select
  to authenticated
  using (public.cms_has_role(array['owner', 'editor', 'reviewer']::text[]));

-- The existing controlled editor is deliberately available only to members.
-- Published-content safeguards remain enforced by the database triggers from
-- the staging editor migrations and will be carried forward to revisions.
grant update on public.site_settings, public.navigation_items, public.pages,
  public.page_sections, public.services, public.case_studies to authenticated;
grant insert, delete on public.case_study_services to authenticated;

drop policy if exists "owners and editors can update site settings" on public.site_settings;
create policy "owners and editors can update site settings"
  on public.site_settings for update to authenticated
  using (public.cms_has_role(array['owner', 'editor']::text[]))
  with check (id = 'default');

drop policy if exists "owners and editors can update navigation items" on public.navigation_items;
create policy "owners and editors can update navigation items"
  on public.navigation_items for update to authenticated
  using (public.cms_has_role(array['owner', 'editor']::text[]))
  with check (navigation_group in ('primary', 'footer'));

drop policy if exists "owners can update pages" on public.pages;
create policy "owners can update pages"
  on public.pages for update to authenticated
  using (public.cms_has_role(array['owner']::text[]))
  with check (public.cms_has_role(array['owner']::text[]));

drop policy if exists "editors can update draft or review pages" on public.pages;
create policy "editors can update draft or review pages"
  on public.pages for update to authenticated
  using (public.cms_has_role(array['editor']::text[]) and status in ('draft', 'review'))
  with check (status in ('draft', 'review'));

drop policy if exists "owners can update page sections" on public.page_sections;
create policy "owners can update page sections"
  on public.page_sections for update to authenticated
  using (public.cms_has_role(array['owner']::text[]))
  with check (public.cms_has_role(array['owner']::text[]));

-- Keep the audit relations available to the existing review screens while
-- the revision migration is being rolled out.
create table if not exists public.cms_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  entity_type text not null check (entity_type in ('service', 'case_study', 'case_study_service')),
  entity_id uuid not null,
  action text not null check (action in ('created', 'updated', 'status_changed', 'deleted', 'relationship_added', 'relationship_changed', 'relationship_removed')),
  from_status text,
  to_status text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists cms_audit_log_entity_created_idx
  on public.cms_audit_log(entity_type, entity_id, created_at desc);
alter table public.cms_audit_log enable row level security;
revoke all on public.cms_audit_log from anon, authenticated;
grant select on public.cms_audit_log to authenticated;
drop policy if exists "cms members can read CMS audit history" on public.cms_audit_log;
create policy "cms members can read CMS audit history"
  on public.cms_audit_log for select to authenticated
  using (public.cms_has_role(array['owner', 'editor', 'reviewer']::text[]));

create table if not exists public.cms_global_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  entity_type text not null check (entity_type in ('site_settings', 'navigation_item', 'page', 'page_section')),
  entity_key text not null,
  action text not null check (action in ('updated', 'status_changed')),
  from_status text,
  to_status text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists cms_global_audit_entity_created_idx
  on public.cms_global_audit_log(entity_type, entity_key, created_at desc);
alter table public.cms_global_audit_log enable row level security;
revoke all on public.cms_global_audit_log from anon, authenticated;
grant select on public.cms_global_audit_log to authenticated;
drop policy if exists "cms members can read global audit history" on public.cms_global_audit_log;
create policy "cms members can read global audit history"
  on public.cms_global_audit_log for select to authenticated
  using (public.cms_has_role(array['owner', 'editor', 'reviewer']::text[]));

comment on schema public is
  'OCSCO canonical CMS source. Production /admin is authenticated; public reads remain published-only.';
