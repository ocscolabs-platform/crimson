-- OCSCO Project ZERO — Production legacy baseline reconciliation.
-- Restore only the nine deterministic CMS functions absent from the
-- pre-pending Production catalog. No tables, data, triggers, or workflows are
-- changed by this migration.
-- Definitions are copied from the latest approved repository migrations.

begin;

-- Source: supabase/migrations/20260820070000_add_staging_case_study_audit.sql
create or replace function public.cms_audit_case_study_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.cms_audit_log (
      actor_user_id, entity_type, entity_id, action, from_status, to_status,
      before_data, after_data
    )
    values (
      auth.uid(), 'case_study', new.id, 'created', null, new.status,
      null, to_jsonb(new)
    );
    return new;
  end if;

  if tg_op = 'DELETE' then
    insert into public.cms_audit_log (
      actor_user_id, entity_type, entity_id, action, from_status, to_status,
      before_data, after_data
    )
    values (
      auth.uid(), 'case_study', old.id, 'deleted', old.status, null,
      to_jsonb(old), null
    );
    return old;
  end if;

  insert into public.cms_audit_log (
    actor_user_id, entity_type, entity_id, action, from_status, to_status,
    before_data, after_data
  )
  values (
    auth.uid(),
    'case_study',
    new.id,
    case when old.status is distinct from new.status then 'status_changed' else 'updated' end,
    old.status,
    new.status,
    to_jsonb(old),
    to_jsonb(new)
  );

  return new;
end;
$$;
revoke all on function public.cms_audit_case_study_change() from public;
grant execute on function public.cms_audit_case_study_change() to authenticated;

-- Source: supabase/migrations/20260820070000_add_staging_case_study_audit.sql
create or replace function public.cms_audit_case_study_relationship_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.cms_audit_log (
      actor_user_id, entity_type, entity_id, action, before_data, after_data
    )
    values (
      auth.uid(), 'case_study_service', new.case_study_id, 'relationship_added',
      null, to_jsonb(new)
    );
    return new;
  end if;

  if tg_op = 'DELETE' then
    insert into public.cms_audit_log (
      actor_user_id, entity_type, entity_id, action, before_data, after_data
    )
    values (
      auth.uid(), 'case_study_service', old.case_study_id, 'relationship_removed',
      to_jsonb(old), null
    );
    return old;
  end if;

  insert into public.cms_audit_log (
    actor_user_id, entity_type, entity_id, action, before_data, after_data
  )
  values (
    auth.uid(), 'case_study_service', new.case_study_id, 'relationship_changed',
    to_jsonb(old), to_jsonb(new)
  );

  return new;
end;
$$;
revoke all on function public.cms_audit_case_study_relationship_change() from public;
grant execute on function public.cms_audit_case_study_relationship_change() to authenticated;

-- Source: supabase/migrations/20260820110000_add_staging_page_sections.sql
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

-- Source: supabase/migrations/20260820060000_add_staging_cms_audit.sql
create or replace function public.cms_audit_service_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.cms_audit_log (
      actor_user_id, entity_type, entity_id, action, from_status, to_status,
      before_data, after_data
    )
    values (
      auth.uid(), 'service', new.id, 'created', null, new.status,
      null, to_jsonb(new)
    );
  else
    insert into public.cms_audit_log (
      actor_user_id, entity_type, entity_id, action, from_status, to_status,
      before_data, after_data
    )
    values (
      auth.uid(),
      'service',
      new.id,
      case when old.status is distinct from new.status then 'status_changed' else 'updated' end,
      old.status,
      new.status,
      to_jsonb(old),
      to_jsonb(new)
    );
  end if;

  return new;
end;
$$;
revoke all on function public.cms_audit_service_change() from public;
grant execute on function public.cms_audit_service_change() to authenticated;

-- Source: supabase/migrations/20260820100000_add_staging_global_content_editor.sql
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

-- Source: supabase/migrations/20260820110000_add_staging_page_sections.sql
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

-- Source: supabase/migrations/20260820060000_add_staging_cms_audit.sql
create or replace function public.cms_prepare_service_publication()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('published', 'archived')
    and not public.cms_has_role(array['owner']::text[])
  then
    raise exception 'Only an owner can publish or archive service records';
  end if;

  if tg_op = 'UPDATE' then
    if new.status = 'published' and old.status not in ('review', 'published') then
      raise exception 'Move the service to review before publishing it';
    end if;

    if old.status = 'published'
      and new.status = 'published'
      and (
        old.name is distinct from new.name
        or old.slug is distinct from new.slug
        or old.short_description is distinct from new.short_description
        or old.detailed_description is distinct from new.detailed_description
        or old.audience is distinct from new.audience
        or old.deliverables is distinct from new.deliverables
        or old.process_summary is distinct from new.process_summary
        or old.cta_label is distinct from new.cta_label
        or old.cta_href is distinct from new.cta_href
      )
    then
      raise exception 'Move the service to review before changing published content';
    end if;
  end if;

  if new.status = 'published' then
    new.published_at = coalesce(new.published_at, now());
    if tg_op = 'INSERT' then
      new.last_reviewed_at = now();
    elsif old.status <> 'published' then
      new.last_reviewed_at = now();
    end if;
  else
    new.published_at = null;
  end if;

  return new;
end;
$$;
revoke all on function public.cms_prepare_service_publication() from public;
grant execute on function public.cms_prepare_service_publication() to authenticated;

-- Source: supabase/migrations/20260820130000_add_staging_case_study_relationship_editor.sql
create or replace function public.cms_replace_case_study_services(
  p_case_study_id uuid,
  p_service_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.cms_has_role(array['owner', 'editor']::text[]) then
    raise exception 'Only owners and editors can change case study relationships';
  end if;

  if not exists (
    select 1
    from public.case_studies
    where id = p_case_study_id
      and status in ('draft', 'review')
  ) then
    raise exception 'Move the case study to Review before changing relationships';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_service_ids, '{}'::uuid[])) as requested(service_id)
    left join public.services on services.id = requested.service_id
    where services.id is null
      or services.status <> 'published'
      or services.published_at is null
      or services.published_at > now()
  ) then
    raise exception 'Only currently published services can be linked';
  end if;

  delete from public.case_study_services
  where case_study_id = p_case_study_id;

  insert into public.case_study_services (case_study_id, service_id)
  select p_case_study_id, requested.service_id
  from unnest(coalesce(p_service_ids, '{}'::uuid[])) as requested(service_id)
  on conflict do nothing;
end;
$$;
revoke all on function public.cms_replace_case_study_services(uuid, uuid[]) from public;
grant execute on function public.cms_replace_case_study_services(uuid, uuid[]) to authenticated;

-- Source: supabase/migrations/20260820080000_add_staging_case_study_media_contract.sql
create or replace function public.cms_validate_case_study_media()
returns trigger
language plpgsql
as $$
declare
  item jsonb;
  item_path text;
  item_alt text;
  item_type text;
  item_approval text;
begin
  if new.featured_image_path is not null then
    if new.featured_image_path !~ ('^case-studies/' || new.slug || '/[^/]+\.(avif|webp|jpe?g|png)$') then
      raise exception 'featured_image_path must be a relative case-studies path with an approved image extension';
    end if;

    if char_length(btrim(coalesce(new.featured_image_alt, ''))) < 8 then
      raise exception 'featured_image_alt must contain meaningful alternative text when a featured image is configured';
    end if;
  elsif nullif(btrim(coalesce(new.featured_image_alt, '')), '') is not null then
    raise exception 'featured_image_alt requires featured_image_path';
  end if;

  if jsonb_typeof(new.supporting_media) <> 'array' then
    raise exception 'supporting_media must be a JSON array';
  end if;

  for item in select value from jsonb_array_elements(new.supporting_media)
  loop
    if jsonb_typeof(item) <> 'object' then
      raise exception 'supporting_media entries must be JSON objects';
    end if;

    item_path := item->>'path';
    item_alt := item->>'alt';
    item_type := coalesce(item->>'media_type', 'image');
    item_approval := coalesce(item->>'approval', 'pending');

    if item_path is null or item_path !~ ('^case-studies/' || new.slug || '/[^/]+\.(avif|webp|jpe?g|png)$') then
      raise exception 'supporting_media paths must stay under the case-study storage path and use an approved image extension';
    end if;

    if char_length(btrim(coalesce(item_alt, ''))) < 8 then
      raise exception 'supporting_media entries require meaningful alt text';
    end if;

    if item_type <> 'image' then
      raise exception 'supporting_media currently supports image entries only';
    end if;

    if item_approval not in ('pending', 'approved') then
      raise exception 'supporting_media approval must be pending or approved';
    end if;
  end loop;

  if new.media_status = 'approved' and new.featured_image_path is null then
    raise exception 'approved media requires a configured featured image';
  end if;

  if new.media_status = 'approved' and exists (
    select 1
    from jsonb_array_elements(new.supporting_media) as media_item
    where coalesce(media_item->>'approval', 'pending') <> 'approved'
  ) then
    raise exception 'approved media requires every supporting item to be approved';
  end if;

  return new;
end;
$$;

commit;
