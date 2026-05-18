import type {
  MnWorkProductDto,
  MnWorkProductKind,
} from '@affine/core/modules/manut-pm';
import {
  AttachmentIcon,
  CloudWorkspaceIcon,
  EdgelessIcon,
  FileIcon,
  LinkIcon,
  PageIcon,
} from '@blocksuite/icons/rc';
import type { ReactNode } from 'react';
import { useCallback, useMemo } from 'react';

import * as styles from './work-products-panel.css';

interface WorkProductsPanelProps {
  /**
   * List of work products attributed to the current task, newest first.
   * `null` is the "still loading" / "haven't queried yet" state and
   * renders a quiet empty marker rather than nothing — keeps the task
   * detail layout from jumping when the query resolves.
   */
  workProducts: MnWorkProductDto[] | null;
  /**
   * Optional click handler. Receives the full DTO so the caller can
   * decide where to route the user (open the doc, jump to the PR,
   * download the file, etc.). When omitted the action column renders
   * a plain anchor for URL-like kinds and is hidden for the rest.
   */
  onOpen?: (workProduct: MnWorkProductDto) => void;
}

/**
 * Read-only listing of the work products a task has produced. Each
 * row shows a kind-specific icon, the title (or a derived fallback),
 * the ref, optional byte size, and an Open action.
 *
 * Visual state and animations live in the `.css.ts` sibling — keep
 * `style({})` out of this file (CLAUDE.md vanilla-extract scar).
 */
export const WorkProductsPanel = ({
  workProducts,
  onOpen,
}: WorkProductsPanelProps) => {
  const handleOpen = useCallback(
    (wp: MnWorkProductDto) => () => {
      if (onOpen) {
        onOpen(wp);
        return;
      }
      // Fallback: open URL-like refs in a new tab. For DOC / FILE /
      // SCREENSHOT we expect the caller to provide a real handler —
      // those refs aren't directly browsable.
      if (wp.kind === 'URL' || wp.kind === 'PR' || wp.kind === 'DEPLOYMENT') {
        window.open(wp.ref, '_blank', 'noopener,noreferrer');
      }
    },
    [onOpen]
  );

  const count = workProducts?.length ?? 0;
  const sortedProducts = useMemo(() => {
    if (!workProducts) return [];
    // Defensive: re-sort newest first in case the caller fed us an
    // unsorted list. The backend already orders by createdAt DESC.
    return [...workProducts].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
  }, [workProducts]);

  if (workProducts === null) {
    return (
      <div
        className={styles.panelRoot}
        data-testid="work-products-panel-loading"
      >
        <div className={styles.panelHeader}>
          <span>Work products</span>
        </div>
        <div className={styles.emptyState}>Loading…</div>
      </div>
    );
  }

  if (count === 0) {
    return (
      <div className={styles.panelRoot} data-testid="work-products-panel-empty">
        <div className={styles.panelHeader}>
          <span>Work products</span>
        </div>
        <div className={styles.emptyState}>
          No work products yet — outputs attributed to this task will appear
          here.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.panelRoot} data-testid="work-products-panel">
      <div className={styles.panelHeader}>
        <span>Work products</span>
        <span className={styles.panelCount}>{count}</span>
      </div>
      <div className={styles.productList}>
        {sortedProducts.map(wp => (
          <WorkProductRow
            key={wp.id}
            workProduct={wp}
            onOpen={handleOpen(wp)}
          />
        ))}
      </div>
    </div>
  );
};

interface WorkProductRowProps {
  workProduct: MnWorkProductDto;
  onOpen: () => void;
}

const WorkProductRow = ({ workProduct, onOpen }: WorkProductRowProps) => {
  const { kind, ref, title, description, byteSize } = workProduct;
  const displayTitle = title?.trim() || deriveTitle(workProduct);
  const metaSize = formatByteSize(byteSize);
  return (
    <div
      className={styles.productRow}
      data-testid={`work-product-row-${kind.toLowerCase()}`}
    >
      <span className={styles.productIcon} data-kind={kind} aria-hidden>
        {kindIcon(kind)}
      </span>
      <div className={styles.productBody}>
        <span className={styles.productTitle} title={displayTitle}>
          {displayTitle}
        </span>
        <span className={styles.productMeta}>
          <span className={styles.productKindBadge}>{kind}</span>
          <span title={ref}>{description?.trim() || ref}</span>
          {metaSize ? <span>· {metaSize}</span> : null}
        </span>
      </div>
      <button
        type="button"
        className={styles.productAction}
        onClick={onOpen}
        data-testid="work-product-open"
      >
        Open
      </button>
    </div>
  );
};

/**
 * Kind-specific icon picker. We use BlockSuite's icon set so the panel
 * matches the rest of the AFFiNE chrome. CloudWorkspaceIcon stands in
 * for DEPLOYMENT, EdgelessIcon for SCREENSHOT — the icon library
 * doesn't ship dedicated ones for those two kinds.
 */
function kindIcon(kind: MnWorkProductKind): ReactNode {
  switch (kind) {
    case 'DOC':
      return <PageIcon />;
    case 'FILE':
      return <AttachmentIcon />;
    case 'URL':
      return <LinkIcon />;
    case 'PR':
      return <FileIcon />;
    case 'DEPLOYMENT':
      return <CloudWorkspaceIcon />;
    case 'CSV':
      return <FileIcon />;
    case 'SCREENSHOT':
      return <EdgelessIcon />;
    default:
      return <FileIcon />;
  }
}

function deriveTitle(wp: MnWorkProductDto): string {
  switch (wp.kind) {
    case 'URL':
      return wp.ref;
    case 'PR':
      return `PR ${wp.ref}`;
    case 'DEPLOYMENT':
      return `Deployment ${wp.ref}`;
    case 'DOC':
      return wp.ref ? `Doc ${wp.ref}` : 'Untitled doc';
    default:
      return wp.ref || 'Untitled artifact';
  }
}

function formatByteSize(size: number | null): string | null {
  if (size === null || size === undefined) return null;
  if (size < 0) return null;
  if (size < 1024) return `${size} B`;
  const kb = size / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}
