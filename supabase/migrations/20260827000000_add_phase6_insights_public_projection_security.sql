begin;

create table if not exists public.insights_public_articles (
  article_id uuid primary key references public.insights_articles(id) on delete cascade,
  slug text not null unique,
  revision_id uuid not null unique references public.insights_article_revisions(id) on delete restrict,
  title text not null default '',
  excerpt text,
  body jsonb not null default '{}'::jsonb check (jsonb_typeof(body) = 'object'),
  author_display_name text,
  category_name text,
  category_slug text,
  tags jsonb not null default '[]'::jsonb check (jsonb_typeof(tags) = 'array'),
  published_at timestamptz not null
);

comment on table public.insights_public_articles is
  'Sanitized Published-only Insights projection. Private article, revision, membership, and audit tables remain outside the public read boundary.';

alter table public.insights_public_articles enable row level security;

revoke all on public.insights_public_articles from public, anon, authenticated;
grant select on public.insights_public_articles to anon, authenticated;

drop policy if exists "Public can read Published Insights" on public.insights_public_articles;
create policy "Public can read Published Insights"
  on public.insights_public_articles for select to anon, authenticated
  using (published_at is not null);

insert into public.insights_public_articles (
  article_id, slug, revision_id, title, excerpt, body,
  author_display_name, category_name, category_slug, tags, published_at
)
select
  article.id,
  article.slug,
  revision.id,
  revision.title,
  revision.excerpt,
  revision.body,
  revision.author_display_name_snapshot,
  category.name,
  category.slug,
  coalesce((
    select jsonb_agg(jsonb_build_object('name', tag.name, 'slug', tag.slug) order by tag.name)
    from public.insights_article_revision_tags relation
    join public.insights_tags tag on tag.id = relation.tag_id
    where relation.revision_id = revision.id
  ), '[]'::jsonb),
  revision.published_at
from public.insights_articles article
join public.insights_article_revisions revision
  on revision.id = article.published_revision_id
left join public.insights_categories category
  on category.id = revision.primary_category_id
where article.status = 'published'
  and article.published_revision_id is not null
  and revision.status = 'published'
on conflict (article_id) do update set
  slug = excluded.slug,
  revision_id = excluded.revision_id,
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  author_display_name = excluded.author_display_name,
  category_name = excluded.category_name,
  category_slug = excluded.category_slug,
  tags = excluded.tags,
  published_at = excluded.published_at;

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

  insert into public.insights_public_articles (
    article_id, slug, revision_id, title, excerpt, body,
    author_display_name, category_name, category_slug, tags, published_at
  )
  select
    current_article.id,
    current_article.slug,
    current_revision.id,
    current_revision.title,
    current_revision.excerpt,
    current_revision.body,
    current_revision.author_display_name_snapshot,
    category.name,
    category.slug,
    coalesce((
      select jsonb_agg(jsonb_build_object('name', tag.name, 'slug', tag.slug) order by tag.name)
      from public.insights_article_revision_tags relation
      join public.insights_tags tag on tag.id = relation.tag_id
      where relation.revision_id = current_revision.id
    ), '[]'::jsonb),
    current_revision.published_at
  from public.insights_articles current_article
  join public.insights_article_revisions current_revision
    on current_revision.id = current_article.published_revision_id
  left join public.insights_categories category
    on category.id = current_revision.primary_category_id
  where current_article.id = article.id
    and current_revision.id = revision.id
  on conflict (article_id) do update set
    slug = excluded.slug,
    revision_id = excluded.revision_id,
    title = excluded.title,
    excerpt = excluded.excerpt,
    body = excluded.body,
    author_display_name = excluded.author_display_name,
    category_name = excluded.category_name,
    category_slug = excluded.category_slug,
    tags = excluded.tags,
    published_at = excluded.published_at;

  perform public.insights_write_audit(article.id, revision.id,
    case when previous_revision_id is null then 'published' else 'republished' end,
    article.status, 'published', jsonb_build_object('previous_revision_id', previous_revision_id));
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
  delete from public.insights_public_articles where article_id = article.id;
  perform public.insights_write_audit(article.id, previous_revision_id, 'unpublished', article.status, 'unpublished');
  return previous_revision_id;
end;
$$;

revoke all on function public.insights_publish_article(uuid, timestamptz) from public;
revoke all on function public.insights_unpublish_article(uuid, timestamptz) from public;
grant execute on function public.insights_publish_article(uuid, timestamptz) to authenticated;
grant execute on function public.insights_unpublish_article(uuid, timestamptz) to authenticated;

create or replace view public.insights_published_articles
with (security_invoker = true)
as
select
  article_id,
  slug,
  revision_id,
  title,
  excerpt,
  body,
  author_display_name,
  category_name,
  category_slug,
  tags,
  published_at
from public.insights_public_articles;

comment on view public.insights_published_articles is
  'Security-invoker Published-only public read boundary over the sanitized Insights projection.';

revoke all on public.insights_published_articles from public, anon, authenticated;
grant select on public.insights_published_articles to anon, authenticated;

commit;
