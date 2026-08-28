-- Allow the existing Owner-only Category policy to perform safe deletes.

begin;

grant delete on public.insights_categories to authenticated;

commit;
