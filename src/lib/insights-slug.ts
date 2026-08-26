export const INSIGHTS_SLUG_MAX_LENGTH = 120;
export const INSIGHTS_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidInsightsSlug(value: string): boolean {
  return value.length >= 1 && value.length <= INSIGHTS_SLUG_MAX_LENGTH && value === value.trim() && INSIGHTS_SLUG_PATTERN.test(value);
}

export function slugifyInsightsTitle(title: string): string {
  const normalized = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, INSIGHTS_SLUG_MAX_LENGTH)
    .replace(/-+$/, "");
  return normalized || "untitled-insight";
}

export function getUniqueInsightsSlugCandidate(base: string, attempt: number): string {
  if (attempt <= 1) return base;
  const suffix = `-${attempt}`;
  return `${base.slice(0, INSIGHTS_SLUG_MAX_LENGTH - suffix.length).replace(/-+$/, "")}${suffix}`;
}
