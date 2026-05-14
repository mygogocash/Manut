import {
  Button,
  Input,
  Menu,
  MenuItem,
  MenuTrigger,
  Modal,
  notify,
} from '@affine/component';
import { useMutation } from '@affine/core/components/hooks/use-mutation';
import { useI18n } from '@affine/i18n';
import { useCallback, useMemo, useState } from 'react';

import {
  type MnCrmAccount,
  type MnCrmContact,
  type UpdateMnCrmContactInput,
  updateMnCrmContactMutation,
  type UpdateMnCrmContactResponse,
} from '../../../../modules/manut-crm';
import * as styles from './styles.css';

interface ContactEditModalProps {
  contact: MnCrmContact;
  accounts: readonly MnCrmAccount[];
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function trimToNull(input: string): string | null {
  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export const ContactEditModal = ({
  contact,
  accounts,
  onClose,
  onSaved,
}: ContactEditModalProps) => {
  const t = useI18n();
  const [firstName, setFirstName] = useState(contact.firstName);
  const [lastName, setLastName] = useState(contact.lastName ?? '');
  const [email, setEmail] = useState(contact.email ?? '');
  const [phone, setPhone] = useState(contact.phone ?? '');
  const [title, setTitle] = useState(contact.title ?? '');
  const [accountId, setAccountId] = useState<string | null>(contact.accountId);
  const [submitting, setSubmitting] = useState(false);

  const { trigger } = useMutation({ mutation: updateMnCrmContactMutation });

  const selectedAccount = useMemo(
    () => accounts.find(a => a.id === accountId) ?? null,
    [accounts, accountId]
  );

  const canSubmit = firstName.trim().length > 0 && !submitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const input: UpdateMnCrmContactInput = {
        firstName: firstName.trim(),
        lastName: trimToNull(lastName),
        email: trimToNull(email),
        phone: trimToNull(phone),
        title: trimToNull(title),
        accountId,
      };
      const response = (await (trigger as (args: unknown) => Promise<unknown>)({
        contactId: contact.id,
        input,
      })) as UpdateMnCrmContactResponse;
      if (!response?.updateMnCrmContact) {
        throw new Error('Contact update returned no record');
      }
      notify.success({ title: t['com.manut.crm.contacts.updated']() });
      await onSaved();
    } catch (err) {
      notify.error({
        title: t['com.manut.crm.contacts.update.error'](),
        message: getErrorMessage(err, t['com.manut.crm.error.unknown']()),
      });
    } finally {
      setSubmitting(false);
    }
  }, [
    accountId,
    canSubmit,
    contact.id,
    email,
    firstName,
    lastName,
    onSaved,
    phone,
    t,
    title,
    trigger,
  ]);

  return (
    <Modal
      open
      onOpenChange={(open: boolean) => {
        if (!open) onClose();
      }}
      title={t['com.manut.crm.contacts.edit']()}
      width={420}
    >
      <div className={styles.formRow}>
        <label className={styles.formLabel}>
          {t['com.manut.crm.fields.firstName']()}
        </label>
        <Input
          value={firstName}
          onChange={setFirstName}
          data-testid="contact-edit-firstName"
        />
      </div>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>
          {t['com.manut.crm.fields.lastName']()}
        </label>
        <Input value={lastName} onChange={setLastName} />
      </div>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>
          {t['com.manut.crm.fields.email']()}
        </label>
        <Input value={email} onChange={setEmail} type="email" />
      </div>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>
          {t['com.manut.crm.fields.phone']()}
        </label>
        <Input value={phone} onChange={setPhone} type="tel" />
      </div>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>
          {t['com.manut.crm.fields.title']()}
        </label>
        <Input value={title} onChange={setTitle} />
      </div>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>
          {t['com.manut.crm.fields.account']()}
        </label>
        <Menu
          items={
            <>
              <MenuItem onSelect={() => setAccountId(null)}>
                {t['com.manut.crm.fields.account.none']()}
              </MenuItem>
              {accounts.map(account => (
                <MenuItem
                  key={account.id}
                  onSelect={() => setAccountId(account.id)}
                >
                  {account.name}
                </MenuItem>
              ))}
            </>
          }
        >
          <MenuTrigger className={styles.selectButton}>
            {selectedAccount
              ? selectedAccount.name
              : t['com.manut.crm.fields.account.none']()}
          </MenuTrigger>
        </Menu>
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
          data-testid="contact-edit-save"
        >
          {t['com.manut.crm.action.save']()}
        </Button>
      </div>
    </Modal>
  );
};
