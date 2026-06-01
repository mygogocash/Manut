import type { MnProjectDto, MnTaskDto } from '../../../../modules/manut-pm';
import { toCsv } from '../../../../modules/manut-shared/csv';

export { downloadCsv, toCsv } from '../../../../modules/manut-shared/csv';

export function buildPmProjectsCsv(projects: readonly MnProjectDto[]) {
  return toCsv(
    [
      { header: 'Name', value: project => project.name },
      { header: 'Status', value: project => project.status },
      { header: 'Description', value: project => project.description },
      { header: 'Sort Order', value: project => project.sortOrder },
      { header: 'Created At', value: project => project.createdAt },
      { header: 'Updated At', value: project => project.updatedAt },
    ],
    projects
  );
}

export function buildPmTasksCsv(
  tasks: readonly MnTaskDto[],
  projectName: string | null
) {
  return toCsv(
    [
      { header: 'Project', value: () => projectName },
      { header: 'Title', value: task => task.title },
      { header: 'Status', value: task => task.status },
      { header: 'Priority', value: task => task.priority },
      { header: 'Due At', value: task => task.dueAt },
      { header: 'Assignee User ID', value: task => task.assigneeUserId },
      { header: 'Description', value: task => task.description },
      { header: 'Created At', value: task => task.createdAt },
      { header: 'Updated At', value: task => task.updatedAt },
    ],
    tasks
  );
}

export function pmExportFilename(
  entity: 'projects' | 'tasks',
  now = new Date()
) {
  return `manut-pm-${entity}-${now.toISOString().slice(0, 10)}.csv`;
}
