import { Button, RadioGroup, type RadioItem } from '@affine/component';
import { useQuery } from '@affine/core/components/hooks/use-query';
import {
  agentRolesQuery,
  type MnAgentRoleDto,
} from '@affine/core/modules/manut-control-plane';
import { WorkbenchService } from '@affine/core/modules/workbench';
import { WorkspaceService } from '@affine/core/modules/workspace';
import { isGraphQLSchemaValidationError } from '@affine/error';
import { useService } from '@toeverything/infra';
import { Suspense, useCallback, useMemo, useState } from 'react';

import { AgentsListPanel } from '../../../general-setting/control-plane-roles/agents-list';
import { ApprovalsInbox } from '../../../general-setting/control-plane-roles/approvals-inbox';
import { OrgChangesInbox } from '../../../general-setting/control-plane-roles/org-changes-inbox';
import { SkillsListPanel } from '../../../general-setting/control-plane-roles/skills-list';
import { WorkspacePluginsPanel } from '../../../general-setting/control-plane-roles/workspace-plugins';
import { IntegrationSettingHeader } from '../setting';
import { RoleEditModal } from './role-edit-modal';
import * as styles from './setting-panel.css';

type Subtab =
  | 'roles'
  | 'agents'
  | 'approvals'
  | 'skills'
  | 'plugins'
  | 'orgChanges';

const SUBTAB_ITEMS: RadioItem[] = [
  { value: 'roles', label: 'Roles' },
  { value: 'agents', label: 'Agents' },
  { value: 'approvals', label: 'Approvals' },
  { value: 'skills', label: 'Skills' },
  { value: 'plugins', label: 'Plugins' },
  { value: 'orgChanges', label: 'Org changes' },
];

// en-only copy; follow-up to thread through i18n once we open that can.
const CONTROL_PLANE_UNAVAILABLE_MESSAGE =
  'Control Plane roles are not enabled on this workspace. Ask your administrator to enable the Manut control plane.';

function errorBoxMessage(err: unknown): string {
  if (isGraphQLSchemaValidationError(err)) {
    return CONTROL_PLANE_UNAVAILABLE_MESSAGE;
  }
  return err instanceof Error ? err.message : 'Unexpected error';
}

function formatLastSeen(value: string | null): string {
  if (!value) return '-';
  const ms = Date.parse(value);
  if (isNaN(ms)) return '-';
  return new Date(ms).toLocaleString();
}

export const ControlPlaneRolesIcon = () => {
  return <span className={styles.icon}>CP</span>;
};

interface RolesTableProps {
  workspaceId: string;
  onEdit: (role: MnAgentRoleDto) => void;
  onOpenRun: (runId: string) => void;
}

const SkeletonList = () => (
  <div className={styles.skeletonGroup}>
    <div className={styles.skeletonRow} />
    <div className={styles.skeletonRow} />
    <div className={styles.skeletonRow} />
    <div className={styles.skeletonRow} />
    <div className={styles.skeletonRow} />
  </div>
);

const RolesTable = ({ workspaceId, onEdit, onOpenRun }: RolesTableProps) => {
  const queryArg = {
    query: agentRolesQuery,
    variables: { workspaceId },
  } as unknown as NonNullable<Parameters<typeof useQuery>[0]>;

  const { data, error } = useQuery(queryArg);

  if (error) {
    return (
      <div className={styles.errorBox} role="alert">
        Failed to load agent roles: {errorBoxMessage(error)}
      </div>
    );
  }

  const roles = (
    data as unknown as { agentRoles?: MnAgentRoleDto[] } | undefined
  )?.agentRoles;

  if (!roles || roles.length === 0) {
    return (
      <div className={styles.muted} data-testid="cp-roles-empty">
        No agent roles have been registered for this workspace yet.
      </div>
    );
  }

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <colgroup>
          <col style={{ width: '14%' }} />
          <col style={{ width: '20%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '24%' }} />
          <col style={{ width: '20%' }} />
          <col style={{ width: '8%' }} />
        </colgroup>
        <thead>
          <tr>
            <th className={styles.th}>Slug</th>
            <th className={styles.th}>Display name</th>
            <th className={styles.th}>Adapter</th>
            <th className={styles.th}>Responsibility</th>
            <th className={styles.th}>Escalation</th>
            <th className={styles.th} />
          </tr>
        </thead>
        <tbody>
          {roles.map((role, index) => {
            const isLast = index === roles.length - 1;
            const tdClass = isLast
              ? `${styles.td} ${styles.lastRowTd}`
              : styles.td;
            return (
              <tr key={role.id} data-testid="cp-role-row">
                <td className={`${tdClass} ${styles.slugCell}`}>{role.slug}</td>
                <td className={tdClass}>
                  <div data-testid="cp-role-display-name">
                    {role.displayName}
                  </div>
                  {role.lastSuccessfulRunId ? (
                    <div className={styles.lastSeenCell}>
                      Last success:{' '}
                      <button
                        type="button"
                        className={styles.link}
                        onClick={() => {
                          if (role.lastSuccessfulRunId) {
                            onOpenRun(role.lastSuccessfulRunId);
                          }
                        }}
                        data-testid="cp-role-last-run-link"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                          font: 'inherit',
                        }}
                      >
                        view run
                      </button>
                    </div>
                  ) : null}
                  {role.lastSeenAt ? (
                    <div className={styles.lastSeenCell}>
                      Last seen: {formatLastSeen(role.lastSeenAt)}
                    </div>
                  ) : null}
                </td>
                <td className={`${tdClass} ${styles.adapterCell}`}>
                  {role.adapter}
                </td>
                <td className={tdClass}>{role.responsibility}</td>
                <td className={tdClass}>{role.escalation ?? '-'}</td>
                <td className={`${tdClass} ${styles.actionsCell}`}>
                  <Button
                    onClick={() => onEdit(role)}
                    data-testid="cp-role-edit-button"
                  >
                    Edit
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export const ControlPlaneRolesSettingPanel = () => {
  const workspaceService = useService(WorkspaceService);
  const workspaceId = workspaceService.workspace.id;
  const workbench = useService(WorkbenchService).workbench;

  const [activeSubtab, setActiveSubtab] = useState<Subtab>('roles');
  const [editingRole, setEditingRole] = useState<MnAgentRoleDto | null>(null);

  const handleEdit = useCallback((role: MnAgentRoleDto) => {
    setEditingRole(role);
  }, []);

  const handleClose = useCallback(() => {
    setEditingRole(null);
  }, []);

  const handleUpdated = useCallback(() => {
    // The query layer revalidates on mutation; nothing extra to do here.
    // Closing the modal is handled inside the modal's own submit handler.
  }, []);

  const handleOpenRun = useCallback(
    (runId: string) => {
      workbench.open(`/release-runs/${runId}`);
    },
    [workbench]
  );

  const fallback = useMemo(() => <SkeletonList />, []);

  return (
    <div className={styles.root} data-testid="cp-roles-panel">
      <IntegrationSettingHeader
        icon={<ControlPlaneRolesIcon />}
        name="Control Plane Roles"
        desc="Edit the five operating roles (Release Captain, Builder, Verifier, Deployer, Historian). Slug is fixed; display name, adapter, and escalation are editable."
      />

      <RadioGroup
        items={SUBTAB_ITEMS}
        value={activeSubtab}
        onChange={(value: string) => setActiveSubtab(value as Subtab)}
        width={200}
      />

      {activeSubtab === 'roles' ? (
        <section className={styles.section}>
          <div className={styles.sectionTitle}>Agent roles</div>
          <div className={styles.muted}>
            Each role binds to an adapter that executes its work — GitHub
            Actions, deploy scripts, or future AI workers. Last successful run
            links to the run details page.
          </div>
          <Suspense fallback={fallback}>
            <RolesTable
              workspaceId={workspaceId}
              onEdit={handleEdit}
              onOpenRun={handleOpenRun}
            />
          </Suspense>
        </section>
      ) : activeSubtab === 'agents' ? (
        <AgentsListPanel workspaceId={workspaceId} />
      ) : activeSubtab === 'approvals' ? (
        <ApprovalsInbox workspaceId={workspaceId} />
      ) : activeSubtab === 'skills' ? (
        <SkillsListPanel workspaceId={workspaceId} />
      ) : activeSubtab === 'plugins' ? (
        <WorkspacePluginsPanel workspaceId={workspaceId} />
      ) : (
        <OrgChangesInbox workspaceId={workspaceId} />
      )}

      <RoleEditModal
        open={editingRole !== null}
        workspaceId={workspaceId}
        role={editingRole}
        onClose={handleClose}
        onUpdated={handleUpdated}
      />
    </div>
  );
};
