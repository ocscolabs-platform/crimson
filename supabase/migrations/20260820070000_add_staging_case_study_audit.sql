-- OCSCO Project Crimson case-study audit coverage.
-- Apply in crimson-staging only after 20260820060000_add_staging_cms_audit.sql.
-- This adds history triggers; it does not add case-study write policies or an editor.

-- The original service-only audit log used a service foreign key. Audit history
-- must survive deletion and must be able to represent case studies and their
-- relationship rows, so entity_id is intentionally an unowned UUID reference.
alter table public.cms_audit_log
  drop constraint if exists cms_audit_log_entity_id_fkey;

alter table public.cms_audit_log
  drop constraint if exists cms_audit_log_entity_type_check;

alter table public.cms_audit_log
  add constraint cms_audit_log_entity_type_check
  check (entity_type in ('service', 'case_study', 'case_study_service'));

alter table public.cms_audit_log
  drop constraint if exists cms_audit_log_action_check;

alter table public.cms_audit_log
  add constraint cms_audit_log_action_check
  check (action in (
    'created',
    'updated',
    'status_changed',
    'deleted',
    'relationship_added',
    'relationship_changed',
    'relationship_removed'
  ));

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

drop trigger if exists case_studies_audit_changes on public.case_studies;

create trigger case_studies_audit_changes
after insert or update or delete on public.case_studies
for each row execute function public.cms_audit_case_study_change();

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

drop trigger if exists case_study_services_audit_changes on public.case_study_services;

create trigger case_study_services_audit_changes
after insert or update or delete on public.case_study_services
for each row execute function public.cms_audit_case_study_relationship_change();

comment on table public.cms_audit_log is
  'Staging-only immutable audit history for controlled CMS service, case-study, and relationship changes.';

comment on function public.cms_audit_case_study_change() is
  'Records immutable case-study snapshots without enabling case-study write policies.';

comment on function public.cms_audit_case_study_relationship_change() is
  'Records immutable case-study/service relationship changes without enabling relationship write policies.';
