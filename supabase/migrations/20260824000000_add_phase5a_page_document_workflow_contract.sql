-- OCSCO Project Crimson — Work Package A / Batch 3A.
--
-- This migration defines the backend-only PageDocument workflow contract for
-- Home, Services, About, and Contact. Work remains legacy. The migration is
-- intentionally forward-only and must be reviewed before remote staging
-- application. It does not alter application code or production.

alter table public.pages
  add column if not exists published_revision_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'pages_published_revision_id_fkey'
      and conrelid = 'public.pages'::regclass
  ) then
    alter table public.pages
      add constraint pages_published_revision_id_fkey
      foreign key (published_revision_id)
      references public.cms_revisions(id)
      on delete restrict;
  end if;
end;
$$;

create index if not exists pages_published_revision_id_idx
  on public.pages(published_revision_id)
  where published_revision_id is not null;

create unique index if not exists pages_one_pointer_per_revision_idx
  on public.pages(published_revision_id)
  where published_revision_id is not null;

create table if not exists public.cms_workflow_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  page_id uuid not null references public.pages(id) on delete restrict,
  revision_id uuid not null references public.cms_revisions(id) on delete restrict,
  source_revision_id uuid references public.cms_revisions(id) on delete restrict,
  related_revision_id uuid references public.cms_revisions(id) on delete restrict,
  action text not null check (action in (
    'draft_saved',
    'submitted_for_review',
    'returned_to_draft',
    'publish_archived_previous',
    'published',
    'restore_archived_active',
    'restored_to_review'
  )),
  from_status text check (from_status in ('draft', 'review', 'published', 'archived')),
  to_status text not null check (to_status in ('draft', 'review', 'published', 'archived')),
  created_at timestamptz not null default now()
);

create index if not exists cms_workflow_audit_page_created_idx
  on public.cms_workflow_audit_log(page_id, created_at desc);

create index if not exists cms_workflow_audit_revision_created_idx
  on public.cms_workflow_audit_log(revision_id, created_at desc);

alter table public.cms_workflow_audit_log enable row level security;
revoke all on public.cms_workflow_audit_log from anon, authenticated;
grant select on public.cms_workflow_audit_log to authenticated;

drop policy if exists "cms members can read workflow audit history"
  on public.cms_workflow_audit_log;
create policy "cms members can read workflow audit history"
  on public.cms_workflow_audit_log
  for select
  to authenticated
  using (public.cms_has_role(array['owner', 'editor', 'reviewer']::text[]));

create or replace function public.cms_page_document_is_target(p_page_key text)
returns boolean
language sql
immutable
as $$
  select p_page_key = any (array['home', 'services', 'about', 'contact']::text[]);
$$;

revoke all on function public.cms_page_document_is_target(text) from public;

create or replace function public.cms_write_page_workflow_audit(
  p_page_id uuid,
  p_revision_id uuid,
  p_source_revision_id uuid,
  p_related_revision_id uuid,
  p_action text,
  p_from_status text,
  p_to_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.cms_workflow_audit_log (
    actor_user_id,
    page_id,
    revision_id,
    source_revision_id,
    related_revision_id,
    action,
    from_status,
    to_status
  )
  values (
    auth.uid(),
    p_page_id,
    p_revision_id,
    p_source_revision_id,
    p_related_revision_id,
    p_action,
    p_from_status,
    p_to_status
  );
end;
$$;

revoke all on function public.cms_write_page_workflow_audit(
  uuid, uuid, uuid, uuid, text, text, text
) from public;

create or replace function public.cms_assert_page_published_revision_pointer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pointer_id uuid;
  page_id uuid;
  page_slug text;
  revision public.cms_revisions%rowtype;
begin
  if tg_table_name = 'pages' then
    if new.published_revision_id is null then
      return new;
    end if;
    pointer_id := new.published_revision_id;
    page_id := new.id;
  elsif tg_table_name = 'cms_revisions' then
    if tg_op = 'DELETE' then
      if exists (
        select 1
        from public.pages
        where published_revision_id = old.id
      ) then
        raise exception 'A current Published revision cannot be deleted';
      end if;
      return old;
    end if;

    if not exists (
      select 1
      from public.pages
      where published_revision_id = new.id
    ) then
      return new;
    end if;

    pointer_id := new.id;
    select id into page_id
    from public.pages
    where published_revision_id = pointer_id;
  else
    return new;
  end if;

  select slug into page_slug
  from public.pages
  where id = page_id;

  if page_slug is null or not public.cms_page_document_is_target(page_slug) then
    raise exception 'Published revision pointers are limited to approved PageDocuments';
  end if;

  select * into revision
  from public.cms_revisions
  where id = pointer_id;

  if revision.id is null
    or revision.entity_type <> 'page'
    or revision.entity_key <> page_id::text
    or revision.status <> 'published'
  then
    raise exception 'The page Published pointer must reference a same-page Published revision';
  end if;

  return new;
end;
$$;

revoke all on function public.cms_assert_page_published_revision_pointer() from public;

drop trigger if exists pages_published_revision_integrity on public.pages;
create constraint trigger pages_published_revision_integrity
after insert or update on public.pages
deferrable initially deferred
for each row execute function public.cms_assert_page_published_revision_pointer();

drop trigger if exists cms_revisions_published_revision_integrity on public.cms_revisions;
create constraint trigger cms_revisions_published_revision_integrity
after insert or update or delete on public.cms_revisions
deferrable initially deferred
for each row execute function public.cms_assert_page_published_revision_pointer();

-- Fail-closed pointer backfill. Exactly one Published candidate is required,
-- and its complete payload must exactly match the authoritative current page
-- row. Drafts and Reviews are never changed by this block.
do $$
declare
  page_row public.pages%rowtype;
  candidate public.cms_revisions%rowtype;
  candidate_count integer;
  expected_payload jsonb;
  target_count integer;
begin
  select count(*) into target_count
  from public.pages
  where slug = any (array['home', 'services', 'about', 'contact']::text[]);

  if target_count <> 4 then
    raise exception 'PageDocument pointer backfill requires exactly four approved pages';
  end if;

  for page_row in
    select *
    from public.pages
    where slug = any (array['home', 'services', 'about', 'contact']::text[])
    order by slug
    for update
  loop
    select count(*) into candidate_count
    from public.cms_revisions
    where entity_type = 'page'
      and entity_key = page_row.id::text
      and status = 'published';

    if candidate_count <> 1 then
      raise exception 'PageDocument % requires exactly one Published revision; found %',
        page_row.slug, candidate_count;
    end if;

    select * into strict candidate
    from public.cms_revisions
    where entity_type = 'page'
      and entity_key = page_row.id::text
      and status = 'published';

    expected_payload := jsonb_build_object(
      'title', page_row.title,
      'page_purpose', page_row.page_purpose,
      'audience', page_row.audience,
      'content', page_row.content
    );

    if page_row.status <> 'published'
      or page_row.published_at is null
      or candidate.published_at is distinct from page_row.published_at
      or candidate.payload is distinct from expected_payload
      or page_row.seo_title is distinct from page_row.content->'seo'->>'title'
      or page_row.seo_description is distinct from page_row.content->'seo'->>'description'
      or page_row.og_image_path is distinct from (
        case
          when page_row.content->'seo'->'ogImageRef'->>'kind' = 'generated'
            and page_row.content->'seo'->'ogImageRef'->>'key' = 'default'
          then '/opengraph-image'
          else null
        end
      )
    then
      raise exception 'Published revision for PageDocument % does not match authoritative page content',
        page_row.slug;
    end if;

    if page_row.published_revision_id is not null
      and page_row.published_revision_id <> candidate.id
    then
      raise exception 'PageDocument % already has a different Published pointer', page_row.slug;
    end if;

    update public.pages
    set published_revision_id = candidate.id
    where id = page_row.id;
  end loop;
end;
$$;

create or replace function public.cms_page_document_save_draft(
  p_page_key text,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  page_row public.pages%rowtype;
  active_revision public.cms_revisions%rowtype;
  revision_id uuid;
  from_status text;
begin
  if not public.cms_has_role(array['owner', 'editor']::text[]) then
    raise exception 'Only owners and editors can save PageDocument Drafts';
  end if;

  if not public.cms_page_document_is_target(p_page_key) then
    raise exception 'That page is not an approved PageDocument';
  end if;

  select * into page_row
  from public.pages
  where slug = p_page_key
  for update;

  if page_row.id is null then
    raise exception 'The approved PageDocument does not exist';
  end if;

  perform public.cms_validate_phase5_page_revision_payload(
    p_page_key,
    p_payload,
    false
  );

  select * into active_revision
  from public.cms_revisions
  where entity_type = 'page'
    and entity_key = page_row.id::text
    and status in ('draft', 'review')
  for update;

  if active_revision.id is not null and active_revision.status = 'review' then
    raise exception 'Review is immutable; return it to Draft before editing';
  end if;

  if active_revision.id is null then
    insert into public.cms_revisions (
      entity_type,
      entity_key,
      status,
      payload,
      created_by
    )
    values (
      'page',
      page_row.id::text,
      'draft',
      p_payload,
      auth.uid()
    )
    returning id into revision_id;
  else
    revision_id := active_revision.id;
    from_status := active_revision.status;
    update public.cms_revisions
    set status = 'draft',
        payload = p_payload
    where id = revision_id;
  end if;

  perform public.cms_write_page_workflow_audit(
    page_row.id,
    revision_id,
    null,
    null,
    'draft_saved',
    from_status,
    'draft'
  );

  return revision_id;
end;
$$;

create or replace function public.cms_page_document_submit_for_review(
  p_page_key text,
  p_revision_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  page_row public.pages%rowtype;
  revision public.cms_revisions%rowtype;
begin
  if not public.cms_has_role(array['owner', 'editor']::text[]) then
    raise exception 'Only owners and editors can submit PageDocument Drafts';
  end if;

  if not public.cms_page_document_is_target(p_page_key) then
    raise exception 'That page is not an approved PageDocument';
  end if;

  select * into page_row
  from public.pages
  where slug = p_page_key
  for update;

  if page_row.id is null then
    raise exception 'The approved PageDocument does not exist';
  end if;

  select * into revision
  from public.cms_revisions
  where id = p_revision_id
    and entity_type = 'page'
    and entity_key = page_row.id::text
    and status = 'draft'
  for update;

  if revision.id is null then
    raise exception 'Only the active Draft can be submitted for Review';
  end if;

  perform public.cms_validate_phase5_page_revision_payload(
    p_page_key,
    revision.payload,
    false
  );

  update public.cms_revisions
  set status = 'review'
  where id = revision.id;

  perform public.cms_write_page_workflow_audit(
    page_row.id,
    revision.id,
    null,
    null,
    'submitted_for_review',
    'draft',
    'review'
  );

  return revision.id;
end;
$$;

create or replace function public.cms_page_document_return_to_draft(
  p_page_key text,
  p_revision_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  page_row public.pages%rowtype;
  revision public.cms_revisions%rowtype;
begin
  if not public.cms_has_role(array['owner', 'editor']::text[]) then
    raise exception 'Only owners and editors can return PageDocument Review to Draft';
  end if;

  if not public.cms_page_document_is_target(p_page_key) then
    raise exception 'That page is not an approved PageDocument';
  end if;

  select * into page_row
  from public.pages
  where slug = p_page_key
  for update;

  if page_row.id is null then
    raise exception 'The approved PageDocument does not exist';
  end if;

  select * into revision
  from public.cms_revisions
  where id = p_revision_id
    and entity_type = 'page'
    and entity_key = page_row.id::text
    and status = 'review'
  for update;

  if revision.id is null then
    raise exception 'Only the active Review can be returned to Draft';
  end if;

  update public.cms_revisions
  set status = 'draft'
  where id = revision.id;

  perform public.cms_write_page_workflow_audit(
    page_row.id,
    revision.id,
    null,
    null,
    'returned_to_draft',
    'review',
    'draft'
  );

  return revision.id;
end;
$$;

create or replace function public.cms_page_document_publish(
  p_page_key text,
  p_revision_id uuid,
  p_expected_updated_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  page_row public.pages%rowtype;
  revision public.cms_revisions%rowtype;
  previous_revision public.cms_revisions%rowtype;
  page_id uuid;
  entity_updated boolean;
begin
  if not public.cms_has_role(array['owner']::text[]) then
    raise exception 'Only the owner can publish PageDocuments';
  end if;

  if not public.cms_page_document_is_target(p_page_key) then
    raise exception 'That page is not an approved PageDocument';
  end if;

  select entity_key::uuid into page_id
  from public.cms_revisions
  where id = p_revision_id
    and entity_type = 'page';

  if page_id is null then
    raise exception 'The selected revision is not a PageDocument revision';
  end if;

  select * into page_row
  from public.pages
  where id = page_id
    and slug = p_page_key
  for update;

  if page_row.id is null then
    raise exception 'The selected revision does not belong to the requested PageDocument';
  end if;

  select * into revision
  from public.cms_revisions
  where id = p_revision_id
    and entity_type = 'page'
    and entity_key = page_row.id::text
  for update;

  if revision.id is null or revision.status <> 'review' then
    raise exception 'Only the active Review can be published';
  end if;

  if p_expected_updated_at is null
    or revision.updated_at is distinct from p_expected_updated_at
  then
    raise exception 'This revision changed. Reload before publishing.';
  end if;

  perform public.cms_validate_phase5_page_revision_payload(
    p_page_key,
    revision.payload,
    true
  );

  if page_row.published_revision_id is null then
    raise exception 'The current Published pointer is missing; publication aborted';
  end if;

  if page_row.published_revision_id is not null then
    select * into previous_revision
    from public.cms_revisions
    where id = page_row.published_revision_id
    for update;

    if previous_revision.id is null
      or previous_revision.entity_type <> 'page'
      or previous_revision.entity_key <> page_row.id::text
      or previous_revision.status <> 'published'
    then
      raise exception 'The current Published pointer is invalid; publication aborted';
    end if;

    update public.cms_revisions
    set status = 'archived'
    where id = previous_revision.id;
  end if;

  update public.cms_revisions
  set status = 'published',
      published_at = now()
  where id = revision.id;

  update public.pages
  set title = revision.payload->>'title',
      page_purpose = nullif(revision.payload->>'page_purpose', ''),
      audience = nullif(revision.payload->>'audience', ''),
      seo_title = revision.payload->'content'->'seo'->>'title',
      seo_description = revision.payload->'content'->'seo'->>'description',
      og_image_path = case
        when revision.payload->'content'->'seo'->'ogImageRef'->>'kind' = 'generated'
          and revision.payload->'content'->'seo'->'ogImageRef'->>'key' = 'default'
        then '/opengraph-image'
        else null
      end,
      content = revision.payload->'content',
      cta_label = null,
      cta_href = null,
      status = 'published',
      published_at = now(),
      last_reviewed_at = now(),
      published_revision_id = revision.id
  where id = page_row.id;
  entity_updated := found;

  if not entity_updated then
    raise exception 'The PageDocument could not be published';
  end if;

  if previous_revision.id is not null then
    perform public.cms_write_page_workflow_audit(
      page_row.id,
      previous_revision.id,
      null,
      revision.id,
      'publish_archived_previous',
      'published',
      'archived'
    );
  end if;

  perform public.cms_write_page_workflow_audit(
    page_row.id,
    revision.id,
    null,
    previous_revision.id,
    'published',
    'review',
    'published'
  );

  return revision.id;
end;
$$;

create or replace function public.cms_page_document_restore(
  p_page_key text,
  p_source_revision_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  page_row public.pages%rowtype;
  source_revision public.cms_revisions%rowtype;
  active_revision public.cms_revisions%rowtype;
  restore_payload jsonb;
  restored_revision_id uuid;
begin
  if not public.cms_has_role(array['owner']::text[]) then
    raise exception 'Only the owner can restore PageDocuments';
  end if;

  if not public.cms_page_document_is_target(p_page_key) then
    raise exception 'That page is not an approved PageDocument';
  end if;

  select * into page_row
  from public.pages
  where slug = p_page_key
  for update;

  if page_row.id is null then
    raise exception 'The approved PageDocument does not exist';
  end if;

  select * into source_revision
  from public.cms_revisions
  where id = p_source_revision_id
    and entity_type = 'page'
    and entity_key = page_row.id::text
    and status in ('published', 'archived')
  for update;

  if source_revision.id is null then
    raise exception 'The historical PageDocument revision cannot be restored';
  end if;

  restore_payload := source_revision.payload - 'status';
  perform public.cms_validate_phase5_page_revision_payload(
    p_page_key,
    restore_payload,
    false
  );

  select * into active_revision
  from public.cms_revisions
  where entity_type = 'page'
    and entity_key = page_row.id::text
    and status in ('draft', 'review')
  for update;

  if active_revision.id is not null then
    update public.cms_revisions
    set status = 'archived'
    where id = active_revision.id;

    perform public.cms_write_page_workflow_audit(
      page_row.id,
      active_revision.id,
      source_revision.id,
      null,
      'restore_archived_active',
      active_revision.status,
      'archived'
    );
  end if;

  insert into public.cms_revisions (
    entity_type,
    entity_key,
    status,
    payload,
    created_by,
    published_at
  )
  values (
    'page',
    page_row.id::text,
    'review',
    restore_payload,
    auth.uid(),
    null
  )
  returning id into restored_revision_id;

  perform public.cms_write_page_workflow_audit(
    page_row.id,
    restored_revision_id,
    source_revision.id,
    active_revision.id,
    'restored_to_review',
    null,
    'review'
  );

  return restored_revision_id;
end;
$$;

revoke all on function public.cms_page_document_save_draft(text, jsonb) from public;
revoke all on function public.cms_page_document_submit_for_review(text, uuid) from public;
revoke all on function public.cms_page_document_return_to_draft(text, uuid) from public;
revoke all on function public.cms_page_document_publish(text, uuid, timestamptz) from public;
revoke all on function public.cms_page_document_restore(text, uuid) from public;
grant execute on function public.cms_page_document_save_draft(text, jsonb) to authenticated;
grant execute on function public.cms_page_document_submit_for_review(text, uuid) to authenticated;
grant execute on function public.cms_page_document_return_to_draft(text, uuid) to authenticated;
grant execute on function public.cms_page_document_publish(text, uuid, timestamptz) to authenticated;
grant execute on function public.cms_page_document_restore(text, uuid) to authenticated;

-- Replace the shared save function only to preserve Batch 2 Draft-save
-- compatibility. PageDocument Review/Publish/Restore paths are dedicated;
-- all legacy entity consumers retain the previous behavior.
create or replace function public.cms_save_revision(
  p_entity_type text,
  p_entity_key text,
  p_status text,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_id uuid;
  existing_status text;
  current_payload jsonb;
  existing_payload jsonb;
  merged_payload jsonb;
  page_slug text;
  phase5_document boolean := false;
  current_content jsonb;
begin
  if not public.cms_has_role(array['owner', 'editor']::text[]) then
    raise exception 'Only owners and editors can save CMS revisions';
  end if;

  if p_status not in ('draft', 'review') then
    raise exception 'Revisions may only be saved as draft or review';
  end if;

  if jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Revision payload must be a JSON object';
  end if;

  if not public.cms_revision_entity_exists(p_entity_type, p_entity_key) then
    raise exception 'The CMS entity does not exist';
  end if;

  select id, status, payload
  into existing_id, existing_status, existing_payload
  from public.cms_revisions
  where entity_type = p_entity_type
    and entity_key = p_entity_key
    and status in ('draft', 'review')
  for update;

  if p_entity_type = 'site_settings' then
    select to_jsonb(s) into current_payload
    from public.site_settings s where s.id = p_entity_key;
  elsif p_entity_type = 'navigation_item' then
    select to_jsonb(n) into current_payload
    from public.navigation_items n where n.id = p_entity_key::uuid;
  elsif p_entity_type = 'page' then
    select to_jsonb(p), slug into current_payload, page_slug
    from public.pages p where p.id = p_entity_key::uuid;
  elsif p_entity_type = 'page_section' then
    select to_jsonb(ps) into current_payload
    from public.page_sections ps where ps.id = p_entity_key::uuid;
  elsif p_entity_type = 'service' then
    select to_jsonb(s) into current_payload
    from public.services s where s.id = p_entity_key::uuid;
  elsif p_entity_type = 'case_study' then
    select to_jsonb(c) into current_payload
    from public.case_studies c where c.id = p_entity_key::uuid;
  end if;

  if p_entity_type = 'page'
    and public.cms_page_document_is_target(page_slug)
  then
    if p_status <> 'draft' then
      raise exception 'PageDocument workflow requires the dedicated Submit for Review RPC';
    end if;
    if existing_status = 'review' then
      raise exception 'Review is immutable; use the dedicated Return to Draft RPC';
    end if;
  end if;

  if p_entity_type = 'page' then
    current_content := coalesce(existing_payload->'content', current_payload->'content');
    if jsonb_typeof(p_payload->'content') = 'object' then
      if p_payload ? 'status' then
        raise exception 'PageDocument revisions use cms_revisions.status; payload.status is not allowed';
      end if;
      perform public.cms_validate_phase5_page_revision_payload(page_slug, p_payload, false);
      phase5_document := true;
    elsif p_payload ? 'content' and jsonb_typeof(p_payload->'content') <> 'array' then
      raise exception 'Legacy page revisions require array content';
    elsif jsonb_typeof(current_content) = 'object' then
      raise exception 'A complete PageDocument is required for a PageDocument page revision';
    end if;
  end if;

  if phase5_document then
    merged_payload := jsonb_build_object(
      'title', p_payload->'title',
      'page_purpose', p_payload->'page_purpose',
      'audience', p_payload->'audience',
      'content', p_payload->'content'
    );
  else
    merged_payload := coalesce(current_payload, '{}'::jsonb);
    if existing_payload is not null then
      merged_payload := merged_payload || existing_payload;
    end if;
    merged_payload := merged_payload || p_payload;
    merged_payload := jsonb_set(merged_payload, '{status}', to_jsonb(p_status), true);
  end if;

  if existing_id is null then
    insert into public.cms_revisions (entity_type, entity_key, status, payload, created_by)
    values (p_entity_type, p_entity_key, p_status, merged_payload, auth.uid())
    returning id into existing_id;
  else
    update public.cms_revisions
    set status = p_status,
        payload = merged_payload
    where id = existing_id;
  end if;

  if p_entity_type = 'page'
    and public.cms_page_document_is_target(page_slug)
  then
    perform public.cms_write_page_workflow_audit(
      p_entity_key::uuid,
      existing_id,
      null,
      null,
      'draft_saved',
      existing_status,
      'draft'
    );
  end if;

  return existing_id;
end;
$$;

create or replace function public.cms_publish_revision(p_revision_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  revision public.cms_revisions%rowtype;
  entity_id uuid;
  entity_updated boolean;
  page_slug text;
  phase5_document boolean := false;
begin
  if not public.cms_has_role(array['owner']::text[]) then
    raise exception 'Only the owner can publish CMS revisions';
  end if;

  -- Reject the guarded PageDocument path before locking the revision. The
  -- dedicated publisher locks page then revision; keeping this rejection
  -- lock-free avoids an unnecessary opposite-order contention window.
  if exists (
    select 1
    from public.cms_revisions candidate
    join public.pages candidate_page
      on candidate_page.id::text = candidate.entity_key
    where candidate.id = p_revision_id
      and candidate.entity_type = 'page'
      and public.cms_page_document_is_target(candidate_page.slug)
  ) then
    raise exception 'PageDocument publication requires the dedicated Publish RPC';
  end if;

  select * into revision
  from public.cms_revisions
  where id = p_revision_id and status = 'review'
  for update;

  if revision.id is null then
    raise exception 'Only a review revision can be published';
  end if;

  if revision.entity_type = 'page' then
    entity_id := revision.entity_key::uuid;
    select slug into page_slug from public.pages where id = entity_id for update;
    if public.cms_page_document_is_target(page_slug) then
      raise exception 'PageDocument publication requires the dedicated Publish RPC';
    end if;
    if jsonb_typeof(revision.payload->'content') = 'object' then
      perform public.cms_validate_phase5_page_revision_payload(page_slug, revision.payload, true);
      phase5_document := true;
    elsif jsonb_typeof(revision.payload->'content') <> 'array' then
      raise exception 'Page revision content must be a legacy array or a complete PageDocument';
    end if;
  end if;

  if revision.entity_type = 'site_settings' then
    update public.site_settings
    set site_name = revision.payload->>'site_name',
        positioning_statement = nullif(revision.payload->>'positioning_statement', ''),
        default_seo_title = nullif(revision.payload->>'default_seo_title', ''),
        default_seo_description = nullif(revision.payload->>'default_seo_description', ''),
        default_og_image_path = nullif(revision.payload->>'default_og_image_path', ''),
        primary_contact_path = coalesce(nullif(revision.payload->>'primary_contact_path', ''), '/contact')
    where id = revision.entity_key;
    entity_updated := found;
  elsif revision.entity_type = 'navigation_item' then
    entity_id := revision.entity_key::uuid;
    update public.navigation_items
    set label = revision.payload->>'label',
        href = revision.payload->>'href',
        navigation_group = coalesce(revision.payload->>'navigation_group', navigation_group),
        sort_order = coalesce((revision.payload->>'sort_order')::integer, 0),
        is_visible = coalesce((revision.payload->>'is_visible')::boolean, true)
    where id = entity_id;
    entity_updated := found;
  elsif revision.entity_type = 'page_section' then
    entity_id := revision.entity_key::uuid;
    update public.page_sections
    set section_key = revision.payload->>'section_key',
        label = revision.payload->>'label',
        sort_order = coalesce((revision.payload->>'sort_order')::integer, 0),
        is_visible = coalesce((revision.payload->>'is_visible')::boolean, true)
    where id = entity_id;
    entity_updated := found;
  elsif revision.entity_type = 'service' then
    entity_id := revision.entity_key::uuid;
    update public.services
    set name = revision.payload->>'name',
        short_description = nullif(revision.payload->>'short_description', ''),
        detailed_description = nullif(revision.payload->>'detailed_description', ''),
        audience = nullif(revision.payload->>'audience', ''),
        deliverables = coalesce(revision.payload->'deliverables', '[]'::jsonb),
        process_summary = nullif(revision.payload->>'process_summary', ''),
        card_name = nullif(revision.payload->>'card_name', ''),
        outcome = nullif(revision.payload->>'outcome', ''),
        cta_label = nullif(revision.payload->>'cta_label', ''),
        cta_href = nullif(revision.payload->>'cta_href', ''),
        status = 'published',
        published_at = coalesce(published_at, now()),
        last_reviewed_at = now()
    where id = entity_id;
    entity_updated := found;
  elsif revision.entity_type = 'page' then
    update public.pages
    set title = revision.payload->>'title',
        page_purpose = nullif(revision.payload->>'page_purpose', ''),
        audience = nullif(revision.payload->>'audience', ''),
        seo_title = nullif(revision.payload->>'seo_title', ''),
        seo_description = nullif(revision.payload->>'seo_description', ''),
        og_image_path = nullif(revision.payload->>'og_image_path', ''),
        content = coalesce(revision.payload->'content', '[]'::jsonb),
        cta_label = nullif(revision.payload->>'cta_label', ''),
        cta_href = nullif(revision.payload->>'cta_href', ''),
        status = 'published',
        published_at = coalesce(published_at, now()),
        last_reviewed_at = now()
    where id = entity_id;
    entity_updated := found;
  elsif revision.entity_type = 'case_study' then
    entity_id := revision.entity_key::uuid;
    update public.case_studies
    set project_name = revision.payload->>'project_name',
        client_visibility = coalesce(revision.payload->>'client_visibility', client_visibility),
        project_type = coalesce(revision.payload->>'project_type', project_type),
        project_category = nullif(revision.payload->>'project_category', ''),
        external_url = nullif(revision.payload->>'external_url', ''),
        is_featured = coalesce((revision.payload->>'is_featured')::boolean, false),
        sort_order = coalesce((revision.payload->>'sort_order')::integer, 0),
        summary = nullif(revision.payload->>'summary', ''),
        challenge = nullif(revision.payload->>'challenge', ''),
        approach = nullif(revision.payload->>'approach', ''),
        deliverables = coalesce(revision.payload->'deliverables', '[]'::jsonb),
        outcomes = coalesce(revision.payload->'outcomes', '[]'::jsonb),
        featured_image_path = nullif(revision.payload->>'featured_image_path', ''),
        featured_image_alt = nullif(revision.payload->>'featured_image_alt', ''),
        supporting_media = coalesce(revision.payload->'supporting_media', '[]'::jsonb),
        media_status = coalesce(revision.payload->>'media_status', media_status),
        media_reviewed_at = nullif(revision.payload->>'media_reviewed_at', '')::timestamptz,
        status = 'published',
        published_at = coalesce(published_at, now()),
        last_reviewed_at = now()
    where id = entity_id;
    entity_updated := found;

    if revision.payload ? 'service_ids' then
      delete from public.case_study_services where case_study_id = entity_id;
      insert into public.case_study_services (case_study_id, service_id)
      select entity_id, value::uuid
      from jsonb_array_elements_text(revision.payload->'service_ids') as item(value)
      where exists (
        select 1 from public.services
        where services.id = value::uuid and services.status = 'published'
      );
    end if;
  else
    raise exception 'Publishing is not wired for this content type yet';
  end if;

  if entity_updated is false or entity_updated is null then
    raise exception 'The CMS entity could not be published';
  end if;

  update public.cms_revisions
  set status = 'published', published_at = now()
  where id = revision.id;

  return revision.id;
end;
$$;

create or replace function public.cms_restore_revision(p_revision_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  revision public.cms_revisions%rowtype;
  restore_payload jsonb;
  page_slug text;
begin
  if not public.cms_has_role(array['owner']::text[]) then
    raise exception 'Only the owner can restore CMS revisions';
  end if;

  select * into revision
  from public.cms_revisions
  where id = p_revision_id and status in ('published', 'archived')
  for update;

  if revision.id is null then
    raise exception 'That revision cannot be restored';
  end if;

  if revision.entity_type = 'page' then
    select slug into page_slug
    from public.pages
    where id = revision.entity_key::uuid;
    if public.cms_page_document_is_target(page_slug) then
      raise exception 'PageDocument restore requires the dedicated Restore RPC';
    end if;
  end if;

  restore_payload := revision.payload;
  if revision.entity_type = 'page' and jsonb_typeof(revision.payload->'content') = 'object' then
    perform public.cms_validate_phase5_page_revision_payload(page_slug, restore_payload - 'status', false);
    restore_payload := revision.payload - 'status';
  end if;

  return public.cms_save_revision(
    revision.entity_type,
    revision.entity_key,
    'review',
    restore_payload
  );
end;
$$;

revoke all on function public.cms_save_revision(text, text, text, jsonb) from public;
revoke all on function public.cms_publish_revision(uuid) from public;
revoke all on function public.cms_restore_revision(uuid) from public;
grant execute on function public.cms_save_revision(text, text, text, jsonb) to authenticated;
grant execute on function public.cms_publish_revision(uuid) to authenticated;
grant execute on function public.cms_restore_revision(uuid) to authenticated;

comment on column public.pages.published_revision_id is
  'Durable current-public identity for approved PageDocument pages; runtime history must use this ID.';

comment on table public.cms_workflow_audit_log is
  'Revision-aware PageDocument workflow transitions. Payloads remain in cms_revisions and are not duplicated here.';

comment on function public.cms_page_document_publish(text, uuid, timestamptz) is
  'Owner-only atomic PageDocument publication with expected-updated_at stale protection.';

comment on function public.cms_page_document_restore(text, uuid) is
  'Owner-only non-destructive PageDocument restore that archives active editorial state in place and creates a new Review.';

comment on function public.cms_save_revision(text, text, text, jsonb) is
  'Legacy generic save compatibility. Approved PageDocuments allow only Draft saves; Review transitions use dedicated RPCs.';

comment on function public.cms_publish_revision(uuid) is
  'Legacy generic publication. Approved PageDocuments must use cms_page_document_publish.';

comment on function public.cms_restore_revision(uuid) is
  'Legacy generic restore. Approved PageDocuments must use cms_page_document_restore.';
