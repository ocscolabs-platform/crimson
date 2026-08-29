-- OCSCO Project ZERO — Scheduled Publishing v1, Batch 2C2A-1.
-- Re-apply the claim selector as a forward migration because the original
-- execution-foundation migration is already recorded in staging.

create or replace function public.insights_claim_due_scheduled_article(
  p_claim_token uuid,
  p_lease_seconds integer default 120
)
returns table (
  article_id uuid,
  revision_id uuid,
  scheduled_publish_at timestamptz,
  claim_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate record;
  expires_at timestamptz;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Scheduler execution requires the service role';
  end if;
  if p_claim_token is null then
    raise exception 'Scheduler claim token is required';
  end if;

  with due_article as (
    select article.id, article.active_revision_id, article.scheduled_publish_at
    from public.insights_articles as article
    where article.status = 'scheduled'
      and article.scheduled_publish_at is not null
      and article.scheduled_publish_at <= now()
      and (article.scheduler_claim_expires_at is null or article.scheduler_claim_expires_at <= now())
    order by article.scheduled_publish_at, article.updated_at, article.id
    for update skip locked
    limit 1
  )
  select * into candidate from due_article;

  if not found then
    return;
  end if;

  expires_at := now() + make_interval(secs => greatest(30, least(coalesce(p_lease_seconds, 120), 300)));
  update public.insights_articles
  set scheduler_claim_token = p_claim_token,
      scheduler_claim_expires_at = expires_at
  where id = candidate.id;

  return query select candidate.id, candidate.active_revision_id, candidate.scheduled_publish_at, expires_at;
end;
$$;
