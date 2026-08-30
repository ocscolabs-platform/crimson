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

export type DesignSettingsV1 = {
  version: 1;
  colors: Record<DesignSettingsColorKey, string>;
};

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

export type DesignSettingsValidation =
  | { success: true; value: DesignSettingsV1 }
  | { success: false; issues: string[] };

export function validateDesignSettingsV1(input: unknown): DesignSettingsValidation {
  const issues: string[] = [];
  if (!isRecord(input)) return { success: false, issues: ["design_settings: expected object"] };

  exactKeys(input, ["version", "colors"], "design_settings", issues);
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

  return issues.length > 0
    ? { success: false, issues: [...new Set(issues)] }
    : { success: true, value: input as DesignSettingsV1 };
}

export function normalizeDesignSettingsV1(input: unknown): DesignSettingsV1 {
  if (!isRecord(input) || input.version !== 1 || !isRecord(input.colors)) {
    return DEFAULT_DESIGN_SETTINGS_V1;
  }

  const inputColors = input.colors;
  const colors = Object.fromEntries(
    DESIGN_SETTINGS_V1_COLOR_KEYS.map((key) => [key, isSafeColor(inputColors[key]) ? inputColors[key] : DEFAULT_COLORS[key]]),
  ) as Record<DesignSettingsColorKey, string>;

  return { version: 1, colors };
}
