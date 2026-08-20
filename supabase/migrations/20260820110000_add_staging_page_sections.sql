-- OCSCO Project Crimson approved page-section controls.
-- Apply in crimson-staging after 20260820100000_add_staging_global_content_editor.sql.
-- This adds fixed section rows only. It does not create a freeform page builder.

create table public.page_sections (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages(id) on delete cascade,
  section_key text not null check (section_key in (
    'home_intro', 'home_capabilities', 'home_approach', 'home_proof', 'home_contact',
    'about_principles', 'about_people',
    'services_capabilities', 'work_library',
    'contact_process', 'contact_form'
  )),
  label text not null check (char_length(btrim(label)) between 1 and 100),
  sort_order integer not null default 0 check (sort_order >= 0),
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (page_id, section_key)
);

create trigger page_sections_set_updated_at
before update on public.page_sections
for each row execute function public.cms_set_updated_at();

create index page_sections_page_order_idx
  on public.page_sections(page_id, sort_order);

alter table public.page_sections enable row level security;

grant select on public.page_sections to anon, authenticated;
grant update on public.page_sections to authenticated;

create policy "published page sections are public"
  on public.page_sections for select
  using (
    exists (
      select 1
      from public.pages
      where pages.id = page_sections.page_id
        and pages.status = 'published'
        and pages.published_at is not null
        and pages.published_at <= now()
    )
  );

create policy "cms members can read all page sections"
  on public.page_sections for select
  to authenticated
  using (public.cms_has_role(array['owner', 'editor', 'reviewer']::text[]));

create policy "owners can update page sections"
  on public.page_sections for update
  to authenticated
  using (public.cms_has_role(array['owner']::text[]))
  with check (public.cms_has_role(array['owner']::text[]));

create or replace function public.cms_prepare_page_section_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.is_visible = true
    and new.is_visible = false
    and not exists (
      select 1
      from public.page_sections
      where page_id = old.page_id
        and id <> old.id
        and is_visible = true
    )
  then
    raise exception 'Keep at least one approved section visible on each page';
  end if;

  return new;
end;
$$;

revoke all on function public.cms_prepare_page_section_update() from public;
grant execute on function public.cms_prepare_page_section_update() to authenticated;

create trigger page_sections_prepare_update
before update on public.page_sections
for each row execute function public.cms_prepare_page_section_update();

alter table public.cms_global_audit_log
  drop constraint cms_global_audit_log_entity_type_check;

alter table public.cms_global_audit_log
  add constraint cms_global_audit_log_entity_type_check
  check (entity_type in ('site_settings', 'navigation_item', 'page', 'page_section'));

create or replace function public.cms_audit_global_content_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  record_key text;
  record_action text := 'updated';
  old_status text;
  new_status text;
begin
  if tg_table_name = 'site_settings' then
    record_key := new.id;
    insert into public.cms_global_audit_log (actor_user_id, entity_type, entity_key, action, before_data, after_data)
    values (auth.uid(), 'site_settings', record_key, record_action, to_jsonb(old), to_jsonb(new));
  elsif tg_table_name = 'navigation_items' then
    record_key := new.id::text;
    insert into public.cms_global_audit_log (actor_user_id, entity_type, entity_key, action, before_data, after_data)
    values (auth.uid(), 'navigation_item', record_key, record_action, to_jsonb(old), to_jsonb(new));
  elsif tg_table_name = 'pages' then
    record_key := new.id::text;
    old_status := old.status;
    new_status := new.status;
    if old_status is distinct from new_status then
      record_action := 'status_changed';
    end if;
    insert into public.cms_global_audit_log (
      actor_user_id, entity_type, entity_key, action, from_status, to_status, before_data, after_data
    )
    values (
      auth.uid(), 'page', record_key, record_action, old_status, new_status, to_jsonb(old), to_jsonb(new)
    );
  elsif tg_table_name = 'page_sections' then
    record_key := new.id::text;
    insert into public.cms_global_audit_log (actor_user_id, entity_type, entity_key, action, before_data, after_data)
    values (auth.uid(), 'page_section', record_key, record_action, to_jsonb(old), to_jsonb(new));
  end if;

  return new;
end;
$$;

revoke all on function public.cms_audit_global_content_change() from public;
grant execute on function public.cms_audit_global_content_change() to authenticated;

create trigger page_sections_global_audit
after update on public.page_sections
for each row execute function public.cms_audit_global_content_change();

insert into public.page_sections (page_id, section_key, label, sort_order, is_visible)
select id, 'home_intro', 'The work', 10, true from public.pages where slug = 'home'
on conflict (page_id, section_key) do nothing;
insert into public.page_sections (page_id, section_key, label, sort_order, is_visible)
select id, 'home_capabilities', 'Capabilities', 20, true from public.pages where slug = 'home'
on conflict (page_id, section_key) do nothing;
insert into public.page_sections (page_id, section_key, label, sort_order, is_visible)
select id, 'home_approach', 'How we work', 30, true from public.pages where slug = 'home'
on conflict (page_id, section_key) do nothing;
insert into public.page_sections (page_id, section_key, label, sort_order, is_visible)
select id, 'home_proof', 'Proof of work', 40, true from public.pages where slug = 'home'
on conflict (page_id, section_key) do nothing;
insert into public.page_sections (page_id, section_key, label, sort_order, is_visible)
select id, 'home_contact', 'The next step', 50, true from public.pages where slug = 'home'
on conflict (page_id, section_key) do nothing;

insert into public.page_sections (page_id, section_key, label, sort_order, is_visible)
select id, 'about_principles', 'Working principles', 10, true from public.pages where slug = 'about'
on conflict (page_id, section_key) do nothing;
insert into public.page_sections (page_id, section_key, label, sort_order, is_visible)
select id, 'about_people', 'The people', 20, true from public.pages where slug = 'about'
on conflict (page_id, section_key) do nothing;

insert into public.page_sections (page_id, section_key, label, sort_order, is_visible)
select id, 'services_capabilities', 'Capabilities', 10, true from public.pages where slug = 'services'
on conflict (page_id, section_key) do nothing;
insert into public.page_sections (page_id, section_key, label, sort_order, is_visible)
select id, 'work_library', 'Work library', 10, true from public.pages where slug = 'work'
on conflict (page_id, section_key) do nothing;
insert into public.page_sections (page_id, section_key, label, sort_order, is_visible)
select id, 'contact_process', 'What happens next', 10, true from public.pages where slug = 'contact'
on conflict (page_id, section_key) do nothing;
insert into public.page_sections (page_id, section_key, label, sort_order, is_visible)
select id, 'contact_form', 'Start the conversation', 20, true from public.pages where slug = 'contact'
on conflict (page_id, section_key) do nothing;

comment on table public.page_sections is
  'Staging-only approved page section registry. Rows are fixed by the application contract; owners may change visibility and order.';
