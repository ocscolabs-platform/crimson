export const DESIGN_SETTINGS_V1_COLOR_KEYS = [
  "ink",
  "graphite",
  "green",
  "white",
  "snow",
  "muted",
  "border",
  "copy",
] as const;

export type DesignSettingsColorKey = (typeof DESIGN_SETTINGS_V1_COLOR_KEYS)[number];

export const DESIGN_SETTINGS_V1_EYEBROW_KEYS = [
  "size",
  "weight",
  "line_height",
  "letter_spacing",
] as const;

export type DesignSettingsEyebrow = {
  size: number;
  weight: 400 | 500 | 600 | 700 | 800;
  line_height: number;
  letter_spacing: number;
};

export type DesignSettingsTypographyV1 = {
  eyebrow: DesignSettingsEyebrow;
};

export type DesignSettingsV1 = {
  version: 1;
  colors: Record<DesignSettingsColorKey, string>;
  typography?: DesignSettingsTypographyV1;
};

export type DesignSettingsCssVariableKey =
  | `--${DesignSettingsColorKey}`
  | "--type-eyebrow-size"
  | "--type-eyebrow-weight"
  | "--type-eyebrow-line-height"
  | "--type-eyebrow-letter-spacing";

export type DesignSettingsCssVariables = Record<DesignSettingsCssVariableKey, string>;

const DEFAULT_COLORS: Record<DesignSettingsColorKey, string> = {
  ink: "#0a0a0a",
  graphite: "#1a1a1a",
  green: "#00c853",
  white: "#ffffff",
  snow: "#f7f7f7",
  muted: "#9e9e9e",
  border: "#e8e8e8",
  copy: "#505050",
};

export const DEFAULT_DESIGN_SETTINGS_V1: DesignSettingsV1 = Object.freeze({
  version: 1,
  colors: Object.freeze({ ...DEFAULT_COLORS }),
  typography: Object.freeze({
    eyebrow: Object.freeze({
      size: 0.72,
      weight: 800,
      line_height: 1.4,
      letter_spacing: 0.16,
    }),
  }),
});

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function exactKeys(value: RecordValue, allowed: readonly string[], path: string, issues: string[]) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) issues.push(`${path}.${key}: unknown field`);
  }
}

function isSafeColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

const DESIGN_SETTINGS_EYEBROW_WEIGHTS = [400, 500, 600, 700, 800] as const;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isSafeEyebrowValue(key: (typeof DESIGN_SETTINGS_V1_EYEBROW_KEYS)[number], value: unknown): boolean {
  if (key === "weight") return DESIGN_SETTINGS_EYEBROW_WEIGHTS.includes(value as (typeof DESIGN_SETTINGS_EYEBROW_WEIGHTS)[number]);
  if (!isFiniteNumber(value)) return false;
  if (key === "size") return value >= 0.5 && value <= 1.25;
  if (key === "line_height") return value >= 1 && value <= 2;
  return value > 0 && value <= 0.3;
}

function validateEyebrow(input: RecordValue, issues: string[]) {
  exactKeys(input, DESIGN_SETTINGS_V1_EYEBROW_KEYS, "design_settings.typography.eyebrow", issues);
  for (const key of DESIGN_SETTINGS_V1_EYEBROW_KEYS) {
    if (key in input && !isSafeEyebrowValue(key, input[key])) {
      issues.push(`design_settings.typography.eyebrow.${key}: outside the approved range`);
    }
  }
}

export type DesignSettingsValidation =
  | { success: true; value: DesignSettingsV1 }
  | { success: false; issues: string[] };

export function validateDesignSettingsV1(input: unknown): DesignSettingsValidation {
  const issues: string[] = [];
  if (!isRecord(input)) return { success: false, issues: ["design_settings: expected object"] };

  exactKeys(input, ["version", "colors", "typography"], "design_settings", issues);
  if (input.version !== 1) issues.push("design_settings.version: expected 1");
  if (!isRecord(input.colors)) {
    issues.push("design_settings.colors: expected object");
  } else {
    exactKeys(input.colors, DESIGN_SETTINGS_V1_COLOR_KEYS, "design_settings.colors", issues);
    for (const key of DESIGN_SETTINGS_V1_COLOR_KEYS) {
      if (!isSafeColor(input.colors[key])) {
        issues.push(`design_settings.colors.${key}: expected a six-digit hex color`);
      }
    }
  }

  if ("typography" in input) {
    if (!isRecord(input.typography)) {
      issues.push("design_settings.typography: expected object");
    } else {
      exactKeys(input.typography, ["eyebrow"], "design_settings.typography", issues);
      if ("eyebrow" in input.typography) {
        if (!isRecord(input.typography.eyebrow)) {
          issues.push("design_settings.typography.eyebrow: expected object");
        } else {
          validateEyebrow(input.typography.eyebrow, issues);
        }
      }
    }
  }

  return issues.length > 0
    ? { success: false, issues: [...new Set(issues)] }
    : { success: true, value: normalizeDesignSettingsV1(input) };
}

export function normalizeDesignSettingsV1(input: unknown): DesignSettingsV1 {
  if (!isRecord(input) || input.version !== 1 || !isRecord(input.colors)) {
    return DEFAULT_DESIGN_SETTINGS_V1;
  }

  const inputColors = input.colors;
  const colors = Object.fromEntries(
    DESIGN_SETTINGS_V1_COLOR_KEYS.map((key) => [key, isSafeColor(inputColors[key]) ? inputColors[key] : DEFAULT_COLORS[key]]),
  ) as Record<DesignSettingsColorKey, string>;

  const inputTypography = isRecord(input.typography) ? input.typography : {};
  const inputEyebrow = isRecord(inputTypography.eyebrow) ? inputTypography.eyebrow : {};
  const defaultEyebrow = DEFAULT_DESIGN_SETTINGS_V1.typography!.eyebrow;
  const eyebrow = Object.fromEntries(
    DESIGN_SETTINGS_V1_EYEBROW_KEYS.map((key) => [key, isSafeEyebrowValue(key, inputEyebrow[key]) ? inputEyebrow[key] : defaultEyebrow[key]]),
  ) as DesignSettingsEyebrow;

  return { version: 1, colors, typography: { eyebrow } };
}

export function designSettingsToCssVariables(input: unknown): DesignSettingsCssVariables {
  const settings = normalizeDesignSettingsV1(input);
  const eyebrow = settings.typography!.eyebrow;
  return Object.fromEntries(
    [
      ...DESIGN_SETTINGS_V1_COLOR_KEYS.map((key) => [`--${key}`, settings.colors[key]]),
      ["--type-eyebrow-size", `${eyebrow.size}rem`],
      ["--type-eyebrow-weight", String(eyebrow.weight)],
      ["--type-eyebrow-line-height", String(eyebrow.line_height)],
      ["--type-eyebrow-letter-spacing", `${eyebrow.letter_spacing}em`],
    ],
  ) as DesignSettingsCssVariables;
}
