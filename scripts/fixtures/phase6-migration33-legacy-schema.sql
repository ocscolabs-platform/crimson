-- Disposable Migration #33 schema fixture only.
-- This is an audited legacy-shaped schema, not a replay of migrations 1–32.

create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  company text,
  capability text not null,
  message text not null,
  status text not null default 'new',
  source text not null default 'fixture',
  created_at timestamptz not null default now()
);

create table public.site_settings (
  id text primary key default 'default',
  site_name text not null,
  positioning_statement text,
  default_seo_title text,
  default_seo_description text,
  default_og_image_path text,
  primary_contact_path text not null default '/contact',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.navigation_items (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  href text not null,
  navigation_group text not null,
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pages (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  page_purpose text,
  audience text,
  seo_title text,
  seo_description text,
  og_image_path text,
  content jsonb not null,
  cta_label text,
  cta_href text,
  status text not null default 'draft',
  published_at timestamptz,
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint legacy_pages_content_array check (jsonb_typeof(content) = 'array')
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  short_description text,
  detailed_description text,
  audience text,
  deliverables jsonb not null default '[]'::jsonb,
  process_summary text,
  card_name text,
  outcome text,
  cta_label text,
  cta_href text,
  status text not null default 'draft',
  published_at timestamptz,
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.case_studies (
  id uuid primary key default gen_random_uuid(),
  project_name text not null,
  slug text not null unique,
  client_visibility text not null default 'hidden',
  project_type text not null default 'case-study',
  project_category text,
  external_url text,
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  summary text,
  challenge text,
  approach text,
  deliverables jsonb not null default '[]'::jsonb,
  outcomes jsonb not null default '[]'::jsonb,
  featured_image_path text,
  featured_image_alt text,
  supporting_media jsonb not null default '[]'::jsonb,
  media_status text not null default 'pending',
  media_reviewed_at timestamptz,
  status text not null default 'draft',
  published_at timestamptz,
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.case_study_services (
  case_study_id uuid not null references public.case_studies(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  primary key (case_study_id, service_id)
);

create table public.cms_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'reviewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cms_revisions (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_key text not null,
  status text not null,
  payload jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cms_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  entity_type text not null default 'service',
  entity_id uuid not null,
  action text not null,
  from_status text,
  to_status text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create table public.cms_global_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  entity_type text not null,
  entity_key text not null,
  action text not null,
  from_status text,
  to_status text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create table public.page_sections (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages(id) on delete cascade,
  section_key text not null,
  label text not null,
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (page_id, section_key)
);

create or replace function public.cms_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger cms_members_set_updated_at before update on public.cms_members
for each row execute function public.cms_set_updated_at();
create trigger pages_set_updated_at before update on public.pages
for each row execute function public.cms_set_updated_at();
create trigger services_set_updated_at before update on public.services
for each row execute function public.cms_set_updated_at();
create trigger case_studies_set_updated_at before update on public.case_studies
for each row execute function public.cms_set_updated_at();
create trigger page_sections_set_updated_at before update on public.page_sections
for each row execute function public.cms_set_updated_at();

create or replace function public.cms_current_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.cms_members where user_id = auth.uid() limit 1;
$$;

create or replace function public.cms_has_role(allowed_roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.cms_current_role() = any(allowed_roles), false);
$$;

alter table public.inquiries enable row level security;
alter table public.site_settings enable row level security;
alter table public.navigation_items enable row level security;
alter table public.pages enable row level security;
alter table public.services enable row level security;
alter table public.case_studies enable row level security;
alter table public.case_study_services enable row level security;
alter table public.cms_members enable row level security;
alter table public.cms_revisions enable row level security;
alter table public.cms_audit_log enable row level security;
alter table public.cms_global_audit_log enable row level security;
alter table public.page_sections enable row level security;

grant select on public.site_settings, public.navigation_items, public.pages,
  public.services, public.case_studies, public.case_study_services,
  public.page_sections to anon, authenticated;
grant select on public.cms_members, public.cms_revisions,
  public.cms_audit_log, public.cms_global_audit_log to authenticated;
grant execute on function public.cms_current_role() to authenticated;
grant execute on function public.cms_has_role(text[]) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('case-study-media', 'case-study-media', false, 2097152, array['image/webp']::text[])
on conflict (id) do nothing;
