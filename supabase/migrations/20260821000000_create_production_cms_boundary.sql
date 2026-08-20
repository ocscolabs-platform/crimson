-- Production CMS publication boundary.
--
-- Apply this migration once to the clean Production Supabase project before
-- running the promotion workflow. It creates public-read CMS tables and a
-- private media bucket. It intentionally creates no CMS member table, Auth
-- user workflow, or browser write policy: editing remains in staging and the
-- promotion runner writes with a server-side service-role key.

create table if not exists public.site_settings (
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

create table if not exists public.navigation_items (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  href text not null,
  navigation_group text not null check (navigation_group in ('primary', 'footer')),
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pages (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  page_purpose text,
  audience text,
  seo_title text,
  seo_description text,
  og_image_path text,
  content jsonb not null default '[]'::jsonb,
  cta_label text,
  cta_href text,
  status text not null default 'draft' check (status in ('draft', 'review', 'published', 'archived')),
  published_at timestamptz,
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.services (
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
  status text not null default 'draft' check (status in ('draft', 'review', 'published', 'archived')),
  published_at timestamptz,
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.case_studies (
  id uuid primary key default gen_random_uuid(),
  project_name text not null,
  slug text not null unique,
  client_visibility text not null default 'hidden' check (client_visibility in ('hidden', 'approved')),
  project_type text not null default 'case-study' check (project_type in ('case-study', 'prototype', 'upcoming')),
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
  media_status text not null default 'pending' check (media_status in ('pending', 'approved', 'rejected')),
  media_reviewed_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'review', 'published', 'archived')),
  published_at timestamptz,
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.case_study_services (
  case_study_id uuid not null references public.case_studies(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  primary key (case_study_id, service_id)
);

create table if not exists public.page_sections (
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

-- Make the migration safe if the clean project already has the foundation
-- tables from an earlier copy of the CMS schema.
alter table public.services
  add column if not exists card_name text,
  add column if not exists outcome text;

alter table public.case_studies
  add column if not exists project_type text not null default 'case-study',
  add column if not exists project_category text,
  add column if not exists external_url text,
  add column if not exists is_featured boolean not null default false,
  add column if not exists sort_order integer not null default 0,
  add column if not exists featured_image_alt text,
  add column if not exists media_status text not null default 'pending',
  add column if not exists media_reviewed_at timestamptz;

create or replace function public.cms_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists site_settings_set_updated_at on public.site_settings;
create trigger site_settings_set_updated_at before update on public.site_settings
for each row execute function public.cms_set_updated_at();
drop trigger if exists navigation_items_set_updated_at on public.navigation_items;
create trigger navigation_items_set_updated_at before update on public.navigation_items
for each row execute function public.cms_set_updated_at();
drop trigger if exists pages_set_updated_at on public.pages;
create trigger pages_set_updated_at before update on public.pages
for each row execute function public.cms_set_updated_at();
drop trigger if exists services_set_updated_at on public.services;
create trigger services_set_updated_at before update on public.services
for each row execute function public.cms_set_updated_at();
drop trigger if exists case_studies_set_updated_at on public.case_studies;
create trigger case_studies_set_updated_at before update on public.case_studies
for each row execute function public.cms_set_updated_at();
drop trigger if exists page_sections_set_updated_at on public.page_sections;
create trigger page_sections_set_updated_at before update on public.page_sections
for each row execute function public.cms_set_updated_at();

create index if not exists navigation_items_group_order_idx
  on public.navigation_items(navigation_group, sort_order);
create index if not exists pages_publication_idx
  on public.pages(status, published_at desc);
create index if not exists services_publication_idx
  on public.services(status, published_at desc);
create index if not exists case_studies_publication_idx
  on public.case_studies(status, published_at desc);
create index if not exists case_studies_featured_order_idx
  on public.case_studies(is_featured desc, sort_order, created_at);
create unique index if not exists case_studies_one_published_featured_idx
  on public.case_studies(is_featured)
  where is_featured = true and status = 'published';
create index if not exists page_sections_page_order_idx
  on public.page_sections(page_id, sort_order);

alter table public.site_settings enable row level security;
alter table public.navigation_items enable row level security;
alter table public.pages enable row level security;
alter table public.services enable row level security;
alter table public.case_studies enable row level security;
alter table public.case_study_services enable row level security;
alter table public.page_sections enable row level security;

grant select on public.site_settings, public.navigation_items, public.pages,
  public.services, public.case_studies, public.case_study_services, public.page_sections
  to anon, authenticated;

drop policy if exists "published site settings are public" on public.site_settings;
create policy "published site settings are public"
  on public.site_settings for select
  to anon, authenticated using (id = 'default');

drop policy if exists "visible navigation items are public" on public.navigation_items;
create policy "visible navigation items are public"
  on public.navigation_items for select
  to anon, authenticated using (is_visible = true);

drop policy if exists "published pages are public" on public.pages;
create policy "published pages are public"
  on public.pages for select
  to anon, authenticated
  using (status = 'published' and published_at is not null and published_at <= now());

drop policy if exists "published services are public" on public.services;
create policy "published services are public"
  on public.services for select
  to anon, authenticated
  using (status = 'published' and published_at is not null and published_at <= now());

drop policy if exists "published case studies are public" on public.case_studies;
create policy "published case studies are public"
  on public.case_studies for select
  to anon, authenticated
  using (status = 'published' and published_at is not null and published_at <= now());

drop policy if exists "published case study relationships are public" on public.case_study_services;
create policy "published case study relationships are public"
  on public.case_study_services for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.case_studies
      where case_studies.id = case_study_services.case_study_id
        and case_studies.status = 'published'
        and case_studies.published_at is not null
        and case_studies.published_at <= now()
    )
    and exists (
      select 1 from public.services
      where services.id = case_study_services.service_id
        and services.status = 'published'
        and services.published_at is not null
        and services.published_at <= now()
    )
  );

drop policy if exists "published page sections are public" on public.page_sections;
create policy "published page sections are public"
  on public.page_sections for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.pages
      where pages.id = page_sections.page_id
        and pages.status = 'published'
        and pages.published_at is not null
        and pages.published_at <= now()
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'case-study-media',
  'case-study-media',
  false,
  2097152,
  array['image/webp']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = 2097152,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "published approved case study media is public" on storage.objects;
create policy "published approved case study media is public"
  on storage.objects for select
  to anon, authenticated
  using (
    bucket_id = 'case-study-media'
    and exists (
      select 1 from public.case_studies
      where case_studies.status = 'published'
        and case_studies.media_status = 'approved'
        and (
          case_studies.featured_image_path = storage.objects.name
          or exists (
            select 1
            from jsonb_array_elements(case_studies.supporting_media) as media_item
            where media_item->>'path' = storage.objects.name
              and coalesce(media_item->>'approval', 'pending') = 'approved'
          )
        )
    )
  );

comment on schema public is
  'Production public CMS boundary. Content is written only by the server-side promotion runner.';
