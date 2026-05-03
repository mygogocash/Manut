import { slashMenuRecentsStore } from './recents-store';
import type {
  SlashMenuActionItem,
  SlashMenuConfig,
  SlashMenuContext,
  SlashMenuItem,
  SlashMenuSubMenu,
} from './types';

export const RECENT_GROUP_NAME = 'Recent';
// Use a synthetic group prefix that sorts BEFORE any real group (which start at 1+).
// Format must match the `${number}_${string}@${number}` template.
const RECENT_GROUP_PREFIX = '0_Recent';

export function isActionItem(item: SlashMenuItem): item is SlashMenuActionItem {
  return 'action' in item;
}

export function isSubMenuItem(item: SlashMenuItem): item is SlashMenuSubMenu {
  return 'subMenu' in item;
}

/**
 * Fuzzy subsequence scorer.
 *
 * Returns a score in [0, ∞) (higher is better). Returns 0 when query is not
 * a subsequence of name (case-insensitive, ignoring spaces in the haystack).
 *
 * Heuristics applied (additive bonuses):
 *   - prefix match (query starts at index 0 of name)
 *   - consecutive runs of matched chars (vs. spaced matches)
 *   - matches on word boundaries (start of word / after space)
 *   - shorter names with same match score rank higher
 *
 * Examples:
 *   score("Heading 2", "h2")      → high (acronym, both on word boundary)
 *   score("Heading 1", "h2")      → 0 (no '2' in name)
 *   score("Header", "h2")         → 0
 *   score("Heading 2", "heading") → highest (full prefix substring)
 */
export function fuzzyScore(name: string, query: string): number {
  if (!query) return 0;
  if (!name) return 0;
  const haystack = name.toLowerCase();
  const needle = query.toLowerCase().replace(/\s+/g, '');
  if (!needle) return 0;

  let score = 0;
  let nameIdx = 0;
  let lastMatchIdx = -2;
  let consecutive = 0;

  for (let q = 0; q < needle.length; q++) {
    const ch = needle[q];
    let found = -1;
    for (let i = nameIdx; i < haystack.length; i++) {
      if (haystack[i] === ch) {
        found = i;
        break;
      }
    }
    if (found === -1) return 0;

    // Base point per matched char.
    score += 1;

    // Word-boundary bonus: matched at index 0 or right after a space.
    if (found === 0 || haystack[found - 1] === ' ') {
      score += 2;
    }

    // Consecutive-match bonus: rewards "h2" → "**h**eading **2**" less than
    // "he" → "**he**ading", encouraging runs.
    if (found === lastMatchIdx + 1) {
      consecutive += 1;
      score += 2 + consecutive;
    } else {
      consecutive = 0;
    }

    // Prefix bonus: first query char matched at start of haystack.
    if (q === 0 && found === 0) {
      score += 3;
    }

    lastMatchIdx = found;
    nameIdx = found + 1;
  }

  // Length penalty: prefer concise names. Apply gently so it doesn't dominate.
  score += 1 / (1 + haystack.length);

  return score;
}

/**
 * Best fuzzy score across name + searchAlias.
 */
export function fuzzyScoreItem(
  item: Pick<SlashMenuItem, 'name' | 'searchAlias'>,
  query: string
): number {
  let best = fuzzyScore(item.name, query);
  for (const alias of item.searchAlias ?? []) {
    const s = fuzzyScore(alias, query);
    if (s > best) best = s;
  }
  return best;
}

/**
 * Build a synthetic "Recent" group from recents-store + the live item list.
 * Only items currently visible (after `when()` filtering) are surfaced —
 * stale ids are skipped, not errored on.
 *
 * Returns clones of the matched items with their `group` rewritten so they
 * cluster at the top of the menu.
 */
export function buildRecentGroupItems(
  visibleTopLevelItems: SlashMenuItem[]
): SlashMenuItem[] {
  const ids = slashMenuRecentsStore.getRecents();
  if (ids.length === 0) return [];

  const byName = new Map<string, SlashMenuItem>();
  for (const item of visibleTopLevelItems) {
    byName.set(item.name, item);
  }

  const out: SlashMenuItem[] = [];
  ids.forEach((id, index) => {
    const found = byName.get(id);
    if (!found) return;
    out.push({
      ...found,
      group: `${RECENT_GROUP_PREFIX}@${index}` as SlashMenuItem['group'],
    });
  });
  return out;
}

/**
 * Record a slash-menu pick into the recents store. Safe no-op for falsy ids.
 */
export function recordSlashMenuPick(name: string | undefined): void {
  if (!name) return;
  slashMenuRecentsStore.pick(name);
}

export function slashItemClassName({ name }: SlashMenuItem) {
  return name.split(' ').join('-').toLocaleLowerCase();
}

export function parseGroup(group: NonNullable<SlashMenuItem['group']>) {
  return [
    parseInt(group.split('_')[0]),
    group.split('_')[1].split('@')[0],
    parseInt(group.split('@')[1]),
  ] as const;
}

function itemCompareFn(a: SlashMenuItem, b: SlashMenuItem) {
  if (a.group === undefined && b.group === undefined) return 0;
  if (a.group === undefined) return -1;
  if (b.group === undefined) return 1;

  const [aGroupIndex, aGroupName, aItemIndex] = parseGroup(a.group);
  const [bGroupIndex, bGroupName, bItemIndex] = parseGroup(b.group);
  if (isNaN(aGroupIndex)) return -1;
  if (isNaN(bGroupIndex)) return 1;
  if (aGroupIndex < bGroupIndex) return -1;
  if (aGroupIndex > bGroupIndex) return 1;

  if (aGroupName !== bGroupName) return aGroupName.localeCompare(bGroupName);

  if (isNaN(aItemIndex)) return -1;
  if (isNaN(bItemIndex)) return 1;

  return aItemIndex - bItemIndex;
}

export function buildSlashMenuItems(
  items: SlashMenuItem[],
  context: SlashMenuContext,
  transform?: (item: SlashMenuItem) => SlashMenuItem,
  options: { includeRecents?: boolean } = {}
): SlashMenuItem[] {
  if (transform) items = items.map(transform);

  const filtered = items.filter(item =>
    item.when ? item.when(context) : true
  );

  // Top-level call: prepend a synthetic "Recent" group so daily users land on
  // their last-picked block first. Recursive calls (sub-menus) skip this.
  const withRecents =
    options.includeRecents !== false
      ? [...buildRecentGroupItems(filtered), ...filtered]
      : filtered;

  const result = withRecents.sort(itemCompareFn).map(item => {
    if (isSubMenuItem(item)) {
      return {
        ...item,
        // Sub-menu items never get a recents block themselves.
        subMenu: buildSlashMenuItems(item.subMenu, context, undefined, {
          includeRecents: false,
        }),
      };
    } else {
      return { ...item };
    }
  });
  return result;
}

export function mergeSlashMenuConfigs(
  configs: Map<string, SlashMenuConfig>
): SlashMenuConfig {
  return {
    items: ctx =>
      Array.from(configs.values()).flatMap(({ items }) =>
        typeof items === 'function' ? items(ctx) : items
      ),
    disableWhen: ctx =>
      configs
        .values()
        .map(({ disableWhen }) => disableWhen?.(ctx) ?? false)
        .some(Boolean),
  };
}

export function formatDate(date: Date) {
  // yyyy-mm-dd
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const strTime = `${year}-${month}-${day}`;
  return strTime;
}

export function formatTime(date: Date) {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const strTime = `${formatDate(date)} ${hours}:${minutes}`;
  return strTime;
}
