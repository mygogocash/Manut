import { Modal } from '@affine/component';
import { useCallback, useState } from 'react';

import type { SocialPlatform } from '../../entities/analytics-data.entity';
import type { PendingAccountChoice } from '../../services/connection.service';
import * as styles from './account-picker-modal.css';

export interface AccountPickerModalProps {
  open: boolean;
  platform: SocialPlatform;
  /** Backend has already capped at 50 + sanitised both fields. */
  accounts: PendingAccountChoice[];
  /**
   * Resolves to true if the finalize succeeded; the modal closes itself in
   * that case. On failure the caller's promise should REJECT so we can
   * surface the error inline and stay open for retry.
   */
  onConfirm: (externalAccountId: string) => Promise<void>;
  onCancel: () => void;
}

const PLATFORM_LABEL: Record<SocialPlatform, string> = {
  FACEBOOK: 'Facebook Page',
  INSTAGRAM: 'Instagram Business Account',
  THREADS: 'Threads Profile',
  TIKTOK: 'TikTok Account',
  LINE_VOOM: 'LINE VOOM Account',
  GOGOCASH: 'GoGoCash',
};

/**
 * Picker shown after a Meta OAuth flow returns multiple accessible accounts.
 * The backend skips this entirely for `accounts.length === 1` (auto-finalize)
 * and `accounts.length === 0` (clear error). So this component always sees
 * 2+ rows.
 */
export function AccountPickerModal({
  open,
  platform,
  accounts,
  onConfirm,
  onCancel,
}: AccountPickerModalProps) {
  // Default to first row so Confirm is reachable without a click on small
  // lists. Keyed on accounts identity so the selection resets if the modal
  // is reused for a different OAuth flow.
  const [selectedId, setSelectedId] = useState<string | null>(
    accounts[0]?.externalAccountId ?? null
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleConfirm = useCallback(async () => {
    if (!selectedId || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(selectedId);
      // Caller closes the modal by flipping `open` to false.
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to connect the selected account. Please try again.'
      );
    } finally {
      setBusy(false);
    }
  }, [busy, onConfirm, selectedId]);

  const handleDismiss = useCallback(
    (next: boolean) => {
      if (next) return;
      if (busy) return; // ignore Esc / backdrop clicks while in-flight
      onCancel();
    },
    [busy, onCancel]
  );

  return (
    <Modal
      open={open}
      onOpenChange={handleDismiss}
      width={420}
      title={`Choose an ${PLATFORM_LABEL[platform] ?? 'account'}`}
      description="The Meta account you signed in with has access to multiple accounts. Pick the one you want to connect to this workspace."
      persistent={busy}
      data-testid="analytics-account-picker-modal"
    >
      <div
        className={styles.list}
        role="radiogroup"
        aria-label="Pick an account"
      >
        {accounts.map(account => {
          const checked = account.externalAccountId === selectedId;
          return (
            <label
              key={account.externalAccountId}
              className={styles.row}
              data-selected={checked}
              data-disabled={busy}
              data-testid={`analytics-account-picker-row-${account.externalAccountId}`}
            >
              <input
                type="radio"
                name="analytics-account-picker"
                className={styles.radio}
                value={account.externalAccountId}
                checked={checked}
                disabled={busy}
                onChange={() => setSelectedId(account.externalAccountId)}
              />
              <div className={styles.accountMain}>
                <span className={styles.accountName}>
                  {account.externalAccountName}
                </span>
                <span className={styles.accountId}>
                  ID: {account.externalAccountId}
                </span>
              </div>
            </label>
          );
        })}
      </div>
      {error ? (
        <div className={styles.errorBanner} role="alert">
          {error}
        </div>
      ) : null}
      <div className={styles.footer}>
        <button
          type="button"
          className={styles.button}
          onClick={onCancel}
          disabled={busy}
          data-testid="analytics-account-picker-cancel"
        >
          Cancel
        </button>
        <button
          type="button"
          className={`${styles.button} ${styles.buttonPrimary}`}
          onClick={() => void handleConfirm()}
          disabled={busy || !selectedId}
          data-testid="analytics-account-picker-confirm"
        >
          {busy ? 'Connecting…' : 'Connect'}
        </button>
      </div>
    </Modal>
  );
}
