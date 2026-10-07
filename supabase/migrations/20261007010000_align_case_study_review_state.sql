-- OCSCO Project ZERO — Work CMS Update v1 Task 1 blocker repair.
-- Keep the existing publication trigger authoritative by aligning only
-- non-public Case Study base rows with their legitimate Draft/Review revision.

create or replace function public.cms_save_case_study_revision(
  p_case_study_id uuid,
  p_status text,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  base_status text;
  revision_id uuid;
begin
  if auth.uid() is null or not public.cms_has_role(array['owner', 'editor']::text[]) then
    raise exception 'Only owners and editors can save Case Study revisions';
  end if;

  if p_status not in ('draft', 'review') then
    raise exception 'Case Study revisions may only be saved as Draft or Review';
  end if;

  select status into base_status
  from public.case_studies
  where id = p_case_study_id
  for update;

  if base_status is null then
    raise exception 'The Case Study does not exist';
  end if;

  revision_id := public.cms_save_revision(
    'case_study',
    p_case_study_id::text,
    p_status,
    p_payload
  );

  -- A never-published base row represents the current private workflow state.
  -- A Published base row remains Published while a private Draft/Review is
  -- prepared, preserving the existing public-content isolation contract.
  if base_status in ('draft', 'review') and base_status <> p_status then
    update public.case_studies
    set status = p_status
    where id = p_case_study_id
      and status = base_status;

    if not found then
      raise exception 'The Case Study workflow state changed while saving';
    end if;
  end if;

  return revision_id;
end;
$$;

revoke all on function public.cms_save_case_study_revision(uuid, text, jsonb) from public;
grant execute on function public.cms_save_case_study_revision(uuid, text, jsonb) to authenticated;

comment on function public.cms_save_case_study_revision(uuid, text, jsonb) is
  'Saves a private Case Study revision and aligns only a non-public Draft/Review base row; Published base content remains public until Owner publication.';
