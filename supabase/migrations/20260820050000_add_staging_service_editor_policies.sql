-- OCSCO Project Crimson first controlled CMS editor policy.
-- Apply in crimson-staging only after the CMS membership migration.
-- This enables service editing for owner/editor roles; pages and case studies
-- remain read-only until their workflows receive a separate review.

grant insert, update on public.services to authenticated;

create policy "cms members can review service records"
  on public.services for select
  to authenticated
  using (
    public.cms_has_role(array['owner', 'editor', 'reviewer']::text[])
    and (
      status <> 'archived'
      or public.cms_has_role(array['owner']::text[])
    )
  );

create policy "owners and editors can create service records"
  on public.services for insert
  to authenticated
  with check (
    public.cms_has_role(array['owner', 'editor']::text[])
    and (
      public.cms_current_role() = 'owner'
      or status in ('draft', 'review')
    )
  );

create policy "owners can update any service record"
  on public.services for update
  to authenticated
  using (public.cms_has_role(array['owner']::text[]))
  with check (public.cms_has_role(array['owner']::text[]));

create policy "editors can update draft or review services"
  on public.services for update
  to authenticated
  using (
    public.cms_has_role(array['editor']::text[])
    and status in ('draft', 'review')
  )
  with check (status in ('draft', 'review'));

comment on table public.services is
  'Service content. The first staging editor allows owner writes and editor draft/review writes; publishing is owner-only.';
