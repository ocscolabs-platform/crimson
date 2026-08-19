-- OCSCO Project Crimson CMS audit and publication safeguards.
-- Apply in crimson-staging only after the CMS membership and service editor migrations.

create table public.cms_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  entity_type text not null check (entity_type in ('service')),
  entity_id uuid not null references public.services(id) on delete cascade,
  action text not null check (action in ('created', 'updated', 'status_changed')),
  from_status text check (from_status in ('draft', 'review', 'published', 'archived')),
  to_status text check (to_status in ('draft', 'review', 'published', 'archived')),
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index cms_audit_log_entity_created_idx
  on public.cms_audit_log(entity_type, entity_id, created_at desc);

alter table public.cms_audit_log enable row level security;

revoke all on public.cms_audit_log from anon, authenticated;
grant select on public.cms_audit_log to authenticated;

create policy "cms members can read service audit history"
  on public.cms_audit_log for select
  to authenticated
  using (
    public.cms_has_role(array['owner', 'editor', 'reviewer']::text[])
  );

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

create trigger services_prepare_publication
before insert or update on public.services
for each row execute function public.cms_prepare_service_publication();

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

create trigger services_audit_changes
after insert or update on public.services
for each row execute function public.cms_audit_service_change();

comment on table public.cms_audit_log is
  'Staging-only immutable audit history for controlled CMS service changes.';

comment on function public.cms_prepare_service_publication() is
  'Owners publish/archive services. Published content must move through review before edits or publication.';
