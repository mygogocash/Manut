import { Button } from '@affine/component';
import { useQuery } from '@affine/core/components/hooks/use-query';
import {
  type MnReleaseRunDto,
  type MnReleaseRunStatus,
  releaseRunsQuery,
} from '@affine/core/modules/manut-control-plane';
import {
  ViewBody,
  ViewHeader,
  ViewIcon,
  ViewTitle,
} from '@affine/core/modules/workbench';
import { WorkspaceService } from '@affine/core/modules/workspace';
import { isGraphQLSchemaValidationError } from '@affine/error';
import { HistoryIcon } from '@blocksuite/icons/rc';
import { useService } from '@toeverything/infra';
import { Suspense, useCallback, useMemo, useState } from 'react';

import { Header } from '../../../../components/pure/header';
import { AllDocSidebarTabs } from '../layouts/all-doc-sidebar-tabs';
import * as styles from './release-runs.css';

// en-only copy; follow-up to thread through i18n once we open that can.
const RELEASE_RUNS_UNAVAILABLE_MESSAGE =
  'Release runs are not enabled on this workspace. Ask your administrator to enable the Manut control plane.';

function errorMessage(err: unknown): string {
  if (isGraphQLSchemaValidationError(err)) {
    return RELEASE_RUNS_UNAVAILABLE_MESSAGE;
  }
  return err instanceof Error ? err.message : 'Unexpected error';
}

const SECONDS_IN = {
  minute: 60,
  hour: 60 * 60,
  day: 60 * 60 * 24,
  week: 60 * 60 * 24 * 7,
} as const;

function formatAge(iso: string): string {
  const ms = Date.parse(iso);
  if (isNaN(ms)) return '-';
  const diff = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (diff < SECONDS_IN.minute) return `${diff}s ago`;
  if (diff < SECONDS_IN.hour)
    return `${Math.floor(diff / SECONDS_IN.minute)}m ago`;
  if (diff < SECONDS_IN.day)
    return `${Math.floor(diff / SECONDS_IN.hour)}h ago`;
  if (diff < SECONDS_IN.week)
    return `${Math.floor(diff / SECONDS_IN.day)}d ago`;
  return new Date(ms).toLocaleDateString();
}

function statusBadgeClass(status: MnReleaseRunStatus): string {
  switch (status) {
    case 'success':
      return `${styles.statusBadge} ${styles.statusBadgeSuccess}`;
    case 'failure':
      return `${styles.statusBadge} ${styles.statusBadgeFailure}`;
    case 'in_progress':
      return `${styles.statusBadge} ${styles.statusBadgeInProgress}`;
    case 'cancelled':
    case 'pending':
    default:
      return `${styles.statusBadge} ${styles.statusBadgePending}`;
  }
}

function statusLabel(status: MnReleaseRunStatus): string {
  switch (status) {
    case 'in_progress':
      return 'in progress';
    default:
      return status;
  }
}

const ReleaseRunsHeader = () => (
  <Header
    left={
      <span className={styles.headerLeft}>
        <HistoryIcon /> Release runs
      </span>
    }
  />
);

const SkeletonList = () => (
  <div className={styles.skeletonGroup}>
    <div className={styles.skeletonRow} />
    <div className={styles.skeletonRow} />
    <div className={styles.skeletonRow} />
  </div>
);

interface RunRowProps {
  run: MnReleaseRunDto;
  expanded: boolean;
  onToggle: (id: string) => void;
}

const RunRow = ({ run, expanded, onToggle }: RunRowProps) => {
  const handleClick = useCallback(() => {
    onToggle(run.id);
  }, [onToggle, run.id]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onToggle(run.id);
      }
    },
    [onToggle, run.id]
  );

  const orderedTasks = useMemo(
    () => [...run.tasks].sort((a, b) => a.sortOrder - b.sortOrder),
    [run.tasks]
  );

  return (
    <div className={styles.runRow} data-testid="release-run-row">
      <div
        className={styles.runRowHeader}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        data-testid="release-run-row-header"
      >
        <span
          className={statusBadgeClass(run.status)}
          data-testid="release-run-status"
        >
          {statusLabel(run.status)}
        </span>
        <span className={styles.versionCell} data-testid="release-run-version">
          {run.version ?? '-'}
        </span>
        {run.shortSha ? (
          run.ghRunUrl ? (
            <a
              href={run.ghRunUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.shaCell}
              onClick={event => event.stopPropagation()}
              data-testid="release-run-sha"
            >
              {run.shortSha}
            </a>
          ) : (
            <span className={styles.shaCell} data-testid="release-run-sha">
              {run.shortSha}
            </span>
          )
        ) : (
          <span className={styles.shaCell}>-</span>
        )}
        <span
          className={styles.imageTagCell}
          title={run.imageTag ?? undefined}
          data-testid="release-run-image-tag"
        >
          {run.imageTag ?? '-'}
        </span>
        <span className={styles.actorCell}>{run.actor ?? '-'}</span>
        <span className={styles.ageCell} title={run.generatedAt}>
          {formatAge(run.generatedAt)}
        </span>
        <button
          type="button"
          className={styles.expandToggle}
          aria-label={expanded ? 'Collapse' : 'Expand'}
          tabIndex={-1}
          onClick={event => {
            event.stopPropagation();
            onToggle(run.id);
          }}
        >
          {expanded ? '–' : '+'}
        </button>
      </div>

      {expanded ? (
        <div className={styles.runRowBody} data-testid="release-run-body">
          <div className={styles.bodySection}>
            <div className={styles.bodySectionTitle}>Tasks</div>
            <ul className={styles.taskList} data-testid="release-run-tasks">
              {orderedTasks.length === 0 ? (
                <li className={styles.taskItem}>No task records.</li>
              ) : (
                orderedTasks.map(task => (
                  <li
                    key={task.slug}
                    className={styles.taskItem}
                    data-testid="release-run-task"
                  >
                    <span className={styles.taskSlug}>{task.slug}</span>
                    <span>{task.label}</span>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className={styles.bodySection}>
            <div className={styles.bodySectionTitle}>Evidence</div>
            <div className={styles.evidenceList}>
              {run.ghRunUrl ? (
                <a
                  className={styles.evidenceLink}
                  href={run.ghRunUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="release-run-evidence-github"
                >
                  GitHub run
                </a>
              ) : (
                <span className={styles.evidenceLinkMuted}>
                  No GitHub run URL recorded
                </span>
              )}
              {run.deployUrl ? (
                <a
                  className={styles.evidenceLink}
                  href={run.deployUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="release-run-evidence-deploy"
                >
                  Deploy URL
                </a>
              ) : null}
              {run.imageDigest ? (
                <span className={styles.evidenceLinkMuted}>
                  Digest: {run.imageDigest}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

const EmptyState = () => (
  <div className={styles.emptyState} data-testid="release-runs-empty">
    <div className={styles.emptyStateTitle}>No release runs yet</div>
    <div className={styles.emptyStateBody}>
      Trigger a build to populate this. Once GitHub Actions runs a Manut release
      workflow, you&apos;ll see it listed here.
    </div>
  </div>
);

interface RunsListProps {
  workspaceId: string;
}

const RunsList = ({ workspaceId }: RunsListProps) => {
  const queryArg = {
    query: releaseRunsQuery,
    variables: { workspaceId, limit: 50, offset: 0 },
  } as unknown as NonNullable<Parameters<typeof useQuery>[0]>;

  const { data, error, mutate } = useQuery(queryArg);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleToggle = useCallback((id: string) => {
    setExpandedId(current => (current === id ? null : id));
  }, []);

  if (error) {
    return (
      <div className={styles.errorBox} role="alert">
        <span>Failed to load release runs: {errorMessage(error)}</span>
        <Button onClick={() => void mutate()}>Retry</Button>
      </div>
    );
  }

  const runs = (
    data as unknown as { releaseRuns?: MnReleaseRunDto[] } | undefined
  )?.releaseRuns;

  if (!runs || runs.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className={styles.list} data-testid="release-runs-list">
      {runs.map(run => (
        <RunRow
          key={run.id}
          run={run}
          expanded={expandedId === run.id}
          onToggle={handleToggle}
        />
      ))}
    </div>
  );
};

const ReleaseRunsPage = () => {
  const workspaceService = useService(WorkspaceService);
  const workspaceId = workspaceService.workspace.id;

  const fallback = useMemo(() => <SkeletonList />, []);

  return (
    <>
      <ViewTitle title="Release runs" />
      <ViewIcon icon="allDocs" />
      <ViewHeader>
        <ReleaseRunsHeader />
      </ViewHeader>
      <ViewBody>
        <div className={styles.root} data-testid="release-runs-page">
          <div className={styles.titleBlock}>
            <div className={styles.title}>Release runs</div>
            <div className={styles.subtitle}>
              Recent Manut control-plane release runs. Click a row to see the
              task tree and evidence links.
            </div>
          </div>
          <Suspense fallback={fallback}>
            <RunsList workspaceId={workspaceId} />
          </Suspense>
        </div>
      </ViewBody>
      <AllDocSidebarTabs />
    </>
  );
};

export const Component = () => <ReleaseRunsPage />;
