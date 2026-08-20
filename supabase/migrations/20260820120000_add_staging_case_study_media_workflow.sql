-- OCSCO Project Crimson controlled case-study media workflow.
-- Apply to crimson-staging only. This creates a private storage bucket and
-- owner-only object policies; public reads are limited to approved media for
-- published case studies. The application converts supported source images to
-- WebP before upload.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'case-study-media',
  'case-study-media',
  false,
  2097152,
  array['image/webp']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = 2097152,
    allowed_mime_types = excluded.allowed_mime_types;

-- The SQL Editor may have committed the bucket before a later statement failed.
-- Drop only these project-owned policies so this script is safe to retry.
drop policy if exists "cms members can view case study media" on storage.objects;
drop policy if exists "owners can upload case study media" on storage.objects;
drop policy if exists "owners can update case study media" on storage.objects;
drop policy if exists "owners can remove case study media" on storage.objects;
drop policy if exists "published approved case study media is public" on storage.objects;

create policy "cms members can view case study media"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'case-study-media'
    and public.cms_has_role(array['owner', 'editor', 'reviewer']::text[])
  );

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

create policy "published approved case study media is public"
  on storage.objects for select
  to anon, authenticated
  using (
    bucket_id = 'case-study-media'
    and exists (
      select 1
      from public.case_studies
      where case_studies.status = 'published'
        and case_studies.media_status = 'approved'
        and (
          case_studies.featured_image_path = storage.objects.name
          or exists (
            select 1
            from jsonb_array_elements(case_studies.supporting_media) as media_item
            where media_item->>'path' = storage.objects.name
              and coalesce(media_item->>'approval', 'pending') = 'approved'
          )
        )
    )
  );
