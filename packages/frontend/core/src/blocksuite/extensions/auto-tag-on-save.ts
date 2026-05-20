/**
 * Auto-tag-on-save lifecycle hook.
 *
 * This is NOT a BlockSuite editor extension — it's a thin React-side
 * hook that observes a doc's edit activity via Yjs block-update slots
 * and, when the doc settles into a "saved" state (no edits for N ms),
 * decides whether to kick off the Auto Tag agent.
 *
 * Decision rules:
 *   1. Feature flag `enable_auto_tag_on_save` must be on.
 *   2. The doc must have ZERO tags currently (we don't pile on).
 *   3. The doc's markdown body must be >200 chars after extraction
 *      (short notes don't carry enough signal for useful tags).
 *   4. The doc must not already be in-flight for this session — we
 *      use a per-docId guard so re-edits don't spam suggestions.
 *
 * Trigger: debounced 4s after the last `blockUpdated` event on the
 * doc's store. We deliberately do NOT trigger on every keystroke;
 * the goal is "the user paused" not "the user typed".
 *
 * Failure mode: any thrown exception inside the agent is logged and
 * swallowed. Auto-tag is best-effort; it must NEVER break the editor.
 */

import type {
  EventSourceService,
  GraphQLService,
} from '@affine/core/modules/cloud';
import type { DocService } from '@affine/core/modules/doc';
import type { TagService } from '@affine/core/modules/tag';
import type { WorkspaceService } from '@affine/core/modules/workspace';

import { runAutoTag, showAutoTagToast } from '../../components/auto-tag';

interface AutoTagOnSaveDeps {
  workspace: WorkspaceService;
  docService: DocService;
  tagService: TagService;
  graphqlService: GraphQLService;
  eventSourceService: EventSourceService;
  enabled: boolean;
}

/** Minimum body length (chars) before we bother asking the AI. */
const MIN_BODY_CHARS = 200;
/** How long the doc must be idle before we trigger. */
const DEBOUNCE_MS = 4000;

// Per-session guard so we don't re-suggest the same doc repeatedly
// after a refresh-and-edit cycle. The guard intentionally lives on the
// module so multiple subscriptions in the same SPA load share it.
const proposedDocs = new Set<string>();

/**
 * Subscribe to the current doc's edits and run the auto-tag agent
 * after the doc settles. Returns a teardown function — call it from
 * the consumer's cleanup (e.g. React `useEffect` return).
 */
export function subscribeAutoTagOnSave(deps: AutoTagOnSaveDeps): () => void {
  if (!deps.enabled) return () => {};

  const doc = deps.docService.doc;
  const docId = doc.id;

  // Defensive: if the doc has tags already we never fire. Re-checked
  // inside the debounce too in case tags get added between subscribe
  // and trigger.
  const currentTagIds = deps.tagService.tagList.tagIdsByPageId$(docId).value;
  if (currentTagIds.length > 0) return () => {};
  if (proposedDocs.has(docId)) return () => {};

  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  const trigger = async () => {
    if (disposed) return;
    // Re-check tag state at trigger time — the user might have added
    // tags during the debounce window.
    if (deps.tagService.tagList.tagIdsByPageId$(docId).value.length > 0) {
      return;
    }
    if (proposedDocs.has(docId)) return;

    const title = doc.title$.value || 'Untitled';

    // Extract markdown body. Same pattern as the manual button path
    // (CLAUDE.md §6c "Reading doc body markdown without an editor host").
    let bodyMarkdown = '';
    try {
      const store = doc.blockSuiteDoc.getStore();
      if (store) {
        const transformer = store.getTransformer();
        const { MarkdownAdapter } =
          await import('@blocksuite/affine/shared/adapters');
        const adapter = new MarkdownAdapter(transformer, store.provider);
        const extracted = await adapter.fromDoc(store);
        bodyMarkdown = extracted?.file ?? '';
      }
    } catch (err) {
      // Extraction failure must not block the editor or surface a toast.
      console.warn('auto-tag-on-save: markdown extraction failed', err);
      return;
    }

    if (bodyMarkdown.length < MIN_BODY_CHARS) return;

    // Mark proposed BEFORE the network round-trip so a fast re-trigger
    // (user re-edits before the AI returns) can't duplicate-fire.
    proposedDocs.add(docId);

    try {
      const existingTags = deps.tagService.tagList.tagMetas$.value
        .map(t => t.name)
        .filter(Boolean);
      const { candidates } = await runAutoTag({
        workspaceId: deps.workspace.workspace.id,
        docId,
        title,
        bodyMarkdown,
        existingTags,
        graphqlService: deps.graphqlService,
        eventSourceService: deps.eventSourceService,
      });
      if (disposed) return;
      if (candidates.length === 0) return;

      showAutoTagToast({
        candidates,
        docId,
        tagService: deps.tagService,
        onAccepted: () => {
          // Keep proposedDocs marked so accepting then editing again
          // doesn't re-fire on the same doc.
        },
      });
    } catch (err) {
      // Best-effort: log and move on. Don't surface an error toast for
      // an auto-flow the user didn't ask for.
      console.warn('auto-tag-on-save: agent failed', err);
    }
  };

  const onUpdated = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      trigger().catch(err => {
        // trigger() already catches its own runtime errors; this is a
        // belt-and-braces guard for synchronous throws inside the
        // setTimeout callback (e.g. import-time errors on the dynamic
        // MarkdownAdapter import). Logged, never surfaced.
        console.warn('auto-tag-on-save: trigger threw', err);
      });
    }, DEBOUNCE_MS);
  };

  // Hook into the BlockSuite store's blockUpdated slot. The slot fires
  // on every block insert/update/delete, which is the right granularity:
  // any edit resets the debounce window.
  const store = doc.blockSuiteDoc.getStore();
  const subscription = store?.slots?.blockUpdated?.subscribe(onUpdated);

  return () => {
    disposed = true;
    if (timer) clearTimeout(timer);
    subscription?.unsubscribe();
  };
}

/**
 * Test-only: clear the per-session proposed-docs guard.
 * Not exported from the package index — for in-repo specs only.
 */
export function _clearProposedDocsForTest(): void {
  proposedDocs.clear();
}
