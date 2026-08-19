-- OCSCO Project Crimson CMS foundation.
-- Apply independently to each environment's Supabase project.
-- This migration creates the content boundary only; it does not seed public copy.

create table public.site_settings (
  id text primary key default 'default' check (id = 'default'),
  site_name text not null default 'OCSCO',
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
  label text not null check (char_length(btrim(label)) between 1 and 80),
  href text not null check (char_length(btrim(href)) between 1 and 240),
  navigation_group text not null check (navigation_group in ('primary', 'footer')),
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pages (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 180),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  page_purpose text,
  audience text,
  seo_title text,
  seo_description text,
  og_image_path text,
  content jsonb not null default '[]'::jsonb check (jsonb_typeof(content) = 'array'),
  cta_label text,
  cta_href text,
  status text not null default 'draft' check (status in ('draft', 'review', 'published', 'archived')),
  published_at timestamptz,
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 180),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  short_description text,
  detailed_description text,
  audience text,
  deliverables jsonb not null default '[]'::jsonb check (jsonb_typeof(deliverables) = 'array'),
  process_summary text,
  cta_label text,
  cta_href text,
  status text not null default 'draft' check (status in ('draft', 'review', 'published', 'archived')),
  published_at timestamptz,
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.case_studies (
  id uuid primary key default gen_random_uuid(),
  project_name text not null check (char_length(btrim(project_name)) between 1 and 180),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  client_visibility text not null default 'hidden' check (client_visibility in ('hidden', 'approved')),
  summary text,
  challenge text,
  approach text,
  deliverables jsonb not null default '[]'::jsonb check (jsonb_typeof(deliverables) = 'array'),
  outcomes jsonb not null default '[]'::jsonb check (jsonb_typeof(outcomes) = 'array'),
  featured_image_path text,
  supporting_media jsonb not null default '[]'::jsonb check (jsonb_typeof(supporting_media) = 'array'),
  status text not null default 'draft' check (status in ('draft', 'review', 'published', 'archived')),
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

create function public.cms_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger site_settings_set_updated_at
before update on public.site_settings
for each row execute function public.cms_set_updated_at();

create trigger navigation_items_set_updated_at
before update on public.navigation_items
for each row execute function public.cms_set_updated_at();

create trigger pages_set_updated_at
before update on public.pages
for each row execute function public.cms_set_updated_at();

create trigger services_set_updated_at
before update on public.services
for each row execute function public.cms_set_updated_at();

create trigger case_studies_set_updated_at
before update on public.case_studies
for each row execute function public.cms_set_updated_at();

create index navigation_items_group_order_idx
  on public.navigation_items(navigation_group, sort_order);
create index pages_publication_idx
  on public.pages(status, published_at desc);
create index services_publication_idx
  on public.services(status, published_at desc);
create index case_studies_publication_idx
  on public.case_studies(status, published_at desc);

alter table public.site_settings enable row level security;
alter table public.navigation_items enable row level security;
alter table public.pages enable row level security;
alter table public.services enable row level security;
alter table public.case_studies enable row level security;
alter table public.case_study_services enable row level security;

grant select on public.site_settings to anon, authenticated;
grant select on public.navigation_items to anon, authenticated;
grant select on public.pages to anon, authenticated;
grant select on public.services to anon, authenticated;
grant select on public.case_studies to anon, authenticated;
grant select on public.case_study_services to anon, authenticated;

create policy "published site settings are public"
  on public.site_settings for select
  using (id = 'default');

create policy "visible navigation items are public"
  on public.navigation_items for select
  using (is_visible = true);

create policy "published pages are public"
  on public.pages for select
  using (status = 'published' and published_at is not null and published_at <= now());

create policy "published services are public"
  on public.services for select
  using (status = 'published' and published_at is not null and published_at <= now());

create policy "published case studies are public"
  on public.case_studies for select
  using (status = 'published' and published_at is not null and published_at <= now());

create policy "published case study relationships are public"
  on public.case_study_services for select
  using (
    exists (
      select 1
      from public.case_studies
      where case_studies.id = case_study_services.case_study_id
        and case_studies.status = 'published'
        and case_studies.published_at is not null
        and case_studies.published_at <= now()
    )
    and exists (
      select 1
      from public.services
      where services.id = case_study_services.service_id
        and services.status = 'published'
        and services.published_at is not null
        and services.published_at <= now()
    )
  );
