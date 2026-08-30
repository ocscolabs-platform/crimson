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

export const DESIGN_SETTINGS_V1_HOME_HERO_TITLE_KEYS = ["scale"] as const;

export type DesignSettingsHomeHeroTitle = {
  scale: number;
};

export type DesignSettingsTypographyV1 = {
  eyebrow: DesignSettingsEyebrow;
  home_hero_title: DesignSettingsHomeHeroTitle;
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
  | "--type-eyebrow-letter-spacing"
  | "--type-h1-hero-size"
  | "--type-h1-hero-mobile-size";

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
    home_hero_title: Object.freeze({
      scale: 1,
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

function isSafeHomeHeroTitleValue(key: (typeof DESIGN_SETTINGS_V1_HOME_HERO_TITLE_KEYS)[number], value: unknown): boolean {
  if (key !== "scale" || !isFiniteNumber(value)) return false;
  return value >= 0.8 && value <= 1.1;
}

function validateHomeHeroTitle(input: RecordValue, issues: string[]) {
  exactKeys(input, DESIGN_SETTINGS_V1_HOME_HERO_TITLE_KEYS, "design_settings.typography.home_hero_title", issues);
  for (const key of DESIGN_SETTINGS_V1_HOME_HERO_TITLE_KEYS) {
    if (key in input && !isSafeHomeHeroTitleValue(key, input[key])) {
      issues.push(`design_settings.typography.home_hero_title.${key}: outside the approved range`);
    }
  }
}

const HOME_HERO_TITLE_BASE_FORMULAS = Object.freeze({
  desktop: Object.freeze({ minRem: 3.2, fluidVw: 7, maxRem: 6.9 }),
  mobile: Object.freeze({ minRem: 2.9, fluidVw: 15, maxRem: 4.5 }),
});

function formatCssNumber(value: number): string {
  return Number(value.toFixed(4)).toString();
}

function scaledClamp(formula: { minRem: number; fluidVw: number; maxRem: number }, scale: number, defaultFormula: string): string {
  if (scale === 1) return defaultFormula;
  return `clamp(${formatCssNumber(formula.minRem * scale)}rem, ${formatCssNumber(formula.fluidVw * scale)}vw, ${formatCssNumber(formula.maxRem * scale)}rem)`;
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
      exactKeys(input.typography, ["eyebrow", "home_hero_title"], "design_settings.typography", issues);
      if ("eyebrow" in input.typography) {
        if (!isRecord(input.typography.eyebrow)) {
          issues.push("design_settings.typography.eyebrow: expected object");
        } else {
          validateEyebrow(input.typography.eyebrow, issues);
        }
      }
      if ("home_hero_title" in input.typography) {
        if (!isRecord(input.typography.home_hero_title)) {
          issues.push("design_settings.typography.home_hero_title: expected object");
        } else {
          validateHomeHeroTitle(input.typography.home_hero_title, issues);
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

  const inputHomeHeroTitle = isRecord(inputTypography.home_hero_title) ? inputTypography.home_hero_title : {};
  const defaultHomeHeroTitle = DEFAULT_DESIGN_SETTINGS_V1.typography!.home_hero_title;
  const homeHeroTitle = Object.fromEntries(
    DESIGN_SETTINGS_V1_HOME_HERO_TITLE_KEYS.map((key) => [key, isSafeHomeHeroTitleValue(key, inputHomeHeroTitle[key]) ? inputHomeHeroTitle[key] : defaultHomeHeroTitle[key]]),
  ) as DesignSettingsHomeHeroTitle;

  return { version: 1, colors, typography: { eyebrow, home_hero_title: homeHeroTitle } };
}

export function designSettingsToCssVariables(input: unknown): DesignSettingsCssVariables {
  const settings = normalizeDesignSettingsV1(input);
  const eyebrow = settings.typography!.eyebrow;
  const homeHeroScale = settings.typography!.home_hero_title.scale;
  return Object.fromEntries(
    [
      ...DESIGN_SETTINGS_V1_COLOR_KEYS.map((key) => [`--${key}`, settings.colors[key]]),
      ["--type-eyebrow-size", `${eyebrow.size}rem`],
      ["--type-eyebrow-weight", String(eyebrow.weight)],
      ["--type-eyebrow-line-height", String(eyebrow.line_height)],
      ["--type-eyebrow-letter-spacing", `${eyebrow.letter_spacing}em`],
      ["--type-h1-hero-size", scaledClamp(HOME_HERO_TITLE_BASE_FORMULAS.desktop, homeHeroScale, "clamp(3.2rem, 7vw, 6.9rem)")],
      ["--type-h1-hero-mobile-size", scaledClamp(HOME_HERO_TITLE_BASE_FORMULAS.mobile, homeHeroScale, "clamp(2.9rem, 15vw, 4.5rem)")],
    ],
  ) as DesignSettingsCssVariables;
}
