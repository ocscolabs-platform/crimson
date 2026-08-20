-- OCSCO Project Crimson controlled global-content editor.
-- Apply in crimson-staging only after the CMS membership migration.
-- This migration enables update-only settings, navigation, and page metadata
-- editing. It intentionally does not add inserts, deletes, media uploads, or
-- freeform page-section editing.

create table public.cms_global_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  entity_type text not null check (entity_type in ('site_settings', 'navigation_item', 'page')),
  entity_key text not null,
  action text not null check (action in ('updated', 'status_changed')),
  from_status text check (from_status in ('draft', 'review', 'published', 'archived')),
  to_status text check (to_status in ('draft', 'review', 'published', 'archived')),
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index cms_global_audit_entity_created_idx
  on public.cms_global_audit_log(entity_type, entity_key, created_at desc);

alter table public.cms_global_audit_log enable row level security;

revoke all on public.cms_global_audit_log from anon, authenticated;
grant select on public.cms_global_audit_log to authenticated;

create policy "cms members can read global content audit history"
  on public.cms_global_audit_log for select
  to authenticated
  using (public.cms_has_role(array['owner', 'editor', 'reviewer']::text[]));

grant update on public.site_settings to authenticated;
grant update on public.navigation_items to authenticated;
grant update on public.pages to authenticated;

create policy "cms members can read all navigation items"
  on public.navigation_items for select
  to authenticated
  using (public.cms_has_role(array['owner', 'editor', 'reviewer']::text[]));

create policy "cms members can read all pages"
  on public.pages for select
  to authenticated
  using (public.cms_has_role(array['owner', 'editor', 'reviewer']::text[]));

create policy "owners and editors can update site settings"
  on public.site_settings for update
  to authenticated
  using (public.cms_has_role(array['owner', 'editor']::text[]))
  with check (id = 'default');

create policy "owners and editors can update navigation items"
  on public.navigation_items for update
  to authenticated
  using (public.cms_has_role(array['owner', 'editor']::text[]))
  with check (
    navigation_group in ('primary', 'footer')
    and char_length(btrim(label)) between 1 and 80
    and char_length(btrim(href)) between 1 and 240
  );

create policy "owners can update any page metadata"
  on public.pages for update
  to authenticated
  using (public.cms_has_role(array['owner']::text[]))
  with check (public.cms_has_role(array['owner']::text[]));

create policy "editors can update draft or review page metadata"
  on public.pages for update
  to authenticated
  using (
    public.cms_has_role(array['editor']::text[])
    and status in ('draft', 'review')
  )
  with check (status in ('draft', 'review'));

create or replace function public.cms_prepare_global_content_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'navigation_items'
    and public.cms_current_role() <> 'owner'
    and (
      old.is_visible is distinct from new.is_visible
      or old.navigation_group is distinct from new.navigation_group
    )
  then
    raise exception 'Only an owner can change navigation visibility or group';
  end if;

  if tg_table_name = 'pages' then
    if new.status in ('published', 'archived')
      and not public.cms_has_role(array['owner']::text[])
    then
      raise exception 'Only an owner can publish or archive pages';
    end if;

    if new.status = 'published' and old.status not in ('review', 'published') then
      raise exception 'Move the page to review before publishing it';
    end if;

    if old.status = 'published'
      and new.status = 'published'
      and (
        old.title is distinct from new.title
        or old.slug is distinct from new.slug
        or old.page_purpose is distinct from new.page_purpose
        or old.audience is distinct from new.audience
        or old.seo_title is distinct from new.seo_title
        or old.seo_description is distinct from new.seo_description
        or old.og_image_path is distinct from new.og_image_path
        or old.content is distinct from new.content
        or old.cta_label is distinct from new.cta_label
        or old.cta_href is distinct from new.cta_href
      )
    then
      raise exception 'Move the page to review before changing published content';
    end if;

    if new.status = 'published' then
      new.published_at = coalesce(new.published_at, now());
      if old.status <> 'published' then
        new.last_reviewed_at = now();
      end if;
    else
      new.published_at = null;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.cms_prepare_global_content_update() from public;
grant execute on function public.cms_prepare_global_content_update() to authenticated;

create trigger navigation_items_prepare_global_update
before update on public.navigation_items
for each row execute function public.cms_prepare_global_content_update();

create trigger pages_prepare_global_update
before update on public.pages
for each row execute function public.cms_prepare_global_content_update();

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
  end if;

  return new;
end;
$$;

revoke all on function public.cms_audit_global_content_change() from public;
grant execute on function public.cms_audit_global_content_change() to authenticated;

create trigger site_settings_global_audit
after update on public.site_settings
for each row execute function public.cms_audit_global_content_change();

create trigger navigation_items_global_audit
after update on public.navigation_items
for each row execute function public.cms_audit_global_content_change();

create trigger pages_global_audit
after update on public.pages
for each row execute function public.cms_audit_global_content_change();

comment on table public.cms_global_audit_log is
  'Staging-only immutable audit history for controlled global content changes.';

comment on function public.cms_prepare_global_content_update() is
  'Owners control public navigation visibility and page publication. Published pages must move through review before edits.';
