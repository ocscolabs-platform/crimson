-- OCSCO Project Crimson: restore authenticated CMS read access.
--
-- Some environments already had the CMS tables but not the complete
-- authenticated read grants/policies. The revision boundary must not make
-- the editor blind to the published base records. This migration grants read
-- access only to authenticated CMS members; it does not restore any write
-- privilege.

grant select on public.site_settings,
  public.navigation_items,
  public.pages,
  public.page_sections,
  public.services,
  public.case_studies,
  public.case_study_services to authenticated;

drop policy if exists "cms members can read all site settings" on public.site_settings;
create policy "cms members can read all site settings"
  on public.site_settings for select
  to authenticated
  using (public.cms_has_role(array['owner', 'editor', 'reviewer']::text[]));

drop policy if exists "cms members can read all navigation items" on public.navigation_items;
create policy "cms members can read all navigation items"
  on public.navigation_items for select
  to authenticated
  using (public.cms_has_role(array['owner', 'editor', 'reviewer']::text[]));

drop policy if exists "cms members can read all pages" on public.pages;
create policy "cms members can read all pages"
  on public.pages for select
  to authenticated
  using (public.cms_has_role(array['owner', 'editor', 'reviewer']::text[]));

drop policy if exists "cms members can read all page sections" on public.page_sections;
create policy "cms members can read all page sections"
  on public.page_sections for select
  to authenticated
  using (public.cms_has_role(array['owner', 'editor', 'reviewer']::text[]));

drop policy if exists "cms members can read all services" on public.services;
create policy "cms members can read all services"
  on public.services for select
  to authenticated
  using (
    public.cms_has_role(array['owner', 'editor', 'reviewer']::text[])
    and (status <> 'archived' or public.cms_has_role(array['owner']::text[]))
  );

drop policy if exists "cms members can read all case studies" on public.case_studies;
create policy "cms members can read all case studies"
  on public.case_studies for select
  to authenticated
  using (
    public.cms_has_role(array['owner', 'editor', 'reviewer']::text[])
    and (status <> 'archived' or public.cms_has_role(array['owner']::text[]))
  );

drop policy if exists "cms members can read case study relationships" on public.case_study_services;
create policy "cms members can read case study relationships"
  on public.case_study_services for select
  to authenticated
  using (public.cms_has_role(array['owner', 'editor', 'reviewer']::text[]));
