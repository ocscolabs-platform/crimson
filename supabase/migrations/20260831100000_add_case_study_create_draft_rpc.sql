-- OCSCO Project ZERO — Work Library Batch 3A.
-- Create only the initial private Case Study Draft. The existing editor,
-- revision, media, relationship, audit, and publish contracts remain intact.

create or replace function public.cms_create_case_study(p_project_name text)
returns table (id uuid, slug text)
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_name text;
  base_slug text;
  candidate_slug text;
  suffix integer := 1;
  created_case_study_id uuid;
begin
  if auth.uid() is null or not public.cms_has_role(array['owner', 'editor']::text[]) then
    raise exception 'Only owners and editors can create case study drafts';
  end if;

  clean_name := btrim(coalesce(p_project_name, ''));
  if char_length(clean_name) < 1 or char_length(clean_name) > 180 then
    raise exception 'Project name must be between 1 and 180 characters';
  end if;

  -- Keep this normalization local to the Case Study contract. A generalized
  -- slug service is unnecessary for this single creation path.
  base_slug := lower(clean_name);
  base_slug := regexp_replace(base_slug, '[^a-z0-9]+', '-', 'g');
  base_slug := regexp_replace(base_slug, '(^-+|-+$)', '', 'g');
  if base_slug = '' then
    base_slug := 'case-study';
  end if;

  -- Serialize candidates derived from the same name, including suffixes, so
  -- the existence check and insert remain deterministic under concurrency.
  perform pg_advisory_xact_lock(hashtext(base_slug));
  candidate_slug := base_slug;
  while exists (
    select 1 from public.case_studies where case_studies.slug = candidate_slug
  ) loop
    suffix := suffix + 1;
    candidate_slug := base_slug || '-' || suffix::text;
  end loop;

  -- All other values intentionally come from the table defaults: case-study,
  -- Draft, hidden visibility, empty lists/media, and non-public timestamps.
  insert into public.case_studies (project_name, slug)
  values (clean_name, candidate_slug)
  returning case_studies.id into created_case_study_id;

  return query select created_case_study_id, candidate_slug;
exception
  when unique_violation then
    -- The advisory lock covers generated candidates. Keep any unexpected
    -- uniqueness failure safe and actionable instead of exposing raw SQL.
    raise exception 'A Case Study with that project name could not be created safely. Please try again.';
end;
$$;

revoke all on function public.cms_create_case_study(text) from public;
grant execute on function public.cms_create_case_study(text) to authenticated;

comment on function public.cms_create_case_study(text) is
  'Creates one private Draft Case Study for an authenticated Owner or Editor; slug and all publication-sensitive values are server-controlled.';
