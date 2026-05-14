import { Menu, MenuItem, MenuTrigger } from '@affine/component';
import { useI18n } from '@affine/i18n';
import { useCallback, useMemo } from 'react';

import type {
  MnCrmAccount,
  MnCrmActivity,
  MnCrmDeal,
  MnCrmDealStage,
} from '../../../../modules/manut-crm';
import { DetailField } from './detail-panel';
import * as styles from './styles.css';

interface DealDetailBodyProps {
  deal: MnCrmDeal;
  account: MnCrmAccount | null;
  stages: readonly MnCrmDealStage[];
  activities: readonly MnCrmActivity[];
  /** Quick-move stage handler — calls updateMnCrmDeal with the new stageId. */
  onMoveStage: (stageId: string) => Promise<void> | void;
  /** Disabled when a mutation is in flight. */
  moving?: boolean;
}

function formatCurrency(value: number | null, currency: string | null): string {
  if (value === null) return '—';
  const code = currency ?? 'USD';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${code} ${value.toFixed(2)}`;
  }
}

function formatDate(value: string | null): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString();
}

export const DealDetailBody = ({
  deal,
  account,
  stages,
  activities,
  onMoveStage,
  moving,
}: DealDetailBodyProps) => {
  const t = useI18n();

  const currentStage = useMemo(
    () => stages.find(stage => stage.id === deal.stageId) ?? null,
    [stages, deal.stageId]
  );

  // History: just the activities linked to this deal, newest first. We
  // don't fetch deal-specific activities — we reuse the workspace-wide
  // activity list the parent already loads.
  const linkedActivities = useMemo(() => {
    return [...activities]
      .filter(a => a.dealId === deal.id)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }, [activities, deal.id]);

  const handleStagePick = useCallback(
    (stageId: string) => {
      if (stageId === deal.stageId) return;
      // Fire-and-forget at the menu callsite; parent shows error toast.
      // Swallow rejections here so we don't have an unhandled promise —
      // the parent's mutation wrapper already surfaces user-facing
      // errors via notify.error.
      Promise.resolve(onMoveStage(stageId)).catch(() => {});
    },
    [deal.stageId, onMoveStage]
  );

  return (
    <>
      <DetailField
        label={t['com.manut.crm.fields.name']()}
        value={deal.name}
        testId="deal-detail-name"
      />
      <DetailField
        label={t['com.manut.crm.fields.value']()}
        value={formatCurrency(deal.value, deal.currency)}
      />
      <DetailField
        label={t['com.manut.crm.fields.account']()}
        value={account ? account.name : null}
      />

      <div className={styles.detailSection}>
        <span className={styles.detailLabel}>
          {t['com.manut.crm.fields.stage']()}
        </span>
        <Menu
          items={
            <>
              {stages.map(stage => (
                <MenuItem
                  key={stage.id}
                  onSelect={() => handleStagePick(stage.id)}
                  data-testid={`deal-detail-stage-option-${stage.id}`}
                >
                  {stage.name}
                </MenuItem>
              ))}
            </>
          }
        >
          <MenuTrigger
            className={styles.selectButton}
            disabled={moving}
            data-testid="deal-detail-stage-picker"
          >
            {currentStage
              ? currentStage.name
              : t['com.manut.crm.fields.stage.placeholder']()}
          </MenuTrigger>
        </Menu>
        {moving ? (
          <span className={styles.inlineHint}>
            {t['com.manut.crm.detail.deal.moving']()}
          </span>
        ) : null}
      </div>

      <div className={styles.detailSection}>
        <span className={styles.detailLabel}>
          {t['com.manut.crm.detail.deal.activity']()}
        </span>
        {linkedActivities.length === 0 ? (
          <span className={styles.detailEmpty}>
            {t['com.manut.crm.detail.linked.none']()}
          </span>
        ) : (
          <div
            className={styles.detailLinkedList}
            data-testid="deal-detail-activity"
          >
            {linkedActivities.map(activity => (
              <div key={activity.id} className={styles.detailLinkedRow}>
                <span>{activity.subject ?? activity.type}</span>
                <span className={styles.detailLinkedMeta}>
                  {formatDate(activity.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};
