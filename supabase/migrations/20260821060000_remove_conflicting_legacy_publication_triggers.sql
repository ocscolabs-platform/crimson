-- OCSCO Project Crimson Phase 4C canonical migration correction.
--
-- The revision publisher updates already-published service and page rows with
-- the reviewed payload. These two legacy direct-edit guards reject that valid
-- revision publication shape. Remove only the conflicting triggers; their
-- underlying functions remain untouched for historical compatibility.

drop trigger if exists services_prepare_publication on public.services;
drop trigger if exists pages_prepare_global_update on public.pages;
