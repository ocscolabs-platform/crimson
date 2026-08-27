-- Restore the Owner-only case-study media write boundary omitted by the
-- Production baseline reconciliation. The bucket remains private and the
-- existing published-read policy is unchanged.

drop policy if exists "owners can upload case study media" on storage.objects;
drop policy if exists "owners can update case study media" on storage.objects;
drop policy if exists "owners can remove case study media" on storage.objects;

create policy "owners can upload case study media"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'case-study-media'
    and name like 'case-studies/%'
    and public.cms_has_role(array['owner']::text[])
  );

create policy "owners can update case study media"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'case-study-media'
    and public.cms_has_role(array['owner']::text[])
  )
  with check (
    bucket_id = 'case-study-media'
    and name like 'case-studies/%'
    and public.cms_has_role(array['owner']::text[])
  );

create policy "owners can remove case study media"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'case-study-media'
    and public.cms_has_role(array['owner']::text[])
  );
