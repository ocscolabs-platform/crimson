-- OCSCO Project Crimson inquiry intake schema.
-- Apply this migration separately to each environment's Supabase project.

create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  email text not null check (char_length(email) between 5 and 254),
  company text check (company is null or char_length(company) <= 160),
  capability text not null,
  message text not null check (char_length(btrim(message)) between 20 and 4000),
  status text not null default 'new'
    check (status in ('new', 'in_progress', 'closed', 'spam')),
  source text not null default 'website',
  created_at timestamptz not null default now()
);

alter table public.inquiries enable row level security;

revoke all on public.inquiries from anon, authenticated;
grant insert on public.inquiries to service_role;

create index inquiries_status_idx on public.inquiries(status);
create index inquiries_created_at_idx on public.inquiries(created_at desc);
