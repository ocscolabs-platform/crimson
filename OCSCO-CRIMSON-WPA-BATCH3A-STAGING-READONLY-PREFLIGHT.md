# OCSCO Project Crimson — WPA / Batch 3A
## Staging Read-Only Preflight Report

**Date:** 2026-08-25  
**Environment:** `crimson-staging`  
**Supabase project:** `sdfbcgctquagfcrkvoyw`  
**Scope:** Read-only preflight for the four PageDocument backfill candidates

## Result

**PASS — staging is ready for the next gated decision.**

All four target pages have exactly one Published revision whose payload, published timestamp, page status, SEO title, SEO description, and OG image reference match the current page record. The existing Homepage Draft remains present and untouched.

No migration, dry-run, write, DDL, RPC, configuration change, production action, branch merge, or deployment was performed.

## Page preflight evidence

| Page | Page ID | Page status | Draft / Review / Published / Archived | Published candidate revision | Content | Timestamp | Page state | SEO title | SEO description | OG image | Overall |
|---|---|---|---:|---|---|---|---|---|---|---|---|
| `home` | `64392cf8-84a6-4cf3-b8d6-294682971f99` | `published` | `1 / 0 / 1 / 0` | `c26b7cca-f054-4638-9fc1-8d96444d2a43` | true | true | true | true | true | true | true |
| `services` | `79769c5b-89e7-4c57-b0b1-0c3042a4d502` | `published` | `0 / 0 / 1 / 0` | `55ed5368-8161-466e-8a8d-dcc4cbf971f1` | true | true | true | true | true | true | true |
| `about` | `731b7628-bcb9-4a37-91e2-50f97c4e08b3` | `published` | `0 / 0 / 1 / 0` | `d6b1cecf-a900-4277-9bb6-212f1ceb8f69` | true | true | true | true | true | true | true |
| `contact` | `6fd0dfba-7185-45ff-b292-f74811770f69` | `published` | `0 / 0 / 1 / 0` | `a6a40e8f-8cf0-4b79-9473-e19ddaa01cda` | true | true | true | true | true | true | true |

## Homepage Draft protection check

| Check | Result |
|---|---|
| Active Draft count | `1` |
| Draft revision ID | `4d552d8b-b231-4ebd-98cc-882c10d20bfb` |
| Draft headline | `Digital infrastructure, built with precision.` |
| Draft headline match | `true` |
| Published candidate count | `1` |
| Published headline | `Digital infrastructure for brands ready to move with precision.` |
| Published headline match | `true` |

## Migration-state check

| Check | Result |
|---|---|
| `pages.published_revision_id` present | `false` |
| `cms_workflow_audit_log` present | `false` |
| Applied migration count | `25` |
| Latest applied migration | `20260823030000` |

This confirms the Batch 3A migration contract has not been applied to this staging project.

## Executed SQL

All queries below were run in the authenticated Supabase SQL Editor for `crimson-staging`. They are `SELECT`-only.

### Page and revision preflight

```sql
with target_pages as (
  select id, slug, title, page_purpose, audience, content, status, published_at,
         seo_title, seo_description, og_image_path
  from public.pages
  where slug in ('home', 'services', 'about', 'contact')
),
revision_state as (
  select
    p.id as page_id,
    count(r.id) filter (where r.status = 'draft') as draft_count,
    count(r.id) filter (where r.status = 'review') as review_count,
    count(r.id) filter (where r.status = 'published') as published_count,
    count(r.id) filter (where r.status = 'archived') as archived_count,
    max(r.id::text) filter (where r.status = 'published') as published_candidate_id,
    coalesce(bool_and(
      r.payload = jsonb_build_object(
        'title', p.title,
        'page_purpose', p.page_purpose,
        'audience', p.audience,
        'content', p.content
      )
    ) filter (where r.status = 'published'), false) as content_match,
    coalesce(bool_and(r.published_at is not distinct from p.published_at)
      filter (where r.status = 'published'), false) as published_timestamp_match
  from target_pages p
  left join public.cms_revisions r
    on r.entity_type = 'page'
   and r.entity_key = p.id::text
  group by p.id
)
select
  p.id as page_id,
  p.slug,
  p.status as page_status,
  rs.draft_count,
  rs.review_count,
  rs.published_count,
  rs.archived_count,
  rs.published_candidate_id,
  rs.content_match,
  rs.published_timestamp_match,
  (p.status = 'published' and p.published_at is not null) as page_published_state_match,
  (p.seo_title is not distinct from p.content->'seo'->>'title') as seo_title_match,
  (p.seo_description is not distinct from p.content->'seo'->>'description') as seo_description_match,
  (p.og_image_path is not distinct from case
    when p.content->'seo'->'ogImageRef'->>'kind' = 'generated'
     and p.content->'seo'->'ogImageRef'->>'key' = 'default'
    then '/opengraph-image'
    else null
  end) as og_image_match,
  (
    rs.published_count = 1
    and rs.content_match
    and rs.published_timestamp_match
    and p.status = 'published'
    and p.published_at is not null
    and p.seo_title is not distinct from p.content->'seo'->>'title'
    and p.seo_description is not distinct from p.content->'seo'->>'description'
    and p.og_image_path is not distinct from case
      when p.content->'seo'->'ogImageRef'->>'kind' = 'generated'
       and p.content->'seo'->'ogImageRef'->>'key' = 'default'
      then '/opengraph-image'
      else null
    end
  ) as overall_backfill_match
from target_pages p
join revision_state rs on rs.page_id = p.id
order by p.slug;
```

### Homepage Draft and Published headline check

```sql
with home_page as (
  select id
  from public.pages
  where slug = 'home'
),
home_state as (
  select
    r.status,
    r.id,
    r.payload->'content'->'sections'->0->'content'->>'title' as headline
  from public.cms_revisions r
  join home_page p
    on r.entity_type = 'page'
   and r.entity_key = p.id::text
)
select
  count(*) filter (where status = 'draft') as draft_count,
  max(id::text) filter (where status = 'draft') as draft_revision_id,
  coalesce(bool_and(headline = 'Digital infrastructure, built with precision.')
    filter (where status = 'draft'), false) as draft_headline_match,
  count(*) filter (where status = 'published') as published_count,
  max(id::text) filter (where status = 'published') as published_candidate_id,
  coalesce(bool_and(headline = 'Digital infrastructure for brands ready to move with precision.')
    filter (where status = 'published'), false) as published_headline_match
from home_state;
```

### Migration-state check

```sql
select
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pages'
      and column_name = 'published_revision_id'
  ) as published_revision_pointer_present,
  exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'cms_workflow_audit_log'
  ) as workflow_audit_table_present,
  (select count(*) from supabase_migrations.schema_migrations) as applied_migration_count,
  (select max(version) from supabase_migrations.schema_migrations) as latest_applied_migration;
```

## Next gate

The preflight is complete. The next action is a separate owner/ChatGPT decision on whether to authorize the transactional dry-run. No dry-run was executed as part of this report.
