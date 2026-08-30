-- OCSCO Project Crimson — Batch 4C2A eyebrow typography storage contract.
-- Extend the existing Design Settings validator additively. No runtime CSS or
-- CMS typography controls are introduced by this migration.

begin;

create or replace function public.cms_design_settings_v1_is_valid(p_design_settings jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
  key_name text;
  typography jsonb;
  eyebrow jsonb;
begin
  if jsonb_typeof(p_design_settings) is distinct from 'object'
    or p_design_settings->>'version' is distinct from '1'
    or jsonb_typeof(p_design_settings->'colors') is distinct from 'object'
  then
    return false;
  end if;

  if (select count(*) from jsonb_object_keys(p_design_settings)) not in (2, 3)
    or (select count(*) from jsonb_object_keys(p_design_settings->'colors')) <> 8
  then
    return false;
  end if;

  for key_name in select jsonb_object_keys(p_design_settings) loop
    if key_name not in ('version', 'colors', 'typography') then
      return false;
    end if;
  end loop;

  for key_name in select jsonb_object_keys(p_design_settings->'colors') loop
    if key_name not in ('ink', 'graphite', 'green', 'white', 'snow', 'muted', 'border', 'copy')
      or jsonb_typeof(p_design_settings->'colors'->key_name) is distinct from 'string'
      or (p_design_settings->'colors'->>key_name) !~ '^#[0-9A-Fa-f]{6}$'
    then
      return false;
    end if;
  end loop;

  if not p_design_settings ? 'typography' then
    return true;
  end if;

  typography := p_design_settings->'typography';
  if jsonb_typeof(typography) is distinct from 'object'
    or (select count(*) from jsonb_object_keys(typography)) <> 1
  then
    return false;
  end if;

  for key_name in select jsonb_object_keys(typography) loop
    if key_name <> 'eyebrow' then
      return false;
    end if;
  end loop;

  eyebrow := typography->'eyebrow';
  if jsonb_typeof(eyebrow) is distinct from 'object'
    or (select count(*) from jsonb_object_keys(eyebrow)) <> 4
  then
    return false;
  end if;

  for key_name in select jsonb_object_keys(eyebrow) loop
    if key_name not in ('size', 'weight', 'line_height', 'letter_spacing') then
      return false;
    end if;
  end loop;

  if jsonb_typeof(eyebrow->'size') is distinct from 'number'
    or jsonb_typeof(eyebrow->'weight') is distinct from 'number'
    or jsonb_typeof(eyebrow->'line_height') is distinct from 'number'
    or jsonb_typeof(eyebrow->'letter_spacing') is distinct from 'number'
  then
    return false;
  end if;

  if (eyebrow->>'size')::numeric < 0.5 or (eyebrow->>'size')::numeric > 1.25 then
    return false;
  end if;
  if (eyebrow->>'weight')::numeric not in (400, 500, 600, 700, 800) then
    return false;
  end if;
  if (eyebrow->>'line_height')::numeric < 1 or (eyebrow->>'line_height')::numeric > 2 then
    return false;
  end if;
  if (eyebrow->>'letter_spacing')::numeric <= 0 or (eyebrow->>'letter_spacing')::numeric > 0.3 then
    return false;
  end if;

  return true;
end;
$$;

revoke all on function public.cms_design_settings_v1_is_valid(jsonb) from public;
grant execute on function public.cms_design_settings_v1_is_valid(jsonb) to authenticated;

commit;
