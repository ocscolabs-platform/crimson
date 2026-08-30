"use client";

import { useState } from "react";
import { DESIGN_SETTINGS_V1_COLOR_KEYS, type DesignSettingsColorKey } from "@/lib/design-settings";

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
  disabled?: boolean;
};

function isHex(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

export default function DesignSettingsFields({ values, disabled = false }: DesignSettingsFieldsProps) {
  const [colors, setColors] = useState(values);

  function updateColor(key: DesignSettingsColorKey, value: string) {
    setColors((current) => ({ ...current, [key]: value }));
  }

  return (
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
  );
}
