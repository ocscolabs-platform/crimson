-- OCSCO Project Crimson — Phase 6 / Batch 6A Insights foundation.
--
-- This migration is additive. It creates the narrow Insights access boundary,
-- article/revision workflow foundation, taxonomy, attribution, audit history,
-- and the Published-only public projection. It does not create media buckets,
-- the editor, autosave, or public Insights routes.

alter table public.cms_members
  add column if not exists public_display_name text;

alter table public.cms_members
  drop constraint if exists cms_members_public_display_name_check;

alter table public.cms_members
  add constraint cms_members_public_display_name_check
  check (
    public_display_name is null
    or char_length(btrim(public_display_name)) between 1 and 120
  );

create table if not exists public.cms_member_access (
  user_id uuid primary key references public.cms_members(user_id) on delete cascade,
  access_scope text not null default 'full_cms'
    check (access_scope in ('full_cms', 'insights_only')),
  insights_access boolean not null default false,
  can_publish_insights boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (can_publish_insights = false or insights_access = true)
);

drop trigger if exists cms_member_access_set_updated_at on public.cms_member_access;
create trigger cms_member_access_set_updated_at
before update on public.cms_member_access
for each row execute function public.cms_set_updated_at();

alter table public.cms_member_access enable row level security;
revoke all on public.cms_member_access from anon, authenticated;
grant select on public.cms_member_access to authenticated;

drop policy if exists "members can read their own Insights access" on public.cms_member_access;
create policy "members can read their own Insights access"
  on public.cms_member_access for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.cms_has_role(array['owner']::text[])
  );

drop policy if exists "owners can manage Insights access" on public.cms_member_access;
create policy "owners can manage Insights access"
  on public.cms_member_access for all
  to authenticated
  using (public.cms_has_role(array['owner']::text[]))
  with check (public.cms_has_role(array['owner']::text[]));

create or replace function public.cms_has_full_cms_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.cms_members member
    left join public.cms_member_access access_scope
      on access_scope.user_id = member.user_id
    where member.user_id = auth.uid()
      and (
        member.role = 'owner'
        or coalesce(access_scope.access_scope, 'full_cms') = 'full_cms'
      )
  );
$$;

create or replace function public.cms_can_access_insights()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.cms_members member
    left join public.cms_member_access access_scope
      on access_scope.user_id = member.user_id
    where member.user_id = auth.uid()
      and (
        member.role = 'owner'
        or coalesce(access_scope.access_scope, 'full_cms') = 'full_cms'
        or (
          coalesce(access_scope.access_scope, 'full_cms') = 'insights_only'
          and coalesce(access_scope.insights_access, false)
        )
      )
  );
$$;

create or replace function public.cms_can_edit_insights()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.cms_members member
    left join public.cms_member_access access_scope
      on access_scope.user_id = member.user_id
    where member.user_id = auth.uid()
      and member.role in ('owner', 'editor')
      and (
        member.role = 'owner'
        or coalesce(access_scope.access_scope, 'full_cms') = 'full_cms'
        or (
          coalesce(access_scope.access_scope, 'full_cms') = 'insights_only'
          and coalesce(access_scope.insights_access, false)
        )
      )
  );
$$;

create or replace function public.cms_can_submit_insights()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.cms_can_edit_insights();
$$;

create or replace function public.cms_can_publish_insights()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.cms_members member
    left join public.cms_member_access access_scope
      on access_scope.user_id = member.user_id
    where member.user_id = auth.uid()
      and (
        member.role = 'owner'
        or (
          member.role = 'editor'
          and coalesce(access_scope.can_publish_insights, false)
          and (
            coalesce(access_scope.access_scope, 'full_cms') = 'full_cms'
            or (
              access_scope.access_scope = 'insights_only'
              and coalesce(access_scope.insights_access, false)
            )
          )
        )
      )
  );
$$;

create or replace function public.cms_can_unpublish_insights()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.cms_current_role() = 'owner';
$$;

create or replace function public.cms_can_restore_insights()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.cms_current_role() = 'owner';
$$;

create or replace function public.cms_can_access_crimson_area(p_area text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.cms_current_role() = 'owner'
    or public.cms_has_full_cms_access()
    or (
      lower(p_area) = 'insights'
      and public.cms_can_access_insights()
    );
$$;

-- Existing cms_has_role callers are the Phase 4/5 full-CMS boundary. Keeping
-- this helper full-CMS-only prevents an Insights-only member from inheriting
-- legacy Pages, Services, Work, Global Content, or Team permissions.
create or replace function public.cms_has_role(allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.cms_has_full_cms_access()
    and coalesce(public.cms_current_role() = any(allowed_roles), false);
$$;

revoke all on function public.cms_has_full_cms_access() from public;
revoke all on function public.cms_can_access_insights() from public;
revoke all on function public.cms_can_edit_insights() from public;
revoke all on function public.cms_can_submit_insights() from public;
revoke all on function public.cms_can_publish_insights() from public;
revoke all on function public.cms_can_unpublish_insights() from public;
revoke all on function public.cms_can_restore_insights() from public;
revoke all on function public.cms_can_access_crimson_area(text) from public;
revoke all on function public.cms_has_role(text[]) from public;
grant execute on function public.cms_has_full_cms_access() to authenticated;
grant execute on function public.cms_can_access_insights() to authenticated;
grant execute on function public.cms_can_edit_insights() to authenticated;
grant execute on function public.cms_can_submit_insights() to authenticated;
grant execute on function public.cms_can_publish_insights() to authenticated;
grant execute on function public.cms_can_unpublish_insights() to authenticated;
grant execute on function public.cms_can_restore_insights() to authenticated;
grant execute on function public.cms_can_access_crimson_area(text) to authenticated;
grant execute on function public.cms_has_role(text[]) to authenticated;

create table if not exists public.insights_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.insights_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists insights_categories_set_updated_at on public.insights_categories;
create trigger insights_categories_set_updated_at
before update on public.insights_categories
for each row execute function public.cms_set_updated_at();

drop trigger if exists insights_tags_set_updated_at on public.insights_tags;
create trigger insights_tags_set_updated_at
before update on public.insights_tags
for each row execute function public.cms_set_updated_at();

create table if not exists public.insights_articles (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  status text not null default 'draft'
    check (status in ('draft', 'review', 'published', 'unpublished')),
  active_revision_id uuid,
  published_revision_id uuid,
  last_published_revision_id uuid,
  submitted_at timestamptz,
  published_at timestamptz,
  unpublished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.insights_article_revisions (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.insights_articles(id) on delete cascade,
  revision_number integer not null check (revision_number > 0),
  status text not null check (status in ('draft', 'review', 'published', 'archived')),
  title text not null default '',
  excerpt text,
  body jsonb not null default '{}'::jsonb check (jsonb_typeof(body) = 'object'),
  primary_category_id uuid references public.insights_categories(id) on delete restrict,
  author_display_name_snapshot text,
  created_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (article_id, revision_number)
);

alter table public.insights_articles
  add constraint insights_articles_active_revision_fk
  foreign key (active_revision_id)
  references public.insights_article_revisions(id)
  on delete restrict;

alter table public.insights_articles
  add constraint insights_articles_published_revision_fk
  foreign key (published_revision_id)
  references public.insights_article_revisions(id)
  on delete restrict;

alter table public.insights_articles
  add constraint insights_articles_last_published_revision_fk
  foreign key (last_published_revision_id)
  references public.insights_article_revisions(id)
  on delete restrict;

create unique index if not exists insights_articles_one_working_revision_idx
  on public.insights_article_revisions(article_id)
  where status in ('draft', 'review');

create unique index if not exists insights_articles_one_published_revision_idx
  on public.insights_article_revisions(article_id)
  where status = 'published';

create index if not exists insights_articles_review_queue_idx
  on public.insights_articles(status, submitted_at, created_at)
  where status = 'review';

create table if not exists public.insights_article_revision_tags (
  revision_id uuid not null references public.insights_article_revisions(id) on delete cascade,
  tag_id uuid not null references public.insights_tags(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (revision_id, tag_id)
);

create table if not exists public.insights_workflow_audit_log (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.insights_articles(id) on delete cascade,
  revision_id uuid references public.insights_article_revisions(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (action in (
    'created', 'submitted', 'withdrawn_to_draft', 'returned_to_draft',
    'published', 'unpublished', 'restored', 'republished'
  )),
  from_status text,
  to_status text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists insights_workflow_audit_article_idx
  on public.insights_workflow_audit_log(article_id, created_at desc);

create or replace function public.insights_articles_author_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.author_id is distinct from old.author_id then
    raise exception 'Insight article ownership is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists insights_articles_author_immutable on public.insights_articles;
create trigger insights_articles_author_immutable
before update on public.insights_articles
for each row execute function public.insights_articles_author_immutable();

create or replace function public.insights_revision_immutable_when_published()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'published' and (
    new.article_id is distinct from old.article_id
    or new.revision_number is distinct from old.revision_number
    or new.title is distinct from old.title
    or new.excerpt is distinct from old.excerpt
    or new.body is distinct from old.body
    or new.primary_category_id is distinct from old.primary_category_id
    or new.author_display_name_snapshot is distinct from old.author_display_name_snapshot
    or new.created_by is distinct from old.created_by
  ) then
    raise exception 'Published Insight revisions are immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists insights_revision_immutable_when_published on public.insights_article_revisions;
create trigger insights_revision_immutable_when_published
before update on public.insights_article_revisions
for each row execute function public.insights_revision_immutable_when_published();

alter table public.insights_categories enable row level security;
alter table public.insights_tags enable row level security;
alter table public.insights_articles enable row level security;
alter table public.insights_article_revisions enable row level security;
alter table public.insights_article_revision_tags enable row level security;
alter table public.insights_workflow_audit_log enable row level security;

revoke all on public.insights_categories from anon, authenticated;
revoke all on public.insights_tags from anon, authenticated;
revoke all on public.insights_articles from anon, authenticated;
revoke all on public.insights_article_revisions from anon, authenticated;
revoke all on public.insights_article_revision_tags from anon, authenticated;
revoke all on public.insights_workflow_audit_log from anon, authenticated;
grant select on public.insights_categories, public.insights_tags to authenticated;
grant select on public.insights_articles, public.insights_article_revisions,
  public.insights_article_revision_tags, public.insights_workflow_audit_log to authenticated;

drop policy if exists "Insights members can read categories" on public.insights_categories;
create policy "Insights members can read categories"
  on public.insights_categories for select to authenticated
  using (public.cms_can_access_insights());

drop policy if exists "Owners can manage categories" on public.insights_categories;
create policy "Owners can manage categories"
  on public.insights_categories for all to authenticated
  using (public.cms_current_role() = 'owner')
  with check (public.cms_current_role() = 'owner');

drop policy if exists "Insights members can read tags" on public.insights_tags;
create policy "Insights members can read tags"
  on public.insights_tags for select to authenticated
  using (public.cms_can_access_insights());

drop policy if exists "Owners can manage tags" on public.insights_tags;
create policy "Owners can manage tags"
  on public.insights_tags for all to authenticated
  using (public.cms_current_role() = 'owner')
  with check (public.cms_current_role() = 'owner');

drop policy if exists "Insights members can read articles" on public.insights_articles;
create policy "Insights members can read articles"
  on public.insights_articles for select to authenticated
  using (
    public.cms_can_access_insights()
    and (
      public.cms_has_full_cms_access()
      or author_id = auth.uid()
    )
  );

drop policy if exists "Insights members can read revisions" on public.insights_article_revisions;
create policy "Insights members can read revisions"
  on public.insights_article_revisions for select to authenticated
  using (
    public.cms_can_access_insights()
    and exists (
      select 1 from public.insights_articles article
      where article.id = article_id
        and (public.cms_has_full_cms_access() or article.author_id = auth.uid())
    )
  );

drop policy if exists "Insights members can read revision tags" on public.insights_article_revision_tags;
create policy "Insights members can read revision tags"
  on public.insights_article_revision_tags for select to authenticated
  using (
    public.cms_can_access_insights()
    and exists (
      select 1
      from public.insights_article_revisions revision
      join public.insights_articles article on article.id = revision.article_id
      where revision.id = revision_id
        and (public.cms_has_full_cms_access() or article.author_id = auth.uid())
    )
  );

drop policy if exists "Insights members can read workflow audit" on public.insights_workflow_audit_log;
create policy "Insights members can read workflow audit"
  on public.insights_workflow_audit_log for select to authenticated
  using (
    public.cms_can_access_insights()
    and exists (
      select 1 from public.insights_articles article
      where article.id = article_id
        and (public.cms_has_full_cms_access() or article.author_id = auth.uid())
    )
  );

create or replace function public.insights_write_audit(
  p_article_id uuid,
  p_revision_id uuid,
  p_action text,
  p_from_status text,
  p_to_status text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.insights_workflow_audit_log (
    article_id, revision_id, actor_id, action, from_status, to_status, metadata
  ) values (
    p_article_id, p_revision_id, auth.uid(), p_action, p_from_status, p_to_status,
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.insights_write_audit(uuid, uuid, text, text, text, jsonb) from public;

create or replace function public.insights_create_article(
  p_slug text,
  p_title text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  article_id uuid;
  revision_id uuid;
begin
  if not public.cms_can_edit_insights() then
    raise exception 'This member cannot create Insights articles';
  end if;
  if p_slug is null or p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Article slug must use lowercase letters, numbers, and hyphens';
  end if;

  insert into public.insights_articles (author_id, slug)
  values (auth.uid(), p_slug)
  returning id into article_id;

  insert into public.insights_article_revisions (
    article_id, revision_number, status, title, created_by
  ) values (
    article_id, 1, 'draft', coalesce(p_title, ''), auth.uid()
  ) returning id into revision_id;

  update public.insights_articles
  set active_revision_id = revision_id
  where id = article_id;

  perform public.insights_write_audit(article_id, revision_id, 'created', null, 'draft');
  return article_id;
end;
$$;

create or replace function public.insights_save_draft(
  p_article_id uuid,
  p_expected_updated_at timestamptz,
  p_title text,
  p_excerpt text,
  p_body jsonb,
  p_primary_category_id uuid,
  p_tag_ids uuid[] default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  article public.insights_articles%rowtype;
  revision public.insights_article_revisions%rowtype;
  next_revision integer;
begin
  if not public.cms_can_edit_insights() then
    raise exception 'This member cannot edit Insights articles';
  end if;
  if jsonb_typeof(p_body) <> 'object' then
    raise exception 'Insight body must be a JSON object';
  end if;

  select * into article
  from public.insights_articles
  where id = p_article_id
  for update;
  if article.id is null then raise exception 'The Insight article does not exist'; end if;
  if not public.cms_has_full_cms_access() and article.author_id <> auth.uid() then
    raise exception 'Editors may only edit their own Insight articles';
  end if;
  if p_expected_updated_at is not null and article.updated_at <> p_expected_updated_at then
    raise exception 'The Insight changed. Reload before saving the Draft.';
  end if;
  if article.status = 'review' then
    raise exception 'Review is immutable; withdraw it before saving a Draft';
  end if;

  if article.active_revision_id is not null then
    select * into revision
    from public.insights_article_revisions
    where id = article.active_revision_id
    for update;
  end if;

  if revision.id is null or revision.status not in ('draft') then
    select coalesce(max(revision_number), 0) + 1 into next_revision
    from public.insights_article_revisions
    where article_id = article.id;
    insert into public.insights_article_revisions (
      article_id, revision_number, status, created_by
    ) values (article.id, next_revision, 'draft', auth.uid())
    returning * into revision;
  end if;

  update public.insights_article_revisions
  set status = 'draft', title = coalesce(p_title, ''), excerpt = p_excerpt,
      body = p_body, primary_category_id = p_primary_category_id,
      updated_at = now()
  where id = revision.id;

  if p_tag_ids is not null then
    delete from public.insights_article_revision_tags where revision_id = revision.id;
    insert into public.insights_article_revision_tags (revision_id, tag_id)
    select revision.id, tag_id
    from unnest(p_tag_ids) as tag_id
    where exists (select 1 from public.insights_tags tag where tag.id = tag_id);
  end if;

  update public.insights_articles
  set active_revision_id = revision.id, status = 'draft', updated_at = now()
  where id = article.id;
  return revision.id;
end;
$$;

create or replace function public.insights_submit_for_review(
  p_article_id uuid,
  p_expected_updated_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  article public.insights_articles%rowtype;
  revision public.insights_article_revisions%rowtype;
begin
  if not public.cms_can_submit_insights() then
    raise exception 'This member cannot submit Insights articles';
  end if;

  select * into article from public.insights_articles where id = p_article_id for update;
  if article.id is null then raise exception 'The Insight article does not exist'; end if;
  if not public.cms_has_full_cms_access() and article.author_id <> auth.uid() then
    raise exception 'Editors may only submit their own Insight articles';
  end if;
  if p_expected_updated_at is not null and article.updated_at <> p_expected_updated_at then
    raise exception 'The Insight changed. Reload before submitting';
  end if;
  if article.status <> 'draft' then raise exception 'Only a Draft can be submitted'; end if;

  select * into revision from public.insights_article_revisions
  where id = article.active_revision_id for update;
  if revision.id is null or revision.status <> 'draft' then
    raise exception 'The active Draft revision is missing';
  end if;
  if char_length(btrim(revision.title)) = 0 then raise exception 'A title is required before Submit'; end if;
  if revision.primary_category_id is null then raise exception 'A primary Category is required before Submit'; end if;
  if not exists (
    select 1 from public.insights_categories category
    where category.id = revision.primary_category_id and category.is_active
  ) then raise exception 'The primary Category is not active'; end if;

  update public.insights_article_revisions set status = 'review', updated_at = now()
  where id = revision.id;
  update public.insights_articles
  set status = 'review', submitted_at = now(), updated_at = now()
  where id = article.id;
  perform public.insights_write_audit(article.id, revision.id, 'submitted', 'draft', 'review');
  return revision.id;
end;
$$;

create or replace function public.insights_withdraw_review(
  p_article_id uuid,
  p_expected_updated_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  article public.insights_articles%rowtype;
  revision public.insights_article_revisions%rowtype;
begin
  if not public.cms_can_edit_insights() then raise exception 'This member cannot withdraw an Insight'; end if;
  select * into article from public.insights_articles where id = p_article_id for update;
  if article.id is null then raise exception 'The Insight article does not exist'; end if;
  if not public.cms_has_full_cms_access() and article.author_id <> auth.uid() then
    raise exception 'Editors may only withdraw their own Insight articles';
  end if;
  if p_expected_updated_at is not null and article.updated_at <> p_expected_updated_at then
    raise exception 'The Insight changed. Reload before withdrawing';
  end if;
  if article.status <> 'review' then raise exception 'Only an active Review can be withdrawn'; end if;
  select * into revision from public.insights_article_revisions where id = article.active_revision_id for update;
  if revision.id is null or revision.status <> 'review' then raise exception 'The active Review revision is missing'; end if;

  update public.insights_article_revisions set status = 'draft', updated_at = now() where id = revision.id;
  update public.insights_articles set status = 'draft', updated_at = now() where id = article.id;
  perform public.insights_write_audit(article.id, revision.id, 'withdrawn_to_draft', 'review', 'draft');
  return revision.id;
end;
$$;

create or replace function public.insights_publish_article(
  p_article_id uuid,
  p_expected_updated_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  article public.insights_articles%rowtype;
  revision public.insights_article_revisions%rowtype;
  previous_revision_id uuid;
  display_name text;
begin
  if not public.cms_can_publish_insights() then raise exception 'This member cannot publish Insights'; end if;
  select * into article from public.insights_articles where id = p_article_id for update;
  if article.id is null then raise exception 'The Insight article does not exist'; end if;
  if public.cms_current_role() <> 'owner' and article.author_id <> auth.uid() then
    raise exception 'Trusted Publishers may only publish their own Insight articles';
  end if;
  if public.cms_current_role() <> 'owner' and article.status <> 'draft' then
    raise exception 'Trusted Publishers may only publish their own Draft';
  end if;
  if public.cms_current_role() = 'owner' and article.status not in ('draft', 'review') then
    raise exception 'Only a Draft or Review can be published';
  end if;
  if p_expected_updated_at is not null and article.updated_at <> p_expected_updated_at then
    raise exception 'The Insight changed. Reload before publishing';
  end if;

  select * into revision from public.insights_article_revisions where id = article.active_revision_id for update;
  if revision.id is null or revision.status not in ('draft', 'review') then raise exception 'The active revision cannot be published'; end if;
  if char_length(btrim(revision.title)) = 0 then raise exception 'A title is required before Publish'; end if;
  if revision.primary_category_id is null then raise exception 'A primary Category is required before Publish'; end if;
  if not exists (select 1 from public.insights_categories category where category.id = revision.primary_category_id and category.is_active) then
    raise exception 'The primary Category is not active';
  end if;

  select nullif(btrim(public_display_name), '') into display_name from public.cms_members where user_id = article.author_id;
  previous_revision_id := article.published_revision_id;
  if previous_revision_id is not null and previous_revision_id <> revision.id then
    update public.insights_article_revisions set status = 'archived', updated_at = now()
    where id = previous_revision_id and status = 'published';
  end if;
  update public.insights_article_revisions
  set status = 'published', published_at = now(),
      author_display_name_snapshot = coalesce(display_name, 'OCSCO Team'), updated_at = now()
  where id = revision.id;
  update public.insights_articles
  set status = 'published', active_revision_id = revision.id,
      published_revision_id = revision.id, last_published_revision_id = revision.id,
      published_at = now(), unpublished_at = null, updated_at = now()
  where id = article.id;
  perform public.insights_write_audit(article.id, revision.id,
    case when previous_revision_id is null then 'published' else 'republished' end,
    article.status, 'published', jsonb_build_object('previous_revision_id', previous_revision_id));
  return revision.id;
end;
$$;

create or replace function public.insights_return_to_draft(
  p_article_id uuid,
  p_expected_updated_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  article public.insights_articles%rowtype;
  revision public.insights_article_revisions%rowtype;
begin
  if public.cms_current_role() <> 'owner' then raise exception 'Only the owner can return an Insight to Draft'; end if;
  select * into article from public.insights_articles where id = p_article_id for update;
  if article.id is null then raise exception 'The Insight article does not exist'; end if;
  if p_expected_updated_at is not null and article.updated_at <> p_expected_updated_at then raise exception 'The Insight changed. Reload before returning'; end if;
  if article.status <> 'review' then raise exception 'Only an active Review can be returned to Draft'; end if;
  select * into revision from public.insights_article_revisions where id = article.active_revision_id for update;
  if revision.id is null or revision.status <> 'review' then raise exception 'The active Review revision is missing'; end if;
  update public.insights_article_revisions set status = 'draft', updated_at = now() where id = revision.id;
  update public.insights_articles set status = 'draft', updated_at = now() where id = article.id;
  perform public.insights_write_audit(article.id, revision.id, 'returned_to_draft', 'review', 'draft');
  return revision.id;
end;
$$;

create or replace function public.insights_unpublish_article(
  p_article_id uuid,
  p_expected_updated_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  article public.insights_articles%rowtype;
  previous_revision_id uuid;
begin
  if not public.cms_can_unpublish_insights() then raise exception 'Only the owner can unpublish Insights'; end if;
  select * into article from public.insights_articles where id = p_article_id for update;
  if article.id is null then raise exception 'The Insight article does not exist'; end if;
  if p_expected_updated_at is not null and article.updated_at <> p_expected_updated_at then raise exception 'The Insight changed. Reload before unpublishing'; end if;
  if article.published_revision_id is null then raise exception 'The Insight is not currently published'; end if;
  previous_revision_id := article.published_revision_id;
  update public.insights_article_revisions
  set status = 'archived', updated_at = now()
  where id = previous_revision_id and status = 'published';
  update public.insights_articles
  set status = 'unpublished', published_revision_id = null, unpublished_at = now(), updated_at = now()
  where id = article.id;
  perform public.insights_write_audit(article.id, previous_revision_id, 'unpublished', article.status, 'unpublished');
  return previous_revision_id;
end;
$$;

create or replace function public.insights_restore_revision(
  p_article_id uuid,
  p_source_revision_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  article public.insights_articles%rowtype;
  source_revision public.insights_article_revisions%rowtype;
  active_revision public.insights_article_revisions%rowtype;
  restored_id uuid;
  next_revision integer;
begin
  if not public.cms_can_restore_insights() then raise exception 'Only the owner can restore Insights'; end if;
  select * into article from public.insights_articles where id = p_article_id for update;
  if article.id is null then raise exception 'The Insight article does not exist'; end if;
  select * into source_revision from public.insights_article_revisions
  where id = p_source_revision_id and article_id = article.id and status in ('published', 'archived') for update;
  if source_revision.id is null then raise exception 'That historical Insight revision cannot be restored'; end if;
  if article.active_revision_id is not null then
    select * into active_revision from public.insights_article_revisions where id = article.active_revision_id for update;
    if active_revision.status in ('draft', 'review') then
      update public.insights_article_revisions set status = 'archived', updated_at = now() where id = active_revision.id;
    end if;
  end if;
  select coalesce(max(revision_number), 0) + 1 into next_revision from public.insights_article_revisions where article_id = article.id;
  insert into public.insights_article_revisions (
    article_id, revision_number, status, title, excerpt, body, primary_category_id, created_by
  ) values (
    article.id, next_revision, 'draft', source_revision.title, source_revision.excerpt,
    source_revision.body, source_revision.primary_category_id, auth.uid()
  ) returning id into restored_id;
  insert into public.insights_article_revision_tags (revision_id, tag_id)
  select restored_id, tag_id from public.insights_article_revision_tags where revision_id = source_revision.id;
  update public.insights_articles set active_revision_id = restored_id, status = 'draft', updated_at = now() where id = article.id;
  perform public.insights_write_audit(article.id, restored_id, 'restored', article.status, 'draft', jsonb_build_object('source_revision_id', source_revision.id));
  return restored_id;
end;
$$;

revoke all on function public.insights_create_article(text, text) from public;
revoke all on function public.insights_save_draft(uuid, timestamptz, text, text, jsonb, uuid, uuid[]) from public;
revoke all on function public.insights_submit_for_review(uuid, timestamptz) from public;
revoke all on function public.insights_withdraw_review(uuid, timestamptz) from public;
revoke all on function public.insights_publish_article(uuid, timestamptz) from public;
revoke all on function public.insights_return_to_draft(uuid, timestamptz) from public;
revoke all on function public.insights_unpublish_article(uuid, timestamptz) from public;
revoke all on function public.insights_restore_revision(uuid, uuid) from public;
grant execute on function public.insights_create_article(text, text) to authenticated;
grant execute on function public.insights_save_draft(uuid, timestamptz, text, text, jsonb, uuid, uuid[]) to authenticated;
grant execute on function public.insights_submit_for_review(uuid, timestamptz) to authenticated;
grant execute on function public.insights_withdraw_review(uuid, timestamptz) to authenticated;
grant execute on function public.insights_publish_article(uuid, timestamptz) to authenticated;
grant execute on function public.insights_return_to_draft(uuid, timestamptz) to authenticated;
grant execute on function public.insights_unpublish_article(uuid, timestamptz) to authenticated;
grant execute on function public.insights_restore_revision(uuid, uuid) to authenticated;

create or replace view public.insights_published_articles as
select
  article.id as article_id,
  article.slug,
  revision.id as revision_id,
  revision.title,
  revision.excerpt,
  revision.body,
  revision.author_display_name_snapshot as author_display_name,
  category.name as category_name,
  category.slug as category_slug,
  coalesce((
    select jsonb_agg(jsonb_build_object('name', tag.name, 'slug', tag.slug) order by tag.name)
    from public.insights_article_revision_tags relation
    join public.insights_tags tag on tag.id = relation.tag_id
    where relation.revision_id = revision.id
  ), '[]'::jsonb) as tags,
  revision.published_at
from public.insights_articles article
join public.insights_article_revisions revision
  on revision.id = article.published_revision_id
left join public.insights_categories category
  on category.id = revision.primary_category_id
where article.published_revision_id is not null
  and revision.status = 'published';

revoke all on public.insights_published_articles from public;
grant select on public.insights_published_articles to anon, authenticated;

comment on table public.cms_member_access is
  'Narrow per-member access boundary. Missing rows preserve full-CMS compatibility; owner is always full authority.';
comment on column public.cms_member_access.can_publish_insights is
  'Narrow Trusted Publisher capability. It never grants broad Crimson administration and is ownership-checked by the publish RPC.';
comment on table public.insights_articles is
  'Stable Insights article identity and workflow pointer. Author ownership is immutable and derived by the create RPC.';
comment on table public.insights_article_revisions is
  'Article-specific immutable publication history with private Draft/Review workflow revisions.';
comment on view public.insights_published_articles is
  'Safe public projection. It exposes only the current Published revision and never exposes Draft, Review, history, audit, or membership data.';
