/**
 * Selection resolution for Sales CRM bulk actions.
 *
 * Shared by opportunities, accounts and leads because all three have the same
 * two selection modes and the same owner-scope rule, and because the failure
 * this guards against is identical in each: a bulk action that hits rows the
 * user never saw.
 *
 * Modelled on `bulkSelectionWhere` in `investors.service.ts`. Two rules carry
 * over verbatim, and both matter:
 *
 *   * `allMatching` resolves through the SAME where-builder the list uses
 *     (`buildOpportunityWhere` / `buildAccountWhere` / `buildLeadWhere`). If the
 *     bulk path rebuilt the predicate itself the two could drift, and "select
 *     all 214 matching" would act on a different 214 rows than the page showed.
 *
 *   * Owner scope is ANDed in BOTH modes, never checked id-by-id. A caller
 *     without `crm:team-read` who passes somebody else's id simply matches
 *     nothing — no error, no partial write, no information leak about whether
 *     that id exists.
 */

export interface BulkSelection<TFilter> {
  /** Explicitly ticked rows. Mutually exclusive with `allMatching` in practice. */
  ids?: string[];
  /** "Select all N matching the current filter". */
  allMatching?: boolean;
  /** The list filter in force when the user chose `allMatching`. */
  filter?: TFilter;
}

/**
 * Filters accepted by the three list where-builders. Each takes `ownerScope`
 * as an array of user ids and turns it into `ownerId: { in: … }`.
 */
export interface OwnerScopedFilter {
  ownerScope?: string[];
}

/**
 * Build the Prisma `where` that a bulk action should act on.
 *
 * `ownerScope` is `undefined` for callers holding `crm:team-read` (they see the
 * whole team) and `[userId]` otherwise — matching how the list services already
 * compute it (`opportunities.service.ts`: `canSeeAll ? undefined : [userId]`).
 */
export function resolveBulkWhere<TClientFilter, TWhere extends object>(
  selection: BulkSelection<TClientFilter>,
  // The builder takes the client filter PLUS `ownerScope`. Splitting the two
  // in the signature is the point: `TClientFilter` is what the request may
  // carry, and `ownerScope` is ours to add.
  buildWhere: (filter: TClientFilter & OwnerScopedFilter) => TWhere,
  ownerScope: string[] | undefined,
): TWhere {
  if (selection.allMatching) {
    // Spread the filter through the list's own builder, with owner scope
    // folded in so it is applied by the same code path as everything else.
    return buildWhere({
      ...((selection.filter ?? {}) as TClientFilter),
      ownerScope,
    });
  }

  return {
    id: { in: selection.ids ?? [] },
    ...(ownerScope ? { ownerId: { in: ownerScope } } : {}),
  } as unknown as TWhere;
}
