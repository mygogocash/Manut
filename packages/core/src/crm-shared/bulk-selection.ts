/**
 * Selection resolution for Sales CRM bulk actions (edge/core).
 */

export interface BulkSelection<TFilter> {
  ids?: string[];
  allMatching?: boolean;
  filter?: TFilter;
}

export interface OwnerScopedFilter {
  ownerScope?: string[];
  ids?: string[];
}

export function resolveBulkWhere<TClientFilter>(
  selection: BulkSelection<TClientFilter>,
  ownerScope: string[] | undefined,
): TClientFilter & OwnerScopedFilter {
  if (selection.allMatching) {
    return {
      ...((selection.filter ?? {}) as TClientFilter),
      ownerScope,
    };
  }
  return {
    ...((selection.filter ?? {}) as TClientFilter),
    ids: selection.ids ?? [],
    ownerScope,
  };
}
