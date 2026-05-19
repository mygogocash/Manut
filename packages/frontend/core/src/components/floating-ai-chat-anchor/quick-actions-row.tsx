import {
  getQuickActionsFor,
  type QuickAction,
  type QuickActionDocType,
} from '@affine/core/blocksuite/ai/quick-actions';
import { useCallback, useMemo } from 'react';

import * as styles from './quick-actions-row.css';
import {
  type CurrentDocContext,
  useCurrentDocContext,
} from './use-current-doc-context';

interface QuickActionsRowProps {
  // Click handler the parent (FloatingAiChatAnchorBody) wires up to push
  // the prompt into the chat input and submit. Kept as a callback rather
  // than a direct AIProvider call so the parent can decide whether to
  // submit immediately or just prefill — different surfaces may want
  // different UX.
  onSelect: (action: QuickAction) => void;
}

// Map the lightweight `CurrentDocContext.docType` (only knows "page" vs
// "edgeless") to the richer `QuickActionDocType` union the templates
// registry keys off. Defaults to "affine:page" because that's the most
// common doc shape; callers that want a specific surface (meeting,
// database, code block) should pass that through explicitly once we
// have a richer context shape to read from.
function mapDocTypeToQuickActionType(
  docContext: CurrentDocContext | null
): QuickActionDocType | null {
  if (!docContext) return null;
  if (docContext.docType === 'edgeless') return 'affine:edgeless';
  return 'affine:page';
}

/**
 * Empty-state quick-action chips for the floating chat panel. Rendered
 * when the chat session has no messages yet so the user can kick off
 * a per-doc-type starter prompt without typing anything.
 *
 * v1 caps the row at 4 visible chips and falls back to the page-doc
 * defaults when the current doc type isn't registered in the
 * templates map. The row hides entirely when there's no active doc
 * context (e.g. on /all, /collection routes).
 */
export const QuickActionsRow = ({ onSelect }: QuickActionsRowProps) => {
  const docContext = useCurrentDocContext();
  const docType = useMemo(
    () => mapDocTypeToQuickActionType(docContext),
    [docContext]
  );

  const actions = useMemo(() => {
    if (!docType) return undefined;
    return getQuickActionsFor(docType);
  }, [docType]);

  // Stable click factory so each chip's handler doesn't churn between
  // renders. We pass the QuickAction itself so the parent decides
  // whether to use `label` or `prompt` (or both).
  const handleClick = useCallback(
    (action: QuickAction) => () => {
      onSelect(action);
    },
    [onSelect]
  );

  if (!actions || actions.length === 0) return null;

  // Take at most 4 chips. The templates registry caps doc types at
  // 3–4 by design, but keep the slice in case a future addition grows.
  const visibleActions = actions.slice(0, 4);

  return (
    <div className={styles.row} data-testid="floating-ai-chat-quick-actions">
      <div className={styles.label}>Suggestions</div>
      <div className={styles.chips}>
        {visibleActions.map(action => (
          <button
            key={action.label}
            type="button"
            className={styles.chip}
            onClick={handleClick(action)}
            data-testid="floating-ai-chat-quick-action"
            title={action.prompt}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
};
