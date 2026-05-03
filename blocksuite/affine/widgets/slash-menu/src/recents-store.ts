/**
 * Recents store for slash menu.
 *
 * Tracks the last N picked slash-menu commands per user, persisted in
 * localStorage. Items are identified by their `name` field (slash-menu
 * items don't have a stable id, but names are unique within a config).
 *
 * Returned from `getRecents()` ordered most-recent-first.
 */

const STORAGE_KEY = 'affine.slash-menu.recents.v1';
const MAX_RECENTS = 5;

function safeStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

function read(): string[] {
  const storage = safeStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === 'string');
  } catch {
    return [];
  }
}

function write(ids: string[]): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Quota / disabled storage — silently ignore.
  }
}

export const slashMenuRecentsStore = {
  /**
   * Record a pick. Moves `id` to the front of the recents list and trims to
   * `MAX_RECENTS` entries.
   */
  pick(id: string): void {
    if (!id) return;
    const current = read().filter(existing => existing !== id);
    current.unshift(id);
    write(current.slice(0, MAX_RECENTS));
  },

  /**
   * Returns recent ids, most-recent-first, capped at `MAX_RECENTS`.
   */
  getRecents(): string[] {
    return read().slice(0, MAX_RECENTS);
  },

  /**
   * Clear all recents. Exposed for tests / settings reset.
   */
  clear(): void {
    const storage = safeStorage();
    if (!storage) return;
    try {
      storage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  },
};
