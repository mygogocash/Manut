import { Button, Input, Modal, notify } from '@affine/component';
import { useMutation } from '@affine/core/components/hooks/use-mutation';
import { useI18n } from '@affine/i18n';
import { useCallback, useState } from 'react';

import {
  type MnCrmAccount,
  type UpdateMnCrmAccountInput,
  updateMnCrmAccountMutation,
  type UpdateMnCrmAccountResponse,
} from '../../../../modules/manut-crm';
import * as styles from './styles.css';

interface AccountEditModalProps {
  account: MnCrmAccount;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/**
 * Trim a string and return null when empty. Treats whitespace-only input
 * as "user cleared the field" — server will store NULL.
 */
function trimToNull(input: string): string | null {
  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export const AccountEditModal = ({
  account,
  onClose,
  onSaved,
}: AccountEditModalProps) => {
  const t = useI18n();
  // Initialize from the source record so the modal feels like a normal
  // edit form. Cancelling discards by closing without firing onSaved.
  const [name, setName] = useState(account.name);
  const [industry, setIndustry] = useState(account.industry ?? '');
  const [website, setWebsite] = useState(account.website ?? '');
  const [notes, setNotes] = useState(account.notes ?? '');
  const [submitting, setSubmitting] = useState(false);

  const { trigger } = useMutation({ mutation: updateMnCrmAccountMutation });

  const canSubmit = name.trim().length > 0 && !submitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const input: UpdateMnCrmAccountInput = {
        name: name.trim(),
        industry: trimToNull(industry),
        website: trimToNull(website),
        notes: trimToNull(notes),
      };
      const response = (await (trigger as (args: unknown) => Promise<unknown>)({
        accountId: account.id,
        input,
      })) as UpdateMnCrmAccountResponse;
      if (!response?.updateMnCrmAccount) {
        throw new Error('Account update returned no record');
      }
      notify.success({ title: t['com.manut.crm.accounts.updated']() });
      await onSaved();
    } catch (err) {
      notify.error({
        title: t['com.manut.crm.accounts.update.error'](),
        message: getErrorMessage(err, t['com.manut.crm.error.unknown']()),
      });
    } finally {
      setSubmitting(false);
    }
  }, [
    account.id,
    canSubmit,
    industry,
    name,
    notes,
    onSaved,
    t,
    trigger,
    website,
  ]);

  return (
    <Modal
      open
      onOpenChange={(open: boolean) => {
        if (!open) onClose();
      }}
      title={t['com.manut.crm.accounts.edit']()}
      width={420}
    >
      <div className={styles.formRow}>
        <label className={styles.formLabel}>
          {t['com.manut.crm.fields.name']()}
        </label>
        <Input
          value={name}
          onChange={setName}
          data-testid="account-edit-name"
        />
      </div>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>
          {t['com.manut.crm.fields.industry']()}
        </label>
        <Input value={industry} onChange={setIndustry} />
      </div>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>
          {t['com.manut.crm.fields.website']()}
        </label>
        <Input value={website} onChange={setWebsite} placeholder="https://" />
      </div>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>
          {t['com.manut.crm.fields.notes']()}
        </label>
        <textarea
          className={styles.textarea}
          value={notes}
          onChange={event => setNotes(event.target.value)}
        />
      </div>
      <div className={styles.formActions}>
        <Button onClick={onClose} disabled={submitting}>
          {t['com.manut.crm.action.cancel']()}
        </Button>
        <Button
          variant="primary"
          onClick={() => void handleSubmit()}
          disabled={!canSubmit}
          loading={submitting}
          data-testid="account-edit-save"
        >
          {t['com.manut.crm.action.save']()}
        </Button>
      </div>
    </Modal>
  );
};
