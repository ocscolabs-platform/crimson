export type WorkOrderCompatibilityRow = {
  slug: string;
  sort_order: number;
  created_at: string;
  is_featured: boolean;
};

export function hasDuplicateWorkSortOrder(rows: readonly WorkOrderCompatibilityRow[]): boolean {
  const seen = new Set<number>();

  for (const row of rows) {
    if (seen.has(row.sort_order)) {
      return true;
    }
    seen.add(row.sort_order);
  }

  return false;
}

export function orderWorkRowsForCompatibility<T extends WorkOrderCompatibilityRow>(
  rows: readonly T[],
  useLegacyFeaturedOrder = hasDuplicateWorkSortOrder(rows),
): T[] {
  return [...rows].sort((left, right) => {
    if (useLegacyFeaturedOrder && left.is_featured !== right.is_featured) {
      return left.is_featured ? -1 : 1;
    }

    return left.sort_order - right.sort_order
      || left.created_at.localeCompare(right.created_at)
      || left.slug.localeCompare(right.slug);
  });
}
