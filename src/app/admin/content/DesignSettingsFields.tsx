"use client";

import { useState } from "react";
import AdminSelect from "@/app/admin/AdminSelect";
import {
  DESIGN_SETTINGS_V1_COLOR_KEYS,
  type DesignSettingsColorKey,
  type DesignSettingsEyebrow,
  type DesignSettingsHomeHeroTitle,
} from "@/lib/design-settings";

const COLOR_LABELS: Record<DesignSettingsColorKey, string> = {
  ink: "Ink",
  graphite: "Graphite",
  green: "Green / Accent",
  white: "White",
  snow: "Snow / Background",
  muted: "Muted",
  border: "Border / Divider",
  copy: "Copy / Body Text",
};

type DesignSettingsFieldsProps = {
  values: Record<DesignSettingsColorKey, string>;
  eyebrow: DesignSettingsEyebrow;
  homeHeroTitle: DesignSettingsHomeHeroTitle;
  disabled?: boolean;
};

function isHex(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

const EYEBROW_WEIGHTS = [400, 500, 600, 700, 800] as const;
const HOME_HERO_TITLE_SCALES = [
  { label: "80%", value: "0.8" },
  { label: "85%", value: "0.85" },
  { label: "90%", value: "0.9" },
  { label: "95%", value: "0.95" },
  { label: "100% — Default", value: "1" },
  { label: "105%", value: "1.05" },
  { label: "110%", value: "1.1" },
] as const;

export default function DesignSettingsFields({ values, eyebrow: eyebrowValues, homeHeroTitle: homeHeroTitleValues, disabled = false }: DesignSettingsFieldsProps) {
  const [colors, setColors] = useState(values);
  const [eyebrow, setEyebrow] = useState(eyebrowValues);
  const [homeHeroTitle, setHomeHeroTitle] = useState(homeHeroTitleValues);

  function updateColor(key: DesignSettingsColorKey, value: string) {
    setColors((current) => ({ ...current, [key]: value }));
  }

  function updateEyebrow<K extends keyof DesignSettingsEyebrow>(key: K, value: DesignSettingsEyebrow[K]) {
    setEyebrow((current) => ({ ...current, [key]: value }));
  }

  function updateHomeHeroTitle(value: string) {
    setHomeHeroTitle({ scale: Number(value) });
  }

  return (
    <>
      <div className="admin-color-grid">
        {DESIGN_SETTINGS_V1_COLOR_KEYS.map((key) => {
          const value = colors[key];
          const pickerValue = isHex(value) ? value : "#000000";
          return (
            <label className="admin-color-control" key={key}>
              <span>{COLOR_LABELS[key]}</span>
              <span className="admin-color-input-row">
                <input
                  className="admin-color-swatch"
                  type="color"
                  value={pickerValue}
                  onChange={(event) => updateColor(key, event.target.value.toLowerCase())}
                  aria-label={`${COLOR_LABELS[key]} color picker`}
                  disabled={disabled}
                />
                <input
                  className="admin-input admin-color-hex"
                  name={`design_${key}`}
                  value={value}
                  onChange={(event) => updateColor(key, event.target.value)}
                  aria-label={`${COLOR_LABELS[key]} hex value`}
                  pattern="^#[0-9A-Fa-f]{6}$"
                  maxLength={7}
                  spellCheck={false}
                  disabled={disabled}
                  required
                />
              </span>
              {!isHex(value) ? <small className="admin-color-error" role="alert">Use a six-digit hex value such as #00c853.</small> : null}
            </label>
          );
        })}
      </div>
      <fieldset className="admin-typography-fieldset">
        <legend>Typography <small>Eyebrow / Overline</small></legend>
        <div className="admin-typography-grid">
          <label>
            <span>Size <small className="admin-field-unit">rem</small></span>
            <input
              className="admin-input"
              name="design_eyebrow_size"
              type="number"
              value={eyebrow.size}
              min="0.5"
              max="1.25"
              step="0.01"
              onChange={(event) => updateEyebrow("size", Number(event.target.value))}
              aria-label="Eyebrow size in rem"
              disabled={disabled}
              required
            />
          </label>
          <label>
            <span>Weight</span>
            <select
              className="admin-input"
              name="design_eyebrow_weight"
              value={eyebrow.weight}
              onChange={(event) => updateEyebrow("weight", Number(event.target.value) as DesignSettingsEyebrow["weight"])}
              aria-label="Eyebrow weight"
              disabled={disabled}
              required
            >
              {EYEBROW_WEIGHTS.map((weight) => <option key={weight} value={weight}>{weight}</option>)}
            </select>
          </label>
          <label>
            <span>Line height <small className="admin-field-unit">unitless</small></span>
            <input
              className="admin-input"
              name="design_eyebrow_line_height"
              type="number"
              value={eyebrow.line_height}
              min="1"
              max="2"
              step="0.1"
              onChange={(event) => updateEyebrow("line_height", Number(event.target.value))}
              aria-label="Eyebrow line height"
              disabled={disabled}
              required
            />
          </label>
          <label>
            <span>Letter spacing <small className="admin-field-unit">em</small></span>
            <input
              className="admin-input"
              name="design_eyebrow_letter_spacing"
              type="number"
              value={eyebrow.letter_spacing}
              min="0.01"
              max="0.3"
              step="0.01"
              onChange={(event) => updateEyebrow("letter_spacing", Number(event.target.value))}
              aria-label="Eyebrow letter spacing in em"
              disabled={disabled}
              required
            />
          </label>
        </div>
      </fieldset>
      <fieldset className="admin-typography-fieldset">
        <legend>Typography <small>Home Hero Title</small></legend>
        <div className="admin-typography-grid">
          <label>
            <span>Title Size</span>
            <AdminSelect
              name="design_home_hero_title_scale"
              value={String(homeHeroTitle.scale)}
              onChange={(event) => updateHomeHeroTitle(event.target.value)}
              aria-label="Home Hero Title size"
              disabled={disabled}
              required
            >
              {HOME_HERO_TITLE_SCALES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </AdminSelect>
          </label>
        </div>
        <p className="admin-section-note">Adjusts the Home hero title size while preserving its responsive behavior.</p>
      </fieldset>
    </>
  );
}
