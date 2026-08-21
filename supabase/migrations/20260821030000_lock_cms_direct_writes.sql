-- OCSCO Project Crimson: close the legacy direct-write path.
--
-- Apply this only after 20260821020000_add_cms_revisions.sql and after the
-- revision-based editor has been deployed to the target environment. The
-- publish RPC runs as a definer and remains able to update the base tables;
-- authenticated CMS users can no longer bypass the revision boundary.

revoke insert, update, delete on public.site_settings from authenticated;
revoke insert, update, delete on public.navigation_items from authenticated;
revoke insert, update, delete on public.pages from authenticated;
revoke insert, update, delete on public.page_sections from authenticated;
revoke insert, update, delete on public.services from authenticated;
revoke insert, update, delete on public.case_studies from authenticated;
revoke insert, update, delete on public.case_study_services from authenticated;

-- Relationship changes now travel inside cms_save_revision and
-- cms_publish_revision. Keep the old function unavailable so a stale client
-- cannot write relationships directly.
do $$
begin
  if to_regprocedure('public.cms_replace_case_study_services(uuid, uuid[])') is not null then
    revoke all on function public.cms_replace_case_study_services(uuid, uuid[]) from public;
  end if;
end;
$$;

comment on table public.cms_revisions is
  'Canonical CMS revision ledger. Draft and review edits are private; only an owner publish RPC changes public content.';
