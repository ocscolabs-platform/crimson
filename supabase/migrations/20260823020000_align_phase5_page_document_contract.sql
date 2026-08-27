-- Align the deployed Phase 5 validator with the approved PageDocument contract.
-- This is validation-only: it does not change rows, revisions, page_sections,
-- authorization, publication behavior, or legacy Work content.

create or replace function public.cms_phase5_validate_section_content(
  p_section_key text,
  p_value jsonb,
  p_path text
)
returns void
language plpgsql
immutable
as $$
declare
  item jsonb;
  item_index integer := 0;
  cta jsonb;
begin
  if jsonb_typeof(p_value) <> 'object' then
    raise exception '% must be an object', p_path;
  end if;

  case p_section_key
    when 'home_hero' then
      perform public.cms_phase5_require_exact_keys(p_value, array['eyebrow', 'title', 'intro', 'ctas'], p_path);
      perform public.cms_phase5_require_string(p_value->'eyebrow', p_path || '.eyebrow', 80);
      perform public.cms_phase5_require_string(p_value->'title', p_path || '.title', 180);
      perform public.cms_phase5_require_string(p_value->'intro', p_path || '.intro', 2000);
      if jsonb_typeof(p_value->'ctas') <> 'array' then
        raise exception '%.ctas must be an array', p_path;
      end if;
      if jsonb_array_length(p_value->'ctas') > 2 then
        raise exception '%.ctas must contain at most two CTAs', p_path;
      end if;
      for cta in select value from jsonb_array_elements(p_value->'ctas')
      loop
        perform public.cms_phase5_validate_cta(cta, format('%s.ctas[%s]', p_path, item_index));
        item_index := item_index + 1;
      end loop;

    when 'home_intro', 'home_proof' then
      perform public.cms_phase5_require_exact_keys(p_value, array['eyebrow', 'heading', 'body'], p_path);
      perform public.cms_phase5_require_string(p_value->'eyebrow', p_path || '.eyebrow', 80);
      perform public.cms_phase5_require_string(p_value->'heading', p_path || '.heading', 180);
      perform public.cms_phase5_require_string(p_value->'body', p_path || '.body', 2000);

    when 'home_capabilities' then
      perform public.cms_phase5_require_exact_keys(p_value, array['eyebrow', 'heading', 'note', 'items'], p_path);
      perform public.cms_phase5_require_string(p_value->'eyebrow', p_path || '.eyebrow', 80);
      perform public.cms_phase5_require_string(p_value->'heading', p_path || '.heading', 180);
      perform public.cms_phase5_require_string(p_value->'note', p_path || '.note', 2000);
      if jsonb_typeof(p_value->'items') <> 'array' then
        raise exception '%.items must be an array', p_path;
      end if;
      if jsonb_array_length(p_value->'items') <> 5 then
        raise exception '%.items must contain exactly five items', p_path;
      end if;
      for item in select value from jsonb_array_elements(p_value->'items')
      loop
        perform public.cms_phase5_require_exact_keys(item, array['service', 'ctaLabel'], format('%s.items[%s]', p_path, item_index));
        perform public.cms_phase5_validate_service_reference(item->'service', format('%s.items[%s].service', p_path, item_index));
        perform public.cms_phase5_require_string(item->'ctaLabel', format('%s.items[%s].ctaLabel', p_path, item_index), 80);
        item_index := item_index + 1;
      end loop;

    when 'home_approach', 'about_principles' then
      perform public.cms_phase5_require_exact_keys(p_value, array['eyebrow', 'heading', 'items'], p_path);
      perform public.cms_phase5_require_string(p_value->'eyebrow', p_path || '.eyebrow', 80);
      perform public.cms_phase5_require_string(p_value->'heading', p_path || '.heading', 180);
      perform public.cms_phase5_validate_text_items(p_value->'items', p_path || '.items');

    when 'home_contact' then
      perform public.cms_phase5_require_exact_keys(p_value, array['eyebrow', 'heading', 'body', 'cta'], p_path);
      perform public.cms_phase5_require_string(p_value->'eyebrow', p_path || '.eyebrow', 80);
      perform public.cms_phase5_require_string(p_value->'heading', p_path || '.heading', 180);
      perform public.cms_phase5_require_string(p_value->'body', p_path || '.body', 2000);
      perform public.cms_phase5_validate_cta(p_value->'cta', p_path || '.cta');

    when 'services_hero', 'about_hero', 'contact_hero' then
      perform public.cms_phase5_require_exact_keys(p_value, array['eyebrow', 'title', 'intro'], p_path);
      perform public.cms_phase5_require_string(p_value->'eyebrow', p_path || '.eyebrow', 80);
      perform public.cms_phase5_require_string(p_value->'title', p_path || '.title', 180);
      perform public.cms_phase5_require_string(p_value->'intro', p_path || '.intro', 2000);

    when 'services_capabilities' then
      perform public.cms_phase5_require_exact_keys(p_value, array['eyebrow', 'heading', 'note'], p_path);
      perform public.cms_phase5_require_optional_string(p_value->'eyebrow', p_path || '.eyebrow', 80);
      perform public.cms_phase5_require_optional_string(p_value->'heading', p_path || '.heading', 180);
      perform public.cms_phase5_require_optional_string(p_value->'note', p_path || '.note', 2000);

    when 'about_people' then
      perform public.cms_phase5_require_exact_keys(p_value, array['eyebrow', 'heading', 'cta'], p_path);
      perform public.cms_phase5_require_string(p_value->'eyebrow', p_path || '.eyebrow', 80);
      perform public.cms_phase5_require_string(p_value->'heading', p_path || '.heading', 180);
      perform public.cms_phase5_validate_cta(p_value->'cta', p_path || '.cta');

    when 'contact_process' then
      perform public.cms_phase5_require_exact_keys(p_value, array['eyebrow', 'heading', 'items', 'cta'], p_path);
      perform public.cms_phase5_require_string(p_value->'eyebrow', p_path || '.eyebrow', 80);
      perform public.cms_phase5_require_string(p_value->'heading', p_path || '.heading', 180);
      perform public.cms_phase5_validate_text_items(p_value->'items', p_path || '.items');
      perform public.cms_phase5_validate_cta(p_value->'cta', p_path || '.cta');

    when 'contact_form' then
      perform public.cms_phase5_require_exact_keys(p_value, array['eyebrow', 'heading', 'intro'], p_path);
      perform public.cms_phase5_require_string(p_value->'eyebrow', p_path || '.eyebrow', 80);
      perform public.cms_phase5_require_string(p_value->'heading', p_path || '.heading', 180);
      perform public.cms_phase5_require_string(p_value->'intro', p_path || '.intro', 2000);

    else
      raise exception 'Unknown Phase 5 section key %', p_section_key;
  end case;
end;
$$;
