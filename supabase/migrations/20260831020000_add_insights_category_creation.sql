-- Restore the smallest Owner Category creation capability required by the
-- Production Insights workflow. Existing RLS still restricts writes to Owner.
grant insert on public.insights_categories to authenticated;
