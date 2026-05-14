import { Button, Input, Modal, notify } from '@affine/component';
import { useMutation } from '@affine/core/components/hooks/use-mutation';
import {
  type MnAgentRoleDto,
  updateAgentRoleMutation,
  type UpdateMnAgentRoleInput,
} from '@affine/core/modules/manut-control-plane';
import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useState,
} from 'react';

import * as styles from './setting-panel.css';

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Unexpected error';
}

interface RoleEditModalProps {
  open: boolean;
  workspaceId: string;
  role: MnAgentRoleDto | null;
  onClose: () => void;
  onUpdated: (role: MnAgentRoleDto) => void;
}

/**
 * Controlled form for editing one agent role's editable fields.
 *
 * Slug is intentionally rendered as a disabled input — it's the stable
 * identifier for the role and changing it would break the
 * `agentRoles(slug)` lookup the backend relies on.
 */
export const RoleEditModal = ({
  open,
  workspaceId,
  role,
  onClose,
  onUpdated,
}: RoleEditModalProps) => {
  const [displayName, setDisplayName] = useState('');
  const [adapter, setAdapter] = useState('');
  const [escalation, setEscalation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { trigger } = useMutation({ mutation: updateAgentRoleMutation });

  // Re-seed the form whenever the parent passes in a different role to
  // edit; resetting via prop avoids the stale state bug where the modal
  // would show the previous role's fields on rapid Edit clicks.
  useEffect(() => {
    if (open && role) {
      setDisplayName(role.displayName);
      setAdapter(role.adapter);
      setEscalation(role.escalation ?? '');
      setError(null);
      setSubmitting(false);
    }
  }, [open, role]);

  const handleClose = useCallback(() => {
    if (submitting) return;
    onClose();
  }, [onClose, submitting]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!role) return;

      const trimmedDisplayName = displayName.trim();
      const trimmedAdapter = adapter.trim();
      const trimmedEscalation = escalation.trim();

      if (!trimmedDisplayName) {
        setError('Display name is required.');
        return;
      }
      if (!trimmedAdapter) {
        setError('Adapter is required.');
        return;
      }

      setError(null);
      setSubmitting(true);
      try {
        const input: UpdateMnAgentRoleInput = {
          displayName: trimmedDisplayName,
          adapter: trimmedAdapter,
          escalation: trimmedEscalation ? trimmedEscalation : null,
        };
        const response = (await (
          trigger as (args: unknown) => Promise<unknown>
        )({
          workspaceId,
          slug: role.slug,
          input,
        })) as { updateAgentRole?: MnAgentRoleDto } | undefined;
        const updated = response?.updateAgentRole;
        if (!updated) {
          throw new Error('Server did not return the updated role.');
        }
        notify.success({
          title: 'Role updated',
          message: updated.displayName,
        });
        onUpdated(updated);
        onClose();
      } catch (err) {
        const message = errorMessage(err);
        setError(message);
        notify.error({ title: 'Could not update role', message });
      } finally {
        setSubmitting(false);
      }
    },
    [
      adapter,
      displayName,
      escalation,
      onClose,
      onUpdated,
      role,
      trigger,
      workspaceId,
    ]
  );

  return (
    <Modal
      open={open}
      onOpenChange={(value: boolean) => {
        if (!value) handleClose();
      }}
      title="Edit agent role"
      description="Update display name, adapter binding, and escalation note. The slug is fixed."
    >
      <form
        className={styles.formGrid}
        onSubmit={event => void handleSubmit(event)}
      >
        <div className={styles.fieldRow}>
          <label className={styles.fieldLabel} htmlFor="cp-role-slug">
            Slug
          </label>
          <input
            id="cp-role-slug"
            className={styles.slugInputDisabled}
            value={role?.slug ?? ''}
            disabled
            readOnly
            data-testid="cp-role-edit-slug"
          />
          <div className={styles.fieldHint}>
            Stable identifier. Cannot be changed.
          </div>
        </div>

        <div className={styles.fieldRow}>
          <label className={styles.fieldLabel} htmlFor="cp-role-display-name">
            Display name
          </label>
          <Input
            id="cp-role-display-name"
            value={displayName}
            placeholder="e.g. Release Captain"
            autoFocus
            onChange={setDisplayName}
            data-testid="cp-role-edit-display-name"
          />
        </div>

        <div className={styles.fieldRow}>
          <label className={styles.fieldLabel} htmlFor="cp-role-adapter">
            Adapter
          </label>
          <Input
            id="cp-role-adapter"
            value={adapter}
            placeholder="e.g. github-actions"
            onChange={setAdapter}
            data-testid="cp-role-edit-adapter"
          />
          <div className={styles.fieldHint}>
            The system or workflow that executes this role.
          </div>
        </div>

        <div className={styles.fieldRow}>
          <label className={styles.fieldLabel} htmlFor="cp-role-escalation">
            Escalation (optional)
          </label>
          <textarea
            id="cp-role-escalation"
            className={styles.textarea}
            value={escalation}
            placeholder="Who to page if this role fails."
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
              setEscalation(event.target.value)
            }
            data-testid="cp-role-edit-escalation"
          />
        </div>

        {error ? <div className={styles.formError}>{error}</div> : null}
        <div className={styles.formActions}>
          <Button onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={submitting}
            disabled={submitting || !displayName.trim() || !adapter.trim()}
            data-testid="cp-role-edit-submit"
          >
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
};
