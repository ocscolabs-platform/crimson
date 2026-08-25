-- Read-only Batch 6B1 slug-update contract verification.
-- Run after migration #28 is applied to crimson-staging.

select 'phase6b1_function' as contract_area,
       p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as object_name,
       p.prosecdef as security_definer,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'insights_update_article_slug';

select 'phase6b1_migration' as contract_area,
       count(*)::text as object_name,
       max(version)::text as status
from supabase_migrations.schema_migrations
where version in ('20260826000000', '20260826010000');

select 'phase6b1_direct_write' as contract_area,
       has_table_privilege('anon', 'public.insights_articles', 'UPDATE') as anon_update,
       has_table_privilege('authenticated', 'public.insights_articles', 'UPDATE') as authenticated_update;
