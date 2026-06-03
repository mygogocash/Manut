import type { MnApprovalDto } from '@affine/core/modules/manut-control-plane';
import type {
  MnDoDVerificationResult,
  MnTaskDto,
  MnTaskPlanDto,
  MnWorkProductDto,
} from '@affine/core/modules/manut-pm';
import { trackEvent } from '@affine/core/modules/telemetry';
import { useMemo } from 'react';

import * as styles from './agent-task-cockpit.css';

export interface AgentTaskCockpitInput {
  task: MnTaskDto | null;
  plans?: readonly MnTaskPlanDto[];
  approvals?: readonly MnApprovalDto[];
  workProducts?: readonly MnWorkProductDto[];
  verification?: MnDoDVerificationResult | null;
}

export interface AgentTaskCockpitSummary {
  taskTitle: string;
  taskStatus: MnTaskDto['status'] | 'UNLINKED';
  latestPlanLabel: string;
  pendingApprovalCount: number;
  workProductCount: number;
  verificationLabel: string;
}

export interface AgentTaskCockpitPanelProps extends AgentTaskCockpitInput {
  onOpenTask?: (taskId: string) => void;
  onVerifyDone?: (taskId: string) => void;
}

function plural(count: number, singular: string, pluralName = `${singular}s`) {
  return count === 1 ? singular : pluralName;
}

function latestPlan(
  plans: readonly MnTaskPlanDto[] | undefined
): MnTaskPlanDto | null {
  if (!plans?.length) return null;
  return [...plans].sort((a, b) => b.revisionNumber - a.revisionNumber)[0];
}

function verificationLabel(
  verification: MnDoDVerificationResult | null | undefined
) {
  if (!verification) return 'Verify done not run';
  if (!verification.hasDefinition) return 'No definition of done';
  return verification.satisfied
    ? 'Verify done passed'
    : 'Verify done still open';
}

export function summarizeAgentTaskCockpit(
  input: AgentTaskCockpitInput
): AgentTaskCockpitSummary {
  const plan = latestPlan(input.plans);
  const pendingApprovalCount =
    input.approvals?.filter(
      approval =>
        approval.status === 'PENDING' ||
        approval.status === 'REVISION_REQUESTED'
    ).length ?? 0;

  return {
    taskTitle: input.task?.title ?? 'No task linked',
    taskStatus: input.task?.status ?? 'UNLINKED',
    latestPlanLabel: plan
      ? `Plan rev ${plan.revisionNumber} · ${plan.status}`
      : 'No plan yet',
    pendingApprovalCount,
    workProductCount: input.workProducts?.length ?? 0,
    verificationLabel: verificationLabel(input.verification),
  };
}

export const AgentTaskCockpitPanel = ({
  task,
  plans,
  approvals,
  workProducts,
  verification,
  onOpenTask,
  onVerifyDone,
}: AgentTaskCockpitPanelProps) => {
  const summary = useMemo(
    () =>
      summarizeAgentTaskCockpit({
        task,
        plans,
        approvals,
        workProducts,
        verification,
      }),
    [approvals, plans, task, verification, workProducts]
  );

  if (!task) return null;

  const approvalLabel = `${summary.pendingApprovalCount} ${plural(
    summary.pendingApprovalCount,
    'approval'
  )} pending`;
  const productLabel = `${summary.workProductCount} ${plural(
    summary.workProductCount,
    'work product'
  )}`;

  return (
    <section
      className={styles.cockpitRoot}
      aria-label="Agent task cockpit"
      data-testid="agent-task-cockpit"
    >
      <div className={styles.cockpitHeader}>
        <div>
          <div className={styles.cockpitEyebrow}>Task cockpit</div>
          <div className={styles.cockpitTitle} title={summary.taskTitle}>
            {summary.taskTitle}
          </div>
        </div>
        <div className={styles.cockpitStatus}>{summary.taskStatus}</div>
      </div>

      <div className={styles.cockpitGrid}>
        <div className={styles.cockpitMetric}>
          <div className={styles.metricLabel}>Plan</div>
          <div className={styles.metricValue}>{summary.latestPlanLabel}</div>
        </div>
        <div className={styles.cockpitMetric}>
          <div className={styles.metricLabel}>Approvals</div>
          <div className={styles.metricValue}>{approvalLabel}</div>
        </div>
        <div className={styles.cockpitMetric}>
          <div className={styles.metricLabel}>Produced work</div>
          <div className={styles.metricValue}>{productLabel}</div>
        </div>
        <div className={styles.cockpitMetric}>
          <div className={styles.metricLabel}>Verification</div>
          <div className={styles.metricValue}>{summary.verificationLabel}</div>
        </div>
      </div>

      {onOpenTask || onVerifyDone ? (
        <div className={styles.cockpitActions}>
          {onVerifyDone ? (
            <button
              type="button"
              className={styles.cockpitButton}
              onClick={() => onVerifyDone(task.id)}
            >
              Verify done
            </button>
          ) : null}
          {onOpenTask ? (
            <button
              type="button"
              className={styles.cockpitButton}
              onClick={() => {
                trackEvent('ai_agent_completion_event', {
                  action: 'source_opened',
                  surface: 'task_cockpit',
                  mode: 'unknown',
                  status: 'task',
                });
                onOpenTask(task.id);
              }}
            >
              Open task
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
};
