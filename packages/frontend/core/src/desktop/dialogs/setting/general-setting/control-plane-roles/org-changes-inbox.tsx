import { Button, RadioGroup, type RadioItem } from '@affine/component';
import { useMutation } from '@affine/core/components/hooks/use-mutation';
import { useQuery } from '@affine/core/components/hooks/use-query';
import {
  applyMnOrgChangeMutation,
  decideMnOrgChangeMutation,
  type MnOrgChangeDto,
  mnOrgChangesQuery,
  type MnOrgChangeStatus,
  revertMnOrgChangeMutation,
} from '@affine/core/modules/manut-control-plane';
import { isGraphQLSchemaValidationError } from '@affine/error';
import { Suspense, useCallback, useMemo, useState } from 'react';

import * as styles from './org-changes-inbox.css';

const ORG_CHANGES_UNAVAILABLE_MESSAGE =
  'Self-organization is not enabled on this workspace. Ask your administrator to enable the Manut control plane.';

function errorBoxMessage(err: unknown): string {
  if (isGraphQLSchemaValidationError(err)) {
    return ORG_CHANGES_UNAVAILABLE_MESSAGE;
  }
  return err instanceof Error ? err.message : 'Unexpected error';
}

function formatTimestamp(value: string | null): string {
  if (!value) return '-';
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return '-';
  return new Date(ms).toLocaleString();
}

type StatusFilter = 'pending' | 'decided' | 'applied' | 'all';

const STATUS_FILTER_ITEMS: RadioItem[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'decided', label: 'Decided' },
  { value: 'applied', label: 'Applied' },
  { value: 'all', label: 'All' },
];

const PENDING_STATUSES: MnOrgChangeStatus[] = ['PROPOSED'];
const DECIDED_STATUSES: MnOrgChangeStatus[] = ['APPROVED', 'REJECTED'];
const APPLIED_STATUSES: MnOrgChangeStatus[] = ['APPLIED', 'REVERTED'];

interface StatusPillProps {
  status: MnOrgChangeStatus;
}

const StatusPill = ({ status }: StatusPillProps) => {
  const variant =
    status === 'PROPOSED'
      ? styles.statusProposed
      : status === 'APPROVED'
        ? styles.statusApproved
        : status === 'REJECTED'
          ? styles.statusRejected
          : status === 'APPLIED'
            ? styles.statusApplied
            : styles.statusReverted;
  return (
    <span
      className={`${styles.statusPill} ${variant}`}
      data-testid="cp-org-change-status-pill"
      data-status={status}
    >
      {status.toLowerCase()}
    </span>
  );
};

const SkeletonList = () => (
  <div className={styles.skeletonGroup}>
    <div className={styles.skeletonRow} />
    <div className={styles.skeletonRow} />
    <div className={styles.skeletonRow} />
  </div>
);

interface OrgChangeRowProps {
  workspaceId: string;
  change: MnOrgChangeDto;
  isLast: boolean;
  onMutated: () => void;
}

const OrgChangeRow = ({
  workspaceId,
  change,
  isLast,
  onMutated,
}: OrgChangeRowProps) => {
  const [working, setWorking] = useState(false);
  const [decisionNote, setDecisionNote] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const { trigger: triggerDecide } = useMutation({
    mutation: decideMnOrgChangeMutation,
  });
  const { trigger: triggerApply } = useMutation({
    mutation: applyMnOrgChangeMutation,
  });
  const { trigger: triggerRevert } = useMutation({
    mutation: revertMnOrgChangeMutation,
  });

  const tdClass = isLast ? `${styles.td} ${styles.lastRowTd}` : styles.td;

  const handleDecide = useCallback(
    async (status: 'APPROVED' | 'REJECTED') => {
      setActionError(null);
      setWorking(true);
      try {
        await (triggerDecide as (args: unknown) => Promise<unknown>)({
          workspaceId,
          orgChangeId: change.id,
          input: {
            status,
            decisionNote: decisionNote.trim() || null,
          },
        });
        onMutated();
      } catch (err: unknown) {
        setActionError(errorBoxMessage(err));
      } finally {
        setWorking(false);
      }
    },
    [change.id, decisionNote, onMutated, triggerDecide, workspaceId]
  );

  const handleApply = useCallback(async () => {
    setActionError(null);
    setWorking(true);
    try {
      await (triggerApply as (args: unknown) => Promise<unknown>)({
        workspaceId,
        orgChangeId: change.id,
      });
      onMutated();
    } catch (err: unknown) {
      setActionError(errorBoxMessage(err));
    } finally {
      setWorking(false);
    }
  }, [change.id, onMutated, triggerApply, workspaceId]);

  const handleRevert = useCallback(async () => {
    setActionError(null);
    setWorking(true);
    try {
      await (triggerRevert as (args: unknown) => Promise<unknown>)({
        workspaceId,
        orgChangeId: change.id,
      });
      onMutated();
    } catch (err: unknown) {
      setActionError(errorBoxMessage(err));
    } finally {
      setWorking(false);
    }
  }, [change.id, onMutated, triggerRevert, workspaceId]);

  const showDecide = change.status === 'PROPOSED';
  const showApply = change.status === 'APPROVED';
  const showRevert = change.status === 'APPLIED';

  return (
    <tr data-testid="cp-org-change-row" data-org-change-id={change.id}>
      <td className={tdClass}>
        <span className={styles.typePill}>
          {change.type.replace(/_/g, ' ').toLowerCase()}
        </span>
      </td>
      <td className={tdClass}>
        <StatusPill status={change.status} />
      </td>
      <td className={`${tdClass} ${styles.rationaleCell}`}>
        {change.rationale}
        {change.decisionNote ? (
          <div className={styles.muted}>note: {change.decisionNote}</div>
        ) : null}
      </td>
      <td className={tdClass}>
        {change.proposedByAgentId
          ? `agent:${change.proposedByAgentId.slice(0, 8)}`
          : '-'}
      </td>
      <td className={tdClass}>{formatTimestamp(change.createdAt)}</td>
      <td className={tdClass}>
        <div className={styles.actionsCell}>
          {showDecide ? (
            <>
              <input
                type="text"
                placeholder="decision note (optional)"
                value={decisionNote}
                onChange={e => setDecisionNote(e.target.value)}
                disabled={working}
                className={styles.decisionInput}
                data-testid="cp-org-change-decision-note"
              />
              <Button
                onClick={() => {
                  handleDecide('APPROVED').catch(() => {
                    /* error surfaced via UI state */
                  });
                }}
                disabled={working}
                data-testid="cp-org-change-approve"
              >
                Approve
              </Button>
              <Button
                onClick={() => {
                  handleDecide('REJECTED').catch(() => {
                    /* error surfaced via UI state */
                  });
                }}
                disabled={working}
                data-testid="cp-org-change-reject"
              >
                Reject
              </Button>
            </>
          ) : null}
          {showApply ? (
            <Button
              onClick={() => {
                handleApply().catch(() => {
                  /* error surfaced via UI state */
                });
              }}
              disabled={working}
              data-testid="cp-org-change-apply"
            >
              Apply
            </Button>
          ) : null}
          {showRevert ? (
            <Button
              onClick={() => {
                handleRevert().catch(() => {
                  /* error surfaced via UI state */
                });
              }}
              disabled={working}
              data-testid="cp-org-change-revert"
            >
              Revert
            </Button>
          ) : null}
        </div>
        {actionError ? (
          <div className={styles.errorBox} role="alert">
            {actionError}
          </div>
        ) : null}
      </td>
    </tr>
  );
};

interface OrgChangesTableProps {
  workspaceId: string;
  statusFilter: StatusFilter;
  refreshKey: number;
  onMutated: () => void;
}

const OrgChangesTable = ({
  workspaceId,
  statusFilter,
  refreshKey,
  onMutated,
}: OrgChangesTableProps) => {
  const filter = useMemo(() => {
    const statuses =
      statusFilter === 'pending'
        ? PENDING_STATUSES
        : statusFilter === 'decided'
          ? DECIDED_STATUSES
          : statusFilter === 'applied'
            ? APPLIED_STATUSES
            : null;
    return statuses ? { statuses } : null;
  }, [statusFilter]);

  const queryArg = {
    query: mnOrgChangesQuery,
    variables: { workspaceId, filter },
    // refreshKey is part of the args so each mutation invalidates.
    // useQuery hashes the args; bumping refreshKey gives us a fresh fetch.
    refreshKey,
  } as unknown as NonNullable<Parameters<typeof useQuery>[0]>;

  const { data, error } = useQuery(queryArg);

  if (error) {
    return (
      <div className={styles.errorBox} role="alert">
        Failed to load org changes: {errorBoxMessage(error)}
      </div>
    );
  }

  const changes =
    (data as unknown as { mnOrgChanges?: MnOrgChangeDto[] } | undefined)
      ?.mnOrgChanges ?? [];

  if (changes.length === 0) {
    return (
      <div className={styles.emptyState} data-testid="cp-org-changes-empty">
        No structural-change proposals match this filter.
      </div>
    );
  }

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <colgroup>
          <col style={{ width: '14%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '34%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '14%' }} />
        </colgroup>
        <thead>
          <tr>
            <th className={styles.th}>Type</th>
            <th className={styles.th}>Status</th>
            <th className={styles.th}>Rationale</th>
            <th className={styles.th}>Proposer</th>
            <th className={styles.th}>Created</th>
            <th className={styles.th}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {changes.map((change, index) => (
            <OrgChangeRow
              key={change.id}
              workspaceId={workspaceId}
              change={change}
              isLast={index === changes.length - 1}
              onMutated={onMutated}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};

interface OrgChangesInboxProps {
  workspaceId: string;
}

export const OrgChangesInbox = ({ workspaceId }: OrgChangesInboxProps) => {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [refreshKey, setRefreshKey] = useState(0);

  const handleMutated = useCallback(() => {
    setRefreshKey(n => n + 1);
  }, []);

  const fallback = useMemo(() => <SkeletonList />, []);

  return (
    <div className={styles.root} data-testid="cp-org-changes-panel">
      <div>
        <div className={styles.title}>Org changes</div>
        <div className={styles.muted}>
          Agents propose structural changes (delegation, routines, capability
          grants, etc.) here. Operators approve / reject pending proposals,
          apply approved ones to mutate the underlying tables, and revert
          applied changes when possible. Every proposal is paired with a sibling
          approval that surfaces in the Approvals inbox too.
        </div>
      </div>
      <div className={styles.filterBar}>
        <RadioGroup
          items={STATUS_FILTER_ITEMS}
          value={statusFilter}
          onChange={(value: string) => setStatusFilter(value as StatusFilter)}
          width={300}
        />
      </div>

      <Suspense fallback={fallback}>
        <OrgChangesTable
          workspaceId={workspaceId}
          statusFilter={statusFilter}
          refreshKey={refreshKey}
          onMutated={handleMutated}
        />
      </Suspense>
    </div>
  );
};
