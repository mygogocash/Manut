import { describe, expect, test } from 'vitest';

import type { MnProjectDto, MnTaskDto } from '../../../../modules/manut-pm';
import { buildPmProjectsCsv, buildPmTasksCsv } from './csv-export';

const project: MnProjectDto = {
  id: 'project-1',
  workspaceId: 'workspace-1',
  name: 'Launch, checklist',
  description: 'Phase "one"',
  status: 'ACTIVE',
  sortOrder: 10,
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-02T00:00:00.000Z',
};

const task: MnTaskDto = {
  id: 'task-1',
  projectId: project.id,
  title: '=Risky spreadsheet title',
  description: 'Ship CSV export',
  status: 'IN_PROGRESS',
  priority: 'HIGH',
  dueAt: '2026-06-10T00:00:00.000Z',
  listSortOrder: 1,
  assigneeUserId: 'user-1',
  createdByUserId: 'user-2',
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-02T00:00:00.000Z',
};

describe('PM CSV export helpers', () => {
  test('buildPmProjectsCsv emits stable project columns', () => {
    expect(buildPmProjectsCsv([project])).toBe(
      [
        'Name,Status,Description,Sort Order,Created At,Updated At',
        '"Launch, checklist",ACTIVE,"Phase ""one""",10,2026-06-01T00:00:00.000Z,2026-06-02T00:00:00.000Z',
        '',
      ].join('\r\n')
    );
  });

  test('buildPmTasksCsv includes project name and neutralizes formula cells', () => {
    expect(buildPmTasksCsv([task], project.name)).toBe(
      [
        'Project,Title,Status,Priority,Due At,Assignee User ID,Description,Created At,Updated At',
        '"Launch, checklist",\'=Risky spreadsheet title,IN_PROGRESS,HIGH,2026-06-10T00:00:00.000Z,user-1,Ship CSV export,2026-06-01T00:00:00.000Z,2026-06-02T00:00:00.000Z',
        '',
      ].join('\r\n')
    );
  });
});
