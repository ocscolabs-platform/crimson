-- Make only Published Insights delivery public. Draft media remains private.

begin;

update storage.buckets
set public = true,
    updated_at = now()
where id = 'insights-published-media'
  and public is distinct from true;

commit;
