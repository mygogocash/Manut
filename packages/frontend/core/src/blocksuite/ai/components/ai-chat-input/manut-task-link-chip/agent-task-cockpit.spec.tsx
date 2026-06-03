/**
 * @vitest-environment happy-dom
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';

import {
  AgentTaskCockpitPanel,
  summarizeAgentTaskCockpit,
} from './agent-task-cockpit';

const task = {
  id: 'task-1',
  projectId: 'project-1',
  title: 'Launch Full Agent beta',
  description: null,
  status: 'IN_PROGRESS',
  priority: 'HIGH',
  dueAt: null,
  listSortOrder: 0,
  assigneeUserId: null,
  createdByUserId: 'user-1',
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-02T00:00:00.000Z',
} as const;

const plans = [
  {
    id: 'plan-1',
    taskId: 'task-1',
    revisionNumber: 1,
    bodyMd: 'Old plan',
    status: 'SUPERSEDED',
    authorAgentId: null,
    authorUserId: 'user-1',
    reviewerComments: [],
    createdAt: '2026-06-01T00:00:00.000Z',
  },
  {
    id: 'plan-2',
    taskId: 'task-1',
    revisionNumber: 2,
    bodyMd: '1. Search evidence\n2. Save generated doc',
    status: 'APPROVED',
    authorAgentId: null,
    authorUserId: 'user-1',
    reviewerComments: [],
    createdAt: '2026-06-02T00:00:00.000Z',
  },
] as const;

const approvals = [
  {
    id: 'approval-1',
    workspaceId: 'workspace-1',
    projectId: 'project-1',
    type: 'TOOL_CALL_REVIEW',
    requestedByAgentId: null,
    requestedByUserId: 'user-1',
    status: 'PENDING',
    payload: { toolName: 'docUpdate' },
    decisionNote: null,
    decidedByUserId: null,
    decidedAt: null,
    createdAt: '2026-06-02T00:00:00.000Z',
    updatedAt: '2026-06-02T00:00:00.000Z',
  },
] as const;

const workProducts = [
  {
    id: 'work-product-1',
    workspaceId: 'workspace-1',
    projectId: 'project-1',
    taskId: 'task-1',
    producedByAgentId: null,
    kind: 'DOC',
    ref: 'doc-1',
    byteSize: null,
    title: 'Full Agent beta brief',
    description: null,
    metadata: {},
    createdAt: '2026-06-02T00:00:00.000Z',
  },
] as const;

afterEach(() => {
  cleanup();
});

describe('summarizeAgentTaskCockpit', () => {
  test('given task readout data > summarizes latest plan, approvals, products, and verification', () => {
    expect(
      summarizeAgentTaskCockpit({
        task,
        plans,
        approvals,
        workProducts,
        verification: {
          taskId: 'task-1',
          hasDefinition: true,
          satisfied: true,
          results: [
            {
              kind: 'WORK_PRODUCT_EXISTS',
              predicate: {
                kind: 'WORK_PRODUCT_EXISTS',
                taskId: 'task-1',
                productKind: 'DOC',
              },
              satisfied: true,
              evidence: { workProductId: 'work-product-1' },
              reason: null,
            },
          ],
        },
      })
    ).toEqual({
      taskTitle: 'Launch Full Agent beta',
      taskStatus: 'IN_PROGRESS',
      latestPlanLabel: 'Plan rev 2 · APPROVED',
      pendingApprovalCount: 1,
      workProductCount: 1,
      verificationLabel: 'Verify done passed',
    });
  });
});

describe('AgentTaskCockpitPanel', () => {
  test('given cockpit data > renders compact task cockpit readout', () => {
    render(
      <AgentTaskCockpitPanel
        task={task}
        plans={plans}
        approvals={approvals}
        workProducts={workProducts}
        verification={{
          taskId: 'task-1',
          hasDefinition: true,
          satisfied: false,
          results: [],
        }}
      />
    );

    expect(screen.getByTestId('agent-task-cockpit')).toBeTruthy();
    expect(screen.getByText('Launch Full Agent beta')).toBeTruthy();
    expect(screen.getByText('Plan rev 2 · APPROVED')).toBeTruthy();
    expect(screen.getByText('1 approval pending')).toBeTruthy();
    expect(screen.getByText('1 work product')).toBeTruthy();
    expect(screen.getByText('Verify done still open')).toBeTruthy();
  });
});
