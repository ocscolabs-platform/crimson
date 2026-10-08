-- Restore the canonical CMS-member read policy for private case-study media.
-- Staging already has this policy, so the migration is intentionally a no-op
-- there. No storage objects, application rows, grants, or other policies are
-- changed.

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'cms members can view case study media'
  ) then
    execute $policy$
      create policy "cms members can view case study media"
        on storage.objects for select
        to authenticated
        using (
          bucket_id = 'case-study-media'
          and public.cms_has_role(array['owner', 'editor', 'reviewer']::text[])
        )
    $policy$;
  end if;
end
$$;
