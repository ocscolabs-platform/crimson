-- OCSCO Project Crimson case-study media contract and featured-project guard.
-- Apply to crimson-staging only during the Phase 4 design gate. This does not
-- create a storage bucket, upload policy, or CMS write policy.

alter table public.case_studies
  add column if not exists featured_image_alt text,
  add column if not exists media_status text not null default 'pending',
  add column if not exists media_reviewed_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'case_studies_media_status_check'
  ) then
    alter table public.case_studies
      add constraint case_studies_media_status_check
      check (media_status in ('pending', 'approved', 'rejected'));
  end if;
end $$;

create or replace function public.cms_validate_case_study_media()
returns trigger
language plpgsql
as $$
declare
  item jsonb;
  item_path text;
  item_alt text;
  item_type text;
  item_approval text;
begin
  if new.featured_image_path is not null then
    if new.featured_image_path !~ ('^case-studies/' || new.slug || '/[^/]+\.(avif|webp|jpe?g|png)$') then
      raise exception 'featured_image_path must be a relative case-studies path with an approved image extension';
    end if;

    if char_length(btrim(coalesce(new.featured_image_alt, ''))) < 8 then
      raise exception 'featured_image_alt must contain meaningful alternative text when a featured image is configured';
    end if;
  elsif nullif(btrim(coalesce(new.featured_image_alt, '')), '') is not null then
    raise exception 'featured_image_alt requires featured_image_path';
  end if;

  if jsonb_typeof(new.supporting_media) <> 'array' then
    raise exception 'supporting_media must be a JSON array';
  end if;

  for item in select value from jsonb_array_elements(new.supporting_media)
  loop
    if jsonb_typeof(item) <> 'object' then
      raise exception 'supporting_media entries must be JSON objects';
    end if;

    item_path := item->>'path';
    item_alt := item->>'alt';
    item_type := coalesce(item->>'media_type', 'image');
    item_approval := coalesce(item->>'approval', 'pending');

    if item_path is null or item_path !~ ('^case-studies/' || new.slug || '/[^/]+\.(avif|webp|jpe?g|png)$') then
      raise exception 'supporting_media paths must stay under the case-study storage path and use an approved image extension';
    end if;

    if char_length(btrim(coalesce(item_alt, ''))) < 8 then
      raise exception 'supporting_media entries require meaningful alt text';
    end if;

    if item_type <> 'image' then
      raise exception 'supporting_media currently supports image entries only';
    end if;

    if item_approval not in ('pending', 'approved') then
      raise exception 'supporting_media approval must be pending or approved';
    end if;
  end loop;

  if new.media_status = 'approved' and new.featured_image_path is null then
    raise exception 'approved media requires a configured featured image';
  end if;

  if new.media_status = 'approved' and exists (
    select 1
    from jsonb_array_elements(new.supporting_media) as media_item
    where coalesce(media_item->>'approval', 'pending') <> 'approved'
  ) then
    raise exception 'approved media requires every supporting item to be approved';
  end if;

  return new;
end;
$$;

drop trigger if exists case_studies_validate_media on public.case_studies;

create trigger case_studies_validate_media
before insert or update on public.case_studies
for each row
execute function public.cms_validate_case_study_media();

create unique index if not exists case_studies_one_published_featured_idx
  on public.case_studies (is_featured)
  where is_featured = true and status = 'published';

create index if not exists case_studies_media_review_idx
  on public.case_studies(media_status, last_reviewed_at desc);
