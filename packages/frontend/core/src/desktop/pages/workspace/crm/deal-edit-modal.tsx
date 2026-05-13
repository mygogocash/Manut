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
  type MnCrmDeal,
  type MnCrmDealStage,
  type UpdateMnCrmDealInput,
  updateMnCrmDealMutation,
  type UpdateMnCrmDealResponse,
} from '../../../../modules/manut-crm';
import * as styles from './styles.css';

interface DealEditModalProps {
  deal: MnCrmDeal;
  accounts: readonly MnCrmAccount[];
  stages: readonly MnCrmDealStage[];
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export const DealEditModal = ({
  deal,
  accounts,
  stages,
  onClose,
  onSaved,
}: DealEditModalProps) => {
  const t = useI18n();
  const [name, setName] = useState(deal.name);
  // value is rendered as text so users can clear it; we parse back to
  // number on submit. Empty string means "leave value alone or unset".
  const [valueText, setValueText] = useState(
    deal.value === null ? '' : String(deal.value)
  );
  const [stageId, setStageId] = useState<string>(deal.stageId);
  const [accountId, setAccountId] = useState<string | null>(deal.accountId);
  const [submitting, setSubmitting] = useState(false);

  const { trigger } = useMutation({ mutation: updateMnCrmDealMutation });

  const selectedStage = useMemo(
    () => stages.find(s => s.id === stageId) ?? null,
    [stages, stageId]
  );
  const selectedAccount = useMemo(
    () => accounts.find(a => a.id === accountId) ?? null,
    [accounts, accountId]
  );

  const numericValue = useMemo(() => {
    const trimmed = valueText.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }, [valueText]);

  // Reject obviously-bad number input but allow blank (= clear value).
  const canSubmit =
    name.trim().length > 0 &&
    stageId.length > 0 &&
    (valueText.trim() === '' || numericValue !== null) &&
    !submitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const input: UpdateMnCrmDealInput = {
        name: name.trim(),
        stageId,
        value: numericValue,
        accountId,
      };
      const response = (await (trigger as (args: unknown) => Promise<unknown>)({
        dealId: deal.id,
        input,
      })) as UpdateMnCrmDealResponse;
      if (!response?.updateMnCrmDeal) {
        throw new Error('Deal update returned no record');
      }
      notify.success({ title: t['com.manut.crm.deals.updated']() });
      await onSaved();
    } catch (err) {
      notify.error({
        title: t['com.manut.crm.deals.update.error'](),
        message: getErrorMessage(err, t['com.manut.crm.error.unknown']()),
      });
    } finally {
      setSubmitting(false);
    }
  }, [
    accountId,
    canSubmit,
    deal.id,
    name,
    numericValue,
    onSaved,
    stageId,
    t,
    trigger,
  ]);

  return (
    <Modal
      open
      onOpenChange={(open: boolean) => {
        if (!open) onClose();
      }}
      title={t['com.manut.crm.deals.edit']()}
      width={420}
    >
      <div className={styles.formRow}>
        <label className={styles.formLabel}>
          {t['com.manut.crm.fields.name']()}
        </label>
        <Input value={name} onChange={setName} data-testid="deal-edit-name" />
      </div>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>
          {t['com.manut.crm.fields.value']()}
        </label>
        <Input
          value={valueText}
          onChange={setValueText}
          type="number"
          inputMode="decimal"
          placeholder="0"
        />
      </div>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>
          {t['com.manut.crm.fields.stage']()}
        </label>
        <Menu
          items={
            <>
              {stages.map(stage => (
                <MenuItem key={stage.id} onSelect={() => setStageId(stage.id)}>
                  {stage.name}
                </MenuItem>
              ))}
            </>
          }
        >
          <MenuTrigger className={styles.selectButton}>
            {selectedStage
              ? selectedStage.name
              : t['com.manut.crm.fields.stage.placeholder']()}
          </MenuTrigger>
        </Menu>
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
          data-testid="deal-edit-save"
        >
          {t['com.manut.crm.action.save']()}
        </Button>
      </div>
    </Modal>
  );
};
