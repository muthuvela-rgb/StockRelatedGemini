export type SortDirection = "asc" | "desc";

export interface SortCriterion<K extends string = string> {
  id: string;
  field: K;
  direction: SortDirection;
}

export interface ColumnDefinition<K extends string = string> {
  key: K;
  label: string;
  defaultDirection?: SortDirection;
  numeric?: boolean;
  extractor?: (item: any) => any;
}

export interface SortPreset<K extends string = string> {
  label: string;
  description?: string;
  criteria: Array<{
    field: K;
    direction: SortDirection;
  }>;
}

/**
 * Robust value comparator that handles numbers, formatted number strings,
 * dates, booleans, and localized strings with tolerance for floating-point equality.
 */
function compareValues(valA: any, valB: any, direction: SortDirection): number {
  // Null / undefined handling
  const isANil = valA === null || valA === undefined || (typeof valA === "number" && isNaN(valA));
  const isBNil = valB === null || valB === undefined || (typeof valB === "number" && isNaN(valB));

  if (isANil && isBNil) return 0;
  if (isANil) return 1; // Nulls always pushed to the end
  if (isBNil) return -1;

  // Number comparison (handles raw numbers or numeric strings like "$45.20", "12.5%", "100")
  const isNumA = typeof valA === "number" || (!isNaN(Number(String(valA).replace(/[$,%]/g, "").trim())) && String(valA).trim() !== "");
  const isNumB = typeof valB === "number" || (!isNaN(Number(String(valB).replace(/[$,%]/g, "").trim())) && String(valB).trim() !== "");

  if (isNumA && isNumB) {
    const numA = typeof valA === "number" ? valA : Number(String(valA).replace(/[$,%]/g, "").trim());
    const numB = typeof valB === "number" ? valB : Number(String(valB).replace(/[$,%]/g, "").trim());
    
    if (isFinite(numA) && isFinite(numB)) {
      const diff = numA - numB;
      if (Math.abs(diff) < 0.00001) return 0;
      return direction === "asc" ? diff : -diff;
    }
  }

  // Boolean comparison
  if (typeof valA === "boolean" && typeof valB === "boolean") {
    if (valA === valB) return 0;
    const diff = (valA ? 1 : 0) - (valB ? 1 : 0);
    return direction === "asc" ? diff : -diff;
  }

  // Date comparison
  if (valA instanceof Date && valB instanceof Date) {
    const diff = valA.getTime() - valB.getTime();
    if (diff === 0) return 0;
    return direction === "asc" ? diff : -diff;
  }

  const strA = String(valA).trim();
  const strB = String(valB).trim();

  // String comparison
  if (strA === strB) return 0;
  const cmp = strA.localeCompare(strB, undefined, { numeric: true, sensitivity: "base" });
  return direction === "asc" ? cmp : -cmp;
}

/**
 * Hierarchical Multi-Level Sorting Algorithm:
 * Evaluates Level 1. If non-zero, returns difference.
 * If Level 1 tie (returns 0), evaluates Level 2.
 * Continues through all configured levels.
 */
export function applyHierarchicalSort<T>(
  items: T[],
  criteria: SortCriterion<any>[],
  columnDefs?: ColumnDefinition<any>[] | Record<string, ColumnDefinition<any>>
): T[] {
  if (!items || items.length <= 1 || !criteria || criteria.length === 0) {
    return items;
  }

  // Build extractor lookup map
  const extractorMap: Record<string, (item: any) => any> = {};
  if (Array.isArray(columnDefs)) {
    for (const col of columnDefs) {
      if (col.extractor) {
        extractorMap[col.key] = col.extractor;
      }
    }
  } else if (columnDefs) {
    for (const [key, col] of Object.entries(columnDefs)) {
      if (col.extractor) {
        extractorMap[key] = col.extractor;
      }
    }
  }

  return [...items].sort((a, b) => {
    for (const criterion of criteria) {
      const field = criterion.field;
      const extractor = extractorMap[field];
      const valA = extractor ? extractor(a) : (a as any)[field];
      const valB = extractor ? extractor(b) : (b as any)[field];

      const diff = compareValues(valA, valB, criterion.direction);
      if (diff !== 0) {
        return diff;
      }
    }
    return 0;
  });
}

/**
 * Appends a new level to the criteria hierarchy or toggles it if present.
 */
export function appendSortLevel<K extends string>(
  field: K,
  currentCriteria: SortCriterion<K>[],
  defaultDirection: SortDirection = "asc"
): SortCriterion<K>[] {
  const existingIdx = currentCriteria.findIndex((c) => c.field === field);
  if (existingIdx >= 0) {
    const updated = [...currentCriteria];
    const existing = updated[existingIdx];
    updated[existingIdx] = {
      ...existing,
      direction: existing.direction === "asc" ? "desc" : "asc",
    };
    return updated;
  }
  return [
    ...currentCriteria,
    {
      id: `${field}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      field,
      direction: defaultDirection,
    },
  ];
}

/**
 * Removes a field from the criteria hierarchy.
 */
export function removeSortLevel<K extends string>(
  field: K,
  currentCriteria: SortCriterion<K>[]
): SortCriterion<K>[] {
  return currentCriteria.filter((c) => c.field !== field);
}

/**
 * Header Click Handler Helper:
 * - If field is ALREADY in the hierarchy:
 *     Toggles its direction (asc <-> desc) while preserving all other levels.
 *     If Shift+Click on an active descending field, it cycles to removal.
 * - If field is NOT in the hierarchy:
 *     - If isShiftPressed OR forceAppend: appends as the next level in the hierarchy!
 *     - If normal click: replaces with this sole column (clean single-sort start).
 */
export function handleHeaderClick<K extends string>(
  field: K,
  isShiftPressed: boolean,
  currentCriteria: SortCriterion<K>[],
  defaultDirection: SortDirection = "asc",
  forceAppend: boolean = false
): SortCriterion<K>[] {
  const existingIdx = currentCriteria.findIndex((c) => c.field === field);

  // 1. Column is ALREADY active in the hierarchy:
  if (existingIdx >= 0) {
    const existing = currentCriteria[existingIdx];
    if (isShiftPressed && existing.direction === "desc") {
      // Shift+Click cycle: asc -> desc -> remove
      return currentCriteria.filter((_, idx) => idx !== existingIdx);
    }
    // Toggle direction while PRESERVING other levels!
    const updated = [...currentCriteria];
    updated[existingIdx] = {
      ...existing,
      direction: existing.direction === "asc" ? "desc" : "asc",
    };
    return updated;
  }

  // 2. Column is NOT yet in the hierarchy:
  if (isShiftPressed || forceAppend) {
    // Append as next level in the hierarchy
    return [
      ...currentCriteria,
      {
        id: `${field}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        field,
        direction: defaultDirection,
      },
    ];
  } else {
    // Normal single click on a new column: set as sole sort level
    return [
      {
        id: `${field}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        field,
        direction: defaultDirection,
      },
    ];
  }
}
