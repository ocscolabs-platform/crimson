-- Read-only release parity contract.
-- Run in each Supabase project and compare the result sets. This script never
-- changes schema, data, permissions, Storage, or Auth configuration.

select 'tables' as contract_area, table_name as object_name, 'present' as status
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'site_settings', 'navigation_items', 'pages', 'page_sections', 'services',
    'case_studies', 'case_study_services', 'cms_members', 'cms_audit_log',
    'cms_global_audit_log', 'cms_revisions', 'inquiries'
  )
order by object_name;

select 'functions' as contract_area,
       p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as object_name,
       'present' as status
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'cms_set_updated_at', 'cms_current_role', 'cms_has_role',
    'cms_prepare_service_publication', 'cms_audit_service_change',
    'cms_validate_case_study_media', 'cms_audit_case_study_change',
    'cms_audit_case_study_relationship_change',
    'cms_prepare_case_study_publication', 'cms_prepare_global_content_update',
    'cms_audit_global_content_change', 'cms_prepare_page_section_update',
    'cms_revision_entity_exists', 'cms_save_revision', 'cms_publish_revision',
    'cms_restore_revision', 'cms_replace_case_study_services'
  )
order by object_name;

select 'triggers' as contract_area,
       event_object_table || '.' || trigger_name as object_name,
       'present' as status
from information_schema.triggers
where trigger_schema = 'public'
  and (
    trigger_name like 'cms_%'
    or trigger_name like '%_set_updated_at'
    or trigger_name like '%_prepare_%'
    or trigger_name like '%_audit_%'
    or trigger_name like '%_validate_%'
  )
order by object_name;

select 'rls_policies' as contract_area,
       tablename || '.' || policyname as object_name,
       cmd as status
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

select 'grants' as contract_area,
       table_name || '.' || grantee || '.' || privilege_type as object_name,
       'present' as status
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'site_settings', 'navigation_items', 'pages', 'page_sections', 'services',
    'case_studies', 'case_study_services', 'cms_members', 'cms_audit_log',
    'cms_global_audit_log', 'cms_revisions', 'inquiries'
  )
order by object_name;

select 'storage_bucket' as contract_area,
       id as object_name,
       case when public then 'public' else 'private' end as status
from storage.buckets
where id = 'case-study-media';

select 'storage_policy' as contract_area,
       policyname as object_name,
       cmd as status
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
order by policyname;
