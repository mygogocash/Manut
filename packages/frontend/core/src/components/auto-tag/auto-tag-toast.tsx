/**
 * Bottom-toast UI for the auto-tag-on-save flow.
 *
 * Style note: we deliberately reuse the existing `notify(...)` toast
 * surface rather than introducing a new dialog or sticky panel — that
 * keeps the auto-tag suggestion non-intrusive, and the user can dismiss
 * with a single click without losing focus on the editor.
 *
 * Actions:
 *   - **Accept all** — adds all candidates as tags via TagService.
 *   - **Dismiss** — drops the suggestion (toast close).
 *
 * "Pick" would require a multi-select picker mid-toast which is too
 * heavyweight for a non-intrusive surface; users who want fine-grained
 * control can use the existing manual "AI Auto Tag" button on the
 * property panel. Documented trade-off; reversible.
 */

import { notify } from '@affine/component';
import type { TagService } from '@affine/core/modules/tag';

interface ShowToastArgs {
  candidates: string[];
  docId: string;
  tagService: TagService;
  onAccepted?: () => void;
}

function formatPreview(names: string[], max = 3): string {
  if (names.length <= max) return names.join(', ');
  return `${names.slice(0, max).join(', ')} and ${names.length - max} more`;
}

/**
 * Apply a list of tag names to a doc. Reuses existing tags when their
 * name matches case-insensitively; creates new ones otherwise.
 *
 * Returns the names that were applied (existing matches + new) and the
 * subset that were freshly created. Names already on the doc are
 * skipped silently.
 */
export function applyTagsToDoc(
  names: string[],
  docId: string,
  tagService: TagService
): { applied: string[]; created: string[] } {
  const allTagMetas = tagService.tagList.tagMetas$.value;
  const currentTagIds = tagService.tagList.tagIdsByPageId$(docId).value;
  const tagColorsList = tagService.tagColors;

  const applied: string[] = [];
  const created: string[] = [];

  for (const name of names) {
    const lower = name.toLowerCase();
    const existing = allTagMetas.find(t => t.name.toLowerCase() === lower);
    if (existing) {
      if (currentTagIds.includes(existing.id)) continue;
      const tagInstance = tagService.tagList.tagByTagId$(existing.id).value;
      if (tagInstance) {
        tagInstance.tag(docId);
        applied.push(existing.name);
      }
      continue;
    }
    // Defensive index access — tagColorsList items are [name, value]
    // tuples; if upstream changes the shape, fall back to a sane default.
    const tuple =
      tagColorsList[Math.floor(Math.random() * tagColorsList.length)] ??
      tagColorsList[0];
    const color = tuple?.[1] ?? '#888';
    const newTag = tagService.tagList.createTag(name, color);
    newTag.tag(docId);
    created.push(name);
    applied.push(name);
  }

  return { applied, created };
}

/**
 * Show the suggestion toast. Returns the toast id so callers can dismiss
 * programmatically if the doc loses focus / unmounts.
 */
export function showAutoTagToast({
  candidates,
  docId,
  tagService,
  onAccepted,
}: ShowToastArgs): string | number | null {
  if (candidates.length === 0) return null;

  const preview = formatPreview(candidates);

  return notify(
    {
      title: 'AI suggests tags',
      message: `Found ${candidates.length}: ${preview}`,
      actions: [
        {
          key: 'accept-all',
          label: 'Accept all',
          onClick: () => {
            const { applied, created } = applyTagsToDoc(
              candidates,
              docId,
              tagService
            );
            if (applied.length > 0) {
              const newSuffix =
                created.length > 0 ? ` (${created.length} new)` : '';
              notify.success({
                title: 'AI Auto Tag',
                message: `Added ${applied.length} tag${applied.length === 1 ? '' : 's'}: ${formatPreview(applied)}${newSuffix}`,
              });
            }
            onAccepted?.();
          },
        },
        {
          key: 'dismiss',
          label: 'Dismiss',
          onClick: () => {
            // No-op; the toast auto-closes when an action button fires.
          },
        },
      ],
    },
    // Suggestion toasts deserve more time than a generic success — the
    // user might be mid-keystroke when it appears.
    { duration: 12000 }
  );
}
