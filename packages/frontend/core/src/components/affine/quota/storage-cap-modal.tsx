import { ConfirmModal } from '@affine/component/ui/modal';
import { useCallback, useMemo } from 'react';

const BYTES_PER_GB = 1024 ** 3;

/**
 * Props for {@link StorageCapModal}.
 *
 * The modal is purely presentational: parents control open/close state
 * and the upgrade trigger. `currentBytes` / `capBytes` come from the
 * structured `STORAGE_CAP` error payload thrown by the backend (see
 * `QuotaService.assertStorageCap` and
 * `core/quota/service.ts#storageCapMessage` for the wire shape).
 */
export interface StorageCapModalProps {
  open: boolean;
  currentBytes: number;
  capBytes: number;
  onClose: () => void;
  onUpgrade: () => void;
}

/**
 * Formats bytes as a GB string with one decimal place.
 * Examples:
 *   formatGb(2 * 1024 ** 3) → "2.0"
 *   formatGb(1.5 * 1024 ** 3) → "1.5"
 *   formatGb(100 * 1024 ** 3) → "100.0"
 */
function formatGb(bytes: number): string {
  const gb = bytes / BYTES_PER_GB;
  return gb.toFixed(1);
}

/**
 * MANUT Wave 2 (T-1.1.5.c): Storage-cap upsell modal.
 *
 * Surfaces when a blob upload is rejected because the workspace storage
 * usage exceeds the Free tier's 2 GB cap. The "Upgrade to Pro" button
 * is a placeholder for now — the real billing/checkout flow ships in
 * E3.3 (Month 3, decision #19). Until then, `onUpgrade` should
 * surface a friendly "coming soon" toast or scroll the user to the
 * relevant Settings panel.
 *
 * Copy follows IMPLEMENTATION_PLAN §0.3: "You've used X GB of free
 * storage. Upgrade to Pro for 100 GB."
 */
export function StorageCapModal({
  open,
  currentBytes,
  capBytes,
  onClose,
  onUpgrade,
}: StorageCapModalProps): React.ReactElement {
  const description = useMemo(() => {
    const usedGb = formatGb(currentBytes);
    const capGb = formatGb(capBytes);
    return `You've used ${usedGb} GB of ${capGb} GB free storage. Upgrade to Pro for 100 GB.`;
  }, [currentBytes, capBytes]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        onClose();
      }
    },
    [onClose]
  );

  const handleConfirm = useCallback(() => {
    // E3.3 (M3) wires this to the real Stripe checkout flow. For now,
    // delegate to the parent so consumers can show a "coming soon"
    // toast or route to a Settings billing panel placeholder.
    onUpgrade();
  }, [onUpgrade]);

  return (
    <ConfirmModal
      open={open}
      onOpenChange={handleOpenChange}
      title="Storage limit reached"
      description={description}
      confirmText="Upgrade to Pro"
      cancelText="Not now"
      onConfirm={handleConfirm}
      onCancel={onClose}
      confirmButtonOptions={{
        variant: 'primary',
        ['data-testid' as string]: 'storage-cap-upgrade-button',
      }}
      contentOptions={{
        ['data-testid' as string]: 'storage-cap-modal',
      }}
    />
  );
}
