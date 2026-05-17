import { Button, RadioGroup, type RadioItem } from '@affine/component';
import { useQuery } from '@affine/core/components/hooks/use-query';
import {
  type MnApprovalDto,
  mnApprovalsQuery,
  type MnApprovalSseEvent,
  MnApprovalsSseService,
  type MnApprovalStatus,
} from '@affine/core/modules/manut-control-plane';
import { isGraphQLSchemaValidationError } from '@affine/error';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';

import { ApprovalDetailDrawer } from './approval-detail-drawer';
import * as styles from './approvals-inbox.css';

const APPROVALS_UNAVAILABLE_MESSAGE =
  'Approvals are not enabled on this workspace. Ask your administrator to enable the Manut control plane.';

function errorBoxMessage(err: unknown): string {
  if (isGraphQLSchemaValidationError(err)) {
    return APPROVALS_UNAVAILABLE_MESSAGE;
  }
  return err instanceof Error ? err.message : 'Unexpected error';
}

function formatTimestamp(value: string | null): string {
  if (!value) return '-';
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return '-';
  return new Date(ms).toLocaleString();
}

type StatusFilter = 'open' | 'all' | 'decided';

const STATUS_FILTER_ITEMS: RadioItem[] = [
  { value: 'open', label: 'Open' },
  { value: 'decided', label: 'Decided' },
  { value: 'all', label: 'All' },
];

const OPEN_STATUSES: MnApprovalStatus[] = ['PENDING', 'REVISION_REQUESTED'];
const DECIDED_STATUSES: MnApprovalStatus[] = [
  'APPROVED',
  'REJECTED',
  'CANCELLED',
];

interface StatusPillProps {
  status: MnApprovalStatus;
}

const StatusPill = ({ status }: StatusPillProps) => {
  const variant =
    status === 'PENDING'
      ? styles.statusPending
      : status === 'APPROVED'
        ? styles.statusApproved
        : status === 'REJECTED'
          ? styles.statusRejected
          : status === 'CANCELLED'
            ? styles.statusCancelled
            : styles.statusRevision;
  return (
    <span
      className={`${styles.statusPill} ${variant}`}
      data-testid="cp-approval-status-pill"
      data-status={status}
    >
      {status.replace('_', ' ').toLowerCase()}
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

interface ApprovalsTableProps {
  workspaceId: string;
  statusFilter: StatusFilter;
  onOpenApproval: (approval: MnApprovalDto) => void;
}

const ApprovalsTable = ({
  workspaceId,
  statusFilter,
  onOpenApproval,
}: ApprovalsTableProps) => {
  const filter = useMemo(() => {
    const statuses =
      statusFilter === 'open'
        ? OPEN_STATUSES
        : statusFilter === 'decided'
          ? DECIDED_STATUSES
          : null;
    return statuses ? { statuses } : null;
  }, [statusFilter]);

  const queryArg = {
    query: mnApprovalsQuery,
    variables: { workspaceId, filter },
  } as unknown as NonNullable<Parameters<typeof useQuery>[0]>;
  const { data, error } = useQuery(queryArg);

  if (error) {
    return (
      <div className={styles.errorBox} role="alert">
        Failed to load approvals: {errorBoxMessage(error)}
      </div>
    );
  }

  const approvals =
    (data as unknown as { mnApprovals?: MnApprovalDto[] } | undefined)
      ?.mnApprovals ?? [];

  if (approvals.length === 0) {
    return (
      <div className={styles.emptyState} data-testid="cp-approvals-empty">
        No approvals match this filter.
      </div>
    );
  }

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <colgroup>
          <col style={{ width: '20%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '32%' }} />
          <col style={{ width: '20%' }} />
        </colgroup>
        <thead>
          <tr>
            <th className={styles.th}>Type</th>
            <th className={styles.th}>Status</th>
            <th className={styles.th}>Requester</th>
            <th className={styles.th}>Summary</th>
            <th className={styles.th}>Created</th>
          </tr>
        </thead>
        <tbody>
          {approvals.map((approval, index) => {
            const isLast = index === approvals.length - 1;
            const tdClass = isLast
              ? `${styles.td} ${styles.lastRowTd}`
              : styles.td;
            const summaryValue =
              typeof approval.payload?.toolName === 'string'
                ? `tool: ${approval.payload.toolName}`
                : typeof approval.payload?.summary === 'string'
                  ? approval.payload.summary
                  : JSON.stringify(approval.payload).slice(0, 96);
            return (
              <tr
                key={approval.id}
                data-testid="cp-approval-row"
                data-approval-id={approval.id}
                className={styles.row}
                onClick={() => onOpenApproval(approval)}
              >
                <td className={tdClass}>
                  <span className={styles.typePill}>
                    {approval.type.replace(/_/g, ' ').toLowerCase()}
                  </span>
                </td>
                <td className={tdClass}>
                  <StatusPill status={approval.status} />
                </td>
                <td className={`${tdClass} ${styles.monoCell}`}>
                  {approval.requestedByAgentId
                    ? `agent:${approval.requestedByAgentId.slice(0, 8)}`
                    : approval.requestedByUserId
                      ? `user:${approval.requestedByUserId.slice(0, 8)}`
                      : '-'}
                </td>
                <td className={tdClass}>{summaryValue}</td>
                <td className={tdClass}>
                  {formatTimestamp(approval.createdAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

interface ApprovalsInboxProps {
  workspaceId: string;
}

export const ApprovalsInbox = ({ workspaceId }: ApprovalsInboxProps) => {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open');
  const [selectedApproval, setSelectedApproval] =
    useState<MnApprovalDto | null>(null);

  // Stable singleton per workspace — opened on mount, closed on unmount.
  // The query layer revalidates on mutation so we don't need to surface
  // SSE deltas as cache writes; the live counter at the top of the panel
  // does though.
  const sseService = useMemo(
    () => new MnApprovalsSseService(workspaceId),
    [workspaceId]
  );
  const [, forceRender] = useState(0);

  useEffect(() => {
    const cleanup = sseService.subscribe();
    const sub = sseService.events$.subscribe((_evt: MnApprovalSseEvent) => {
      // Cheap re-render trigger; useQuery's own revalidation handles
      // the table content.
      forceRender(n => n + 1);
    });
    return () => {
      sub.unsubscribe();
      cleanup();
    };
  }, [sseService]);

  const handleOpenApproval = useCallback((approval: MnApprovalDto) => {
    setSelectedApproval(approval);
  }, []);

  const handleCloseApproval = useCallback(() => {
    setSelectedApproval(null);
  }, []);

  const fallback = useMemo(() => <SkeletonList />, []);

  return (
    <div className={styles.root} data-testid="cp-approvals-panel">
      <div className={styles.headerRow}>
        <div>
          <div className={styles.title}>Approvals</div>
          <div className={styles.muted}>
            Pending tool-call reviews, hire requests, budget overrides, and
            other agent gates. Decide approvals to let work resume; the agent
            sees the decision in its next stream.
          </div>
        </div>
        <Button onClick={() => setSelectedApproval(null)} disabled>
          New approval
        </Button>
      </div>
      <div className={styles.filterBar}>
        <RadioGroup
          items={STATUS_FILTER_ITEMS}
          value={statusFilter}
          onChange={(value: string) => setStatusFilter(value as StatusFilter)}
          width={260}
        />
      </div>

      <Suspense fallback={fallback}>
        <ApprovalsTable
          workspaceId={workspaceId}
          statusFilter={statusFilter}
          onOpenApproval={handleOpenApproval}
        />
      </Suspense>

      {selectedApproval ? (
        <ApprovalDetailDrawer
          open
          workspaceId={workspaceId}
          approval={selectedApproval}
          onClose={handleCloseApproval}
        />
      ) : null}
    </div>
  );
};
