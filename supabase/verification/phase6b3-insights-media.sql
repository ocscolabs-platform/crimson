-- Read-only staging verification for Phase 6 / Batch 6B3.
-- Run through the approved staging verification path after migration #30 is applied.

select version, name
from supabase_migrations.schema_migrations
order by version desc
limit 3;

select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id in ('insights-private-media', 'insights-published-media')
order by id;

select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('insights_media_assets', 'insights_revision_media', 'insights_public_articles')
order by c.relname;

select schemaname, tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('insights_media_assets', 'insights_revision_media', 'insights_public_articles')
order by tablename, policyname;

select routine_name, routine_type, security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'insights_register_media', 'insights_remove_media', 'insights_update_media_alt',
    'insights_submit_for_review', 'insights_publish_article', 'insights_unpublish_article',
    'insights_restore_revision'
  )
order by routine_name;

select count(*) as canonical_media_assets from public.insights_media_assets;
select count(*) as revision_media_relations from public.insights_revision_media;
select count(*) as published_projection_rows from public.insights_public_articles;
