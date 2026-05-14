import { Button, Modal } from '@affine/component';
import { useI18n } from '@affine/i18n';
import type { ReactNode } from 'react';
import { useCallback } from 'react';

import * as styles from './styles.css';

/**
 * Shared side-drawer that hosts the per-entity detail bodies.
 *
 * We reuse the Modal primitive with the built-in `slideRight` animation
 * so this looks like a right-side drawer without dragging in a separate
 * dependency. The internal layout (header / body / actions) is consistent
 * across all four entity types — the per-entity files supply the body
 * content and an `actions` slot via the `onEdit` / `onDelete` props.
 */
export interface DetailPanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string | null;
  /** Optional Edit action shown next to the close button. */
  onEdit?: () => void;
  /**
   * Optional Delete action. The backend currently exposes no `delete*`
   * mutations for any CRM entity — this prop exists so callers can wire
   * delete later without another structural change. When omitted the
   * trash button is hidden.
   */
  onDelete?: () => void;
  /** Disabled when a mutation is in flight. */
  busy?: boolean;
  children: ReactNode;
  /** data-testid override so caller tests can find the right panel. */
  testId?: string;
}

export const DetailPanel = ({
  open,
  onClose,
  title,
  subtitle,
  onEdit,
  onDelete,
  busy,
  children,
  testId,
}: DetailPanelProps) => {
  const t = useI18n();

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) onClose();
    },
    [onClose]
  );

  return (
    <Modal
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      description={subtitle ?? undefined}
      animation="slideRight"
      width={420}
      contentOptions={{ 'data-testid': testId ?? 'crm-detail-panel' }}
    >
      {/* Header row sits ABOVE the body fields. The Modal primitive
          already renders the i18n title + close button; this header
          carries the action buttons (Edit / Delete) only. */}
      <div className={styles.detailHeader}>
        <span />
        <div className={styles.detailActions}>
          {onEdit ? (
            <Button
              onClick={onEdit}
              disabled={busy}
              data-testid="crm-detail-edit"
            >
              {t['com.manut.crm.action.edit']()}
            </Button>
          ) : null}
          {onDelete ? (
            <Button
              onClick={onDelete}
              disabled={busy}
              className={styles.dangerButton}
              data-testid="crm-detail-delete"
            >
              {t['com.manut.crm.action.delete']()}
            </Button>
          ) : null}
        </div>
      </div>
      <div className={styles.detailPanel}>{children}</div>
    </Modal>
  );
};

/**
 * Helper for rendering a labelled field inside a detail panel. Renders the
 * "—" placeholder when value is null/empty so the panel doesn't look
 * broken on records with missing fields.
 */
export const DetailField = ({
  label,
  value,
  testId,
}: {
  label: string;
  value: string | null | undefined;
  testId?: string;
}) => {
  return (
    <div className={styles.detailSection} data-testid={testId}>
      <span className={styles.detailLabel}>{label}</span>
      {value && value.trim().length > 0 ? (
        <span className={styles.detailValue}>{value}</span>
      ) : (
        <span className={styles.detailEmpty}>—</span>
      )}
    </div>
  );
};
