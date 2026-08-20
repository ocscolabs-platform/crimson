-- OCSCO Project Crimson controlled case-study/service relationship editor.
-- Apply in crimson-staging only after the existing case-study audit, editor,
-- and media workflow migrations. This enables atomic relationship updates for
-- owners/editors on draft or review case studies only.

create policy "cms members can review published services"
  on public.services for select
  to authenticated
  using (
    public.cms_has_role(array['owner', 'editor', 'reviewer']::text[])
    and status = 'published'
    and published_at is not null
    and published_at <= now()
  );

create policy "cms members can review case study relationships"
  on public.case_study_services for select
  to authenticated
  using (
    public.cms_has_role(array['owner', 'editor', 'reviewer']::text[])
    and exists (
      select 1
      from public.case_studies
      where case_studies.id = case_study_services.case_study_id
        and (
          case_studies.status <> 'archived'
          or public.cms_has_role(array['owner']::text[])
        )
    )
  );

grant insert, delete on public.case_study_services to authenticated;

create policy "owners and editors can add case study relationships"
  on public.case_study_services for insert
  to authenticated
  with check (
    public.cms_has_role(array['owner', 'editor']::text[])
    and exists (
      select 1
      from public.case_studies
      where case_studies.id = case_study_services.case_study_id
        and case_studies.status in ('draft', 'review')
    )
    and exists (
      select 1
      from public.services
      where services.id = case_study_services.service_id
        and services.status = 'published'
        and services.published_at is not null
        and services.published_at <= now()
    )
  );

create policy "owners and editors can remove case study relationships"
  on public.case_study_services for delete
  to authenticated
  using (
    public.cms_has_role(array['owner', 'editor']::text[])
    and exists (
      select 1
      from public.case_studies
      where case_studies.id = case_study_services.case_study_id
        and case_studies.status in ('draft', 'review')
    )
  );

create or replace function public.cms_replace_case_study_services(
  p_case_study_id uuid,
  p_service_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.cms_has_role(array['owner', 'editor']::text[]) then
    raise exception 'Only owners and editors can change case study relationships';
  end if;

  if not exists (
    select 1
    from public.case_studies
    where id = p_case_study_id
      and status in ('draft', 'review')
  ) then
    raise exception 'Move the case study to Review before changing relationships';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_service_ids, '{}'::uuid[])) as requested(service_id)
    left join public.services on services.id = requested.service_id
    where services.id is null
      or services.status <> 'published'
      or services.published_at is null
      or services.published_at > now()
  ) then
    raise exception 'Only currently published services can be linked';
  end if;

  delete from public.case_study_services
  where case_study_id = p_case_study_id;

  insert into public.case_study_services (case_study_id, service_id)
  select p_case_study_id, requested.service_id
  from unnest(coalesce(p_service_ids, '{}'::uuid[])) as requested(service_id)
  on conflict do nothing;
end;
$$;

revoke all on function public.cms_replace_case_study_services(uuid, uuid[]) from public;
grant execute on function public.cms_replace_case_study_services(uuid, uuid[]) to authenticated;

comment on function public.cms_replace_case_study_services(uuid, uuid[]) is
  'Atomically replaces staging case-study/service relationships for owners and editors on draft or review records.';
