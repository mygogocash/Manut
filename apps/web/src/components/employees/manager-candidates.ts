/**
 * Line Manager dropdown candidates — pure helpers so the failure-path
 * behaviour is unit-testable.
 *
 * History: the dropdown is fed by `listUsers({ limit: 500, isActive: true })`.
 * #574 merged the currently-bound manager into the fetched list so an
 * inactive or past-the-cap manager still rendered — but only on the success
 * path. A transient fetch failure silently produced an empty list, the merge
 * never ran, and Radix fell back to the "Select manager" placeholder even
 * though `reportingTo` was set. HR read that as a wiped field and kept
 * re-saving the same manager (2026-08-24 — verified in prod that the data
 * was never lost). The fix: seed the list with the bound manager BEFORE the
 * fetch, so their label renders no matter how the fetch ends.
 */

export interface ManagerCandidate {
  id: string;
  name: string;
}

interface ManagerRef {
  id: string;
  name: string;
}

/**
 * What the dropdown holds before (or instead of) the listUsers result:
 * just the currently-bound manager, so the trigger can always render
 * their name. Empty for create mode and for a self-reference.
 */
export function seedManagerCandidates(
  boundManager: ManagerRef | null | undefined,
  selfId: string | undefined,
): ManagerCandidate[] {
  if (!boundManager || boundManager.id === selfId) return [];
  return [{ id: boundManager.id, name: boundManager.name }];
}

/**
 * Full candidate list once the fetch succeeds: everyone returned except
 * self, with the bound manager merged to the top when the fetch missed
 * them (inactive, or past the 500-row cap).
 */
export function mergeManagerCandidates(
  listed: ManagerRef[],
  boundManager: ManagerRef | null | undefined,
  selfId: string | undefined,
): ManagerCandidate[] {
  const candidates = listed
    .filter((u) => u.id !== selfId)
    .map((u) => ({ id: u.id, name: u.name }));

  if (
    boundManager &&
    boundManager.id !== selfId &&
    !candidates.some((c) => c.id === boundManager.id)
  ) {
    candidates.unshift({ id: boundManager.id, name: boundManager.name });
  }

  return candidates;
}
