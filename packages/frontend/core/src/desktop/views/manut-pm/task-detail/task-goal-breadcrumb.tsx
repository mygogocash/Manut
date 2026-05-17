import type {
  MnGoalAncestryStep,
  MnTaskAncestry,
  MnTaskAncestryStep,
} from '@affine/core/modules/manut-pm';
import { useCallback } from 'react';

import * as styles from './task-goal-breadcrumb.css';

interface TaskGoalBreadcrumbProps {
  /**
   * Ancestry data returned by the `mnTaskAncestry` query. `null` is a
   * valid empty state (caller may still be loading or the task is not
   * linked to a goal). The component renders a friendly empty marker
   * in that case rather than nothing — the breadcrumb container needs
   * to stay at a constant height to avoid layout shift.
   */
  ancestry: MnTaskAncestry | null;
  /** Optional click handler when the user picks a step. */
  onSelectGoal?: (goalId: string) => void;
  /** Optional click handler when the user picks an ancestor task. */
  onSelectTask?: (taskId: string) => void;
}

/**
 * Read-only breadcrumb showing a task's place in the goal hierarchy.
 *
 * Layout (root → leaf):
 *   [PROJECT] Strategy › [TEAM] Tactic › ParentTask › CurrentTask
 *
 * Goal steps have a level badge and dim ACHIEVED/CANCELLED variants.
 * Ancestor tasks render in a neutral pill. The current task is bolded
 * and not clickable.
 *
 * All animations and visual state (hover, status dim, badge colours)
 * live in the `.css.ts` sibling — keep style({}) out of this file
 * (CLAUDE.md vanilla-extract scar).
 */
export const TaskGoalBreadcrumb = ({
  ancestry,
  onSelectGoal,
  onSelectTask,
}: TaskGoalBreadcrumbProps) => {
  const handleGoal = useCallback(
    (id: string) => () => onSelectGoal?.(id),
    [onSelectGoal]
  );
  const handleTask = useCallback(
    (id: string) => () => onSelectTask?.(id),
    [onSelectTask]
  );

  if (!ancestry) {
    return (
      <div
        className={styles.breadcrumbRoot}
        data-testid="task-goal-breadcrumb-empty"
      >
        <span className={styles.emptyState}>Not linked to a goal yet</span>
      </div>
    );
  }

  const { goalChain, taskAncestors, taskTitle } = ancestry;
  const hasContent = goalChain.length > 0 || taskAncestors.length > 0;

  if (!hasContent) {
    return (
      <div
        className={styles.breadcrumbRoot}
        data-testid="task-goal-breadcrumb-floating"
      >
        <span className={styles.currentTaskLabel}>{taskTitle}</span>
        <span className={styles.emptyState}>(no parent goal or task)</span>
      </div>
    );
  }

  return (
    <div className={styles.breadcrumbRoot} data-testid="task-goal-breadcrumb">
      {goalChain.map((step, idx) => (
        <GoalStep
          key={`goal-${step.goalId}`}
          step={step}
          isFirst={idx === 0}
          onClick={handleGoal(step.goalId)}
        />
      ))}
      {goalChain.length > 0 && taskAncestors.length > 0 ? (
        <span className={styles.breadcrumbSeparator} aria-hidden>
          ›
        </span>
      ) : null}
      {taskAncestors.map((step, idx) => (
        <TaskAncestorStep
          key={`task-${step.taskId}`}
          step={step}
          isFirstAfterGoals={idx === 0 && goalChain.length === 0}
          onClick={handleTask(step.taskId)}
        />
      ))}
      {goalChain.length > 0 || taskAncestors.length > 0 ? (
        <span className={styles.breadcrumbSeparator} aria-hidden>
          ›
        </span>
      ) : null}
      <span
        className={styles.currentTaskLabel}
        data-testid="task-goal-breadcrumb-current"
      >
        {taskTitle}
      </span>
    </div>
  );
};

interface GoalStepProps {
  step: MnGoalAncestryStep;
  isFirst: boolean;
  onClick: () => void;
}

const GoalStep = ({ step, isFirst, onClick }: GoalStepProps) => {
  return (
    <>
      {!isFirst ? (
        <span className={styles.breadcrumbSeparator} aria-hidden>
          ›
        </span>
      ) : null}
      <button
        type="button"
        className={styles.breadcrumbItem}
        data-level={step.level}
        data-status={step.status}
        onClick={onClick}
      >
        <span className={styles.breadcrumbBadge}>{step.level}</span>
        <span>{step.title}</span>
      </button>
    </>
  );
};

interface TaskAncestorStepProps {
  step: MnTaskAncestryStep;
  isFirstAfterGoals: boolean;
  onClick: () => void;
}

const TaskAncestorStep = ({
  step,
  isFirstAfterGoals,
  onClick,
}: TaskAncestorStepProps) => {
  return (
    <>
      {!isFirstAfterGoals ? (
        <span className={styles.breadcrumbSeparator} aria-hidden>
          ›
        </span>
      ) : null}
      <button type="button" className={styles.taskLabel} onClick={onClick}>
        {step.title}
      </button>
    </>
  );
};
