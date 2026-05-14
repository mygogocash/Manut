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
import { useCallback, useState } from 'react';

import {
  MN_CRM_ACTIVITY_TYPES,
  type MnCrmActivity,
  type MnCrmActivityType,
  type UpdateMnCrmActivityInput,
  updateMnCrmActivityMutation,
  type UpdateMnCrmActivityResponse,
} from '../../../../modules/manut-crm';
import * as styles from './styles.css';

interface ActivityEditModalProps {
  activity: MnCrmActivity;
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

export const ActivityEditModal = ({
  activity,
  onClose,
  onSaved,
}: ActivityEditModalProps) => {
  const t = useI18n();
  const [type, setType] = useState<MnCrmActivityType>(activity.type);
  const [subject, setSubject] = useState(activity.subject ?? '');
  const [body, setBody] = useState(activity.body ?? '');
  const [submitting, setSubmitting] = useState(false);

  const { trigger } = useMutation({ mutation: updateMnCrmActivityMutation });

  // Subject is the primary signal for "this activity has content".
  // Keep it required on edit so we don't end up with rows that show
  // just the type icon.
  const canSubmit = subject.trim().length > 0 && !submitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const input: UpdateMnCrmActivityInput = {
        type,
        subject: trimToNull(subject),
        body: trimToNull(body),
      };
      const response = (await (trigger as (args: unknown) => Promise<unknown>)({
        activityId: activity.id,
        input,
      })) as UpdateMnCrmActivityResponse;
      if (!response?.updateMnCrmActivity) {
        throw new Error('Activity update returned no record');
      }
      notify.success({ title: t['com.manut.crm.activities.updated']() });
      await onSaved();
    } catch (err) {
      notify.error({
        title: t['com.manut.crm.activities.update.error'](),
        message: getErrorMessage(err, t['com.manut.crm.error.unknown']()),
      });
    } finally {
      setSubmitting(false);
    }
  }, [activity.id, body, canSubmit, onSaved, subject, t, trigger, type]);

  return (
    <Modal
      open
      onOpenChange={(open: boolean) => {
        if (!open) onClose();
      }}
      title={t['com.manut.crm.activities.edit']()}
      width={420}
    >
      <div className={styles.formRow}>
        <label className={styles.formLabel}>
          {t['com.manut.crm.fields.type']()}
        </label>
        <Menu
          items={
            <>
              {MN_CRM_ACTIVITY_TYPES.map(activityType => (
                <MenuItem
                  key={activityType}
                  onSelect={() => setType(activityType)}
                >
                  {activityType}
                </MenuItem>
              ))}
            </>
          }
        >
          <MenuTrigger className={styles.selectButton}>{type}</MenuTrigger>
        </Menu>
      </div>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>
          {t['com.manut.crm.fields.subject']()}
        </label>
        <Input
          value={subject}
          onChange={setSubject}
          data-testid="activity-edit-subject"
        />
      </div>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>
          {t['com.manut.crm.fields.body']()}
        </label>
        <textarea
          className={styles.textarea}
          value={body}
          onChange={event => setBody(event.target.value)}
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
          data-testid="activity-edit-save"
        >
          {t['com.manut.crm.action.save']()}
        </Button>
      </div>
    </Modal>
  );
};
