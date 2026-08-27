-- Read-only Batch 6A contract verification.
-- Run after the migration is applied to crimson-staging. This script does not
-- insert, update, delete, change grants, or mutate Supabase state.

do $$
declare
  required_table text;
  required_tables text[] := array[
    'cms_member_access', 'insights_categories', 'insights_tags',
    'insights_articles', 'insights_article_revisions',
    'insights_article_revision_tags', 'insights_workflow_audit_log'
  ];
begin
  foreach required_table in array required_tables loop
    if not exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = required_table
    ) then
      raise exception 'Missing Batch 6A table: %', required_table;
    end if;
  end loop;
end;
$$;

select 'phase6a_function' as contract_area,
       p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as object_name,
       'present' as status
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'cms_can_access_insights', 'cms_can_edit_insights',
    'cms_can_submit_insights', 'cms_can_publish_insights',
    'cms_can_unpublish_insights', 'cms_can_restore_insights',
    'cms_can_access_crimson_area', 'insights_create_article',
    'insights_save_draft', 'insights_submit_for_review',
    'insights_withdraw_review', 'insights_publish_article',
    'insights_return_to_draft', 'insights_unpublish_article',
    'insights_restore_revision'
  )
order by object_name;

select 'phase6a_policy' as contract_area,
       tablename || '.' || policyname as object_name,
       cmd as status
from pg_policies
where schemaname = 'public'
  and (
    tablename like 'insights_%'
    or tablename = 'cms_member_access'
  )
order by tablename, policyname;

select 'phase6a_public_projection' as contract_area,
       table_name as object_name,
       'present' as status
from information_schema.views
where table_schema = 'public'
  and table_name = 'insights_published_articles';

select 'phase6a_migration_baseline' as contract_area,
       count(*)::text as object_name,
       max(version)::text as status
from supabase_migrations.schema_migrations
where version = '20260826000000';
