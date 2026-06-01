import { Button, Input, Modal, notify } from '@affine/component';
import { useMutation } from '@affine/core/components/hooks/use-mutation';
import { useQuery } from '@affine/core/components/hooks/use-query';
import {
  type CreateMnProjectInput,
  createMnProjectMutation,
  type MnProjectDto,
  mnProjectsQuery,
  type MnTaskDto,
  type MnTaskPriority,
  mnTasksQuery,
  type MnTaskStatus,
  type UpdateMnTaskInput,
  updateMnTaskMutation,
  updateMnTaskStatusMutation,
} from '@affine/core/modules/manut-pm';
import {
  KanbanBoard,
  type KanbanColumn,
  type KanbanOnMoveArgs,
  MANUT_LIVE_QUERY_OPTIONS,
} from '@affine/core/modules/manut-shared';
import {
  ViewBody,
  ViewHeader,
  ViewIcon,
  ViewTitle,
  WorkbenchService,
} from '@affine/core/modules/workbench';
import { WorkspaceService } from '@affine/core/modules/workspace';
import { isGraphQLSchemaValidationError } from '@affine/error';
import { DownloadIcon, FolderIcon, PlusIcon } from '@blocksuite/icons/rc';
import { useService } from '@toeverything/infra';
import {
  type ChangeEvent,
  type MouseEvent as ReactMouseEvent,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { Header } from '../../../../components/pure/header';
import { AllDocSidebarTabs } from '../layouts/all-doc-sidebar-tabs';
import {
  buildPmProjectsCsv,
  downloadCsv,
  pmExportFilename,
} from './csv-export';
import { formatDueDate, priorityClass, readableStatus } from './helpers';
import * as styles from './projects.css';

type ProjectsViewMode = 'list' | 'kanban';

// Status columns used by the Kanban. BACKLOG is intentionally folded into
// TODO for v1 to keep the column count manageable — backlog tasks still
// surface in the list view.
const KANBAN_STATUSES: readonly MnTaskStatus[] = [
  'TODO',
  'IN_PROGRESS',
  'DONE',
  'CANCELLED',
];

interface ViewToggleProps {
  value: ProjectsViewMode;
  onChange: (next: ProjectsViewMode) => void;
}

const ViewToggle = ({ value, onChange }: ViewToggleProps) => (
  <div
    className={styles.viewToggleGroup}
    role="tablist"
    aria-label="View mode"
    data-testid="manut-pm-view-toggle"
  >
    <button
      type="button"
      role="tab"
      aria-selected={value === 'list'}
      data-active={value === 'list' ? 'true' : 'false'}
      className={styles.viewToggleButton}
      data-testid="manut-pm-view-list"
      onClick={() => onChange('list')}
    >
      List view
    </button>
    <button
      type="button"
      role="tab"
      aria-selected={value === 'kanban'}
      data-active={value === 'kanban' ? 'true' : 'false'}
      className={styles.viewToggleButton}
      data-testid="manut-pm-view-kanban"
      onClick={() => onChange('kanban')}
    >
      Kanban view
    </button>
  </div>
);

interface ProjectsHeaderProps {
  onCreate: () => void;
  viewMode: ProjectsViewMode;
  onViewModeChange: (next: ProjectsViewMode) => void;
}

const ProjectsHeader = ({
  onCreate,
  viewMode,
  onViewModeChange,
}: ProjectsHeaderProps) => (
  <Header
    left={
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 14,
          fontWeight: 500,
        }}
      >
        <FolderIcon /> Projects
      </span>
    }
    right={
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <ViewToggle value={viewMode} onChange={onViewModeChange} />
        <Button variant="primary" prefix={<PlusIcon />} onClick={onCreate}>
          New project
        </Button>
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

interface EmptyStateProps {
  onCreate: () => void;
}

const EmptyState = ({ onCreate }: EmptyStateProps) => (
  <div className={styles.emptyState} data-testid="manut-pm-empty">
    <div className={styles.emptyStateTitle}>No projects yet</div>
    <div className={styles.emptyStateBody}>
      Create your first project to organize tasks.
    </div>
    <div>
      <Button variant="primary" prefix={<PlusIcon />} onClick={onCreate}>
        New project
      </Button>
    </div>
  </div>
);

interface ErrorBoxProps {
  message: string;
  onRetry: () => void;
}

const ErrorBox = ({ message, onRetry }: ErrorBoxProps) => (
  <div className={styles.errorBox} role="alert">
    <span>Failed to load projects: {message}</span>
    <Button onClick={onRetry}>Retry</Button>
  </div>
);

// en-only copy; follow-up to thread through i18n once we open that can.
const PROJECTS_UNAVAILABLE_MESSAGE =
  'Projects is not enabled on this workspace. Ask your administrator to enable the Manut module.';

function errorMessage(err: unknown): string {
  if (isGraphQLSchemaValidationError(err)) return PROJECTS_UNAVAILABLE_MESSAGE;
  return err instanceof Error ? err.message : 'Unexpected error';
}

interface ProjectsExportToolbarProps {
  projects: readonly MnProjectDto[];
}

const ProjectsExportToolbar = ({ projects }: ProjectsExportToolbarProps) => {
  const handleExport = useCallback(() => {
    try {
      downloadCsv(pmExportFilename('projects'), buildPmProjectsCsv(projects));
      notify.success({
        title: 'CSV exported',
        message: `${projects.length} project${
          projects.length === 1 ? '' : 's'
        } exported.`,
      });
    } catch (err) {
      notify.error({
        title: 'Could not export projects',
        message: errorMessage(err),
      });
    }
  }, [projects]);

  return (
    <div className={styles.listToolbar}>
      <Button
        prefix={<DownloadIcon />}
        disabled={projects.length === 0}
        onClick={handleExport}
        data-testid="manut-pm-export-projects"
      >
        Export CSV
      </Button>
    </div>
  );
};

interface NewProjectModalProps {
  open: boolean;
  workspaceId: string;
  onClose: () => void;
  onCreated: (project: MnProjectDto) => void;
}

const NewProjectModal = ({
  open,
  workspaceId,
  onClose,
  onCreated,
}: NewProjectModalProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { trigger } = useMutation({ mutation: createMnProjectMutation });

  const reset = useCallback(() => {
    setName('');
    setDescription('');
    setError(null);
    setSubmitting(false);
  }, []);

  const handleClose = useCallback(() => {
    if (submitting) return;
    reset();
    onClose();
  }, [onClose, reset, submitting]);

  const handleSubmit = useCallback(
    async (event: { preventDefault: () => void }) => {
      event.preventDefault();
      const trimmed = name.trim();
      if (!trimmed) {
        setError('Project name is required.');
        return;
      }
      setError(null);
      setSubmitting(true);
      try {
        const input: CreateMnProjectInput = {
          name: trimmed,
          description: description.trim() ? description.trim() : null,
        };
        const response = (await (
          trigger as (args: unknown) => Promise<unknown>
        )({ workspaceId, input })) as
          | { createMnProject?: MnProjectDto }
          | undefined;
        const created = response?.createMnProject;
        if (!created) {
          throw new Error('Server did not return the created project.');
        }
        notify.success({ title: `Created project "${created.name}"` });
        onCreated(created);
        reset();
        onClose();
      } catch (err) {
        const message = errorMessage(err);
        setError(message);
        notify.error({ title: 'Could not create project', message });
      } finally {
        setSubmitting(false);
      }
    },
    [description, name, onClose, onCreated, reset, trigger, workspaceId]
  );

  return (
    <Modal
      open={open}
      onOpenChange={value => {
        if (!value) handleClose();
      }}
      title="New project"
      description="Group tasks under a project."
    >
      <form
        className={styles.formGrid}
        onSubmit={event => void handleSubmit(event)}
      >
        <div className={styles.fieldRow}>
          <label className={styles.fieldLabel} htmlFor="sf-project-name">
            Name
          </label>
          <Input
            id="sf-project-name"
            value={name}
            placeholder="e.g. Launch checklist"
            autoFocus
            onChange={setName}
          />
        </div>
        <div className={styles.fieldRow}>
          <label className={styles.fieldLabel} htmlFor="sf-project-desc">
            Description (optional)
          </label>
          <textarea
            id="sf-project-desc"
            className={styles.textarea}
            value={description}
            placeholder="What is this project for?"
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
              setDescription(event.target.value)
            }
          />
        </div>
        {error ? <div className={styles.formError}>{error}</div> : null}
        <div className={styles.formActions}>
          <Button onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={submitting}
            disabled={submitting || !name.trim()}
            onClick={event => void handleSubmit(event)}
          >
            Create project
          </Button>
        </div>
      </form>
    </Modal>
  );
};

interface ProjectCardProps {
  project: MnProjectDto;
  onOpen: (projectId: string) => void;
}

const ProjectCard = ({ project, onOpen }: ProjectCardProps) => {
  const handleOpen = useCallback(
    (event: ReactMouseEvent) => {
      // Only respond to primary mouse button so middle-click and modifier-clicks
      // can be ignored gracefully without unintended navigation.
      if (event.button !== 0) return;
      onOpen(project.id);
    },
    [onOpen, project.id]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onOpen(project.id);
      }
    },
    [onOpen, project.id]
  );

  return (
    <div className={styles.card} data-testid="manut-pm-project-card">
      <div
        className={styles.cardHeader}
        role="button"
        tabIndex={0}
        onClick={handleOpen}
        onKeyDown={handleKeyDown}
        data-testid="manut-pm-project-card-header"
      >
        <div className={styles.cardHeaderInfo}>
          <div className={styles.cardHeaderTitleRow}>
            <span className={styles.cardName}>{project.name}</span>
            <span
              className={
                project.status === 'ACTIVE'
                  ? `${styles.statusBadge} ${styles.statusBadgeActive}`
                  : styles.statusBadge
              }
            >
              {project.status === 'ACTIVE' ? 'Active' : 'Archived'}
            </span>
          </div>
          {project.description ? (
            <div className={styles.cardDescription}>{project.description}</div>
          ) : null}
        </div>
        <div className={styles.cardActions}>
          <span className={styles.taskCount} data-testid="task-count">
            Open
          </span>
        </div>
      </div>
    </div>
  );
};

// ProjectTasksSection has moved into ./detail.tsx — task rendering is now
// scoped to the project detail route. Index page is list-of-projects only.

interface KanbanTaskCard extends MnTaskDto {
  projectName: string;
}

interface ProjectTaskLoaderProps {
  project: MnProjectDto;
  onLoaded: (projectId: string, tasks: MnTaskDto[]) => void;
}

/**
 * Fetches one project's tasks via the existing `mnTasks(projectId)` query
 * and pushes them up to its parent. Used by `TasksKanbanView` so the
 * Kanban can aggregate across every project in the workspace without
 * waiting for a new backend resolver.
 *
 * Renders nothing; the SWR suspense boundary already lives in the parent.
 */
const ProjectTaskLoader = ({ project, onLoaded }: ProjectTaskLoaderProps) => {
  const queryArg = {
    query: mnTasksQuery,
    variables: { projectId: project.id },
  } as unknown as NonNullable<Parameters<typeof useQuery>[0]>;

  const { data } = useQuery(queryArg, MANUT_LIVE_QUERY_OPTIONS);
  const tasks =
    (data as unknown as { mnTasks?: MnTaskDto[] } | undefined)?.mnTasks ?? [];

  useEffect(() => {
    onLoaded(project.id, tasks);
    // We intentionally only depend on `data` here; the project id is stable
    // across re-renders and `onLoaded` is referentially stable in the
    // caller (wrapped in useCallback).
    // oxlint-disable-next-line react/exhaustive-deps
  }, [data, project.id]);

  return null;
};

function formatPriorityShort(priority: MnTaskPriority): string {
  switch (priority) {
    case 'NONE':
      return '–';
    case 'LOW':
      return 'Low';
    case 'MEDIUM':
      return 'Med';
    case 'HIGH':
      return 'High';
    case 'URGENT':
      return 'Urgent';
    default:
      return priority;
  }
}

interface TasksKanbanViewProps {
  projects: readonly MnProjectDto[];
  workspaceId: string;
}

const TasksKanbanView = ({ projects }: TasksKanbanViewProps) => {
  const [tasksByProject, setTasksByProject] = useState<
    Record<string, MnTaskDto[]>
  >({});

  const handleLoaded = useCallback((projectId: string, tasks: MnTaskDto[]) => {
    setTasksByProject(prev => {
      const existing = prev[projectId];
      // Skip the state update if the task list hasn't changed materially.
      // This avoids a render storm when SWR revalidates with identical
      // data, which would otherwise cycle through `setState` → re-render
      // → query revalidate → setState again.
      if (
        existing &&
        existing.length === tasks.length &&
        existing.every((task, idx) => {
          const next = tasks[idx];
          return (
            next?.id === task.id &&
            next?.status === task.status &&
            next?.listSortOrder === task.listSortOrder &&
            next?.title === task.title &&
            next?.priority === task.priority &&
            next?.dueAt === task.dueAt
          );
        })
      ) {
        return prev;
      }
      return { ...prev, [projectId]: tasks };
    });
  }, []);

  // Drop stale project entries when projects are deleted.
  useEffect(() => {
    setTasksByProject(prev => {
      const allowed = new Set(projects.map(p => p.id));
      const next: Record<string, MnTaskDto[]> = {};
      let changed = false;
      for (const [key, value] of Object.entries(prev)) {
        if (allowed.has(key)) {
          next[key] = value;
        } else {
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [projects]);

  const allCards = useMemo<KanbanTaskCard[]>(() => {
    const projectById = new Map(projects.map(p => [p.id, p]));
    const result: KanbanTaskCard[] = [];
    for (const project of projects) {
      const tasks = tasksByProject[project.id] ?? [];
      for (const task of tasks) {
        const owner = projectById.get(task.projectId);
        result.push({
          ...task,
          projectName: owner ? owner.name : '',
        });
      }
    }
    return result;
  }, [projects, tasksByProject]);

  const columns = useMemo<KanbanColumn<KanbanTaskCard>[]>(() => {
    return KANBAN_STATUSES.map(status => {
      const cards = allCards
        .filter(card => {
          // Surface BACKLOG tasks in the TODO column so users don't lose
          // sight of them in Kanban mode.
          if (status === 'TODO') {
            return card.status === 'TODO' || card.status === 'BACKLOG';
          }
          return card.status === status;
        })
        .sort((a, b) => {
          if (a.listSortOrder !== b.listSortOrder) {
            return a.listSortOrder - b.listSortOrder;
          }
          return a.createdAt.localeCompare(b.createdAt);
        });
      return {
        id: status,
        label: readableStatus(status),
        cards,
        meta: cards.length === 1 ? '1 task' : `${cards.length} tasks`,
      };
    });
  }, [allCards]);

  const { trigger: triggerStatus } = useMutation({
    mutation: updateMnTaskStatusMutation,
  });
  const { trigger: triggerUpdate } = useMutation({
    mutation: updateMnTaskMutation,
  });

  const applyOptimisticUpdate = useCallback(
    (cardId: string, mutator: (task: MnTaskDto) => MnTaskDto) => {
      setTasksByProject(prev => {
        let touchedProject: string | null = null;
        let nextTasks: MnTaskDto[] | null = null;
        for (const [pid, tasks] of Object.entries(prev)) {
          const idx = tasks.findIndex(task => task.id === cardId);
          if (idx >= 0) {
            const updated = mutator(tasks[idx] as MnTaskDto);
            nextTasks = tasks.slice();
            nextTasks[idx] = updated;
            touchedProject = pid;
            break;
          }
        }
        if (!touchedProject || !nextTasks) return prev;
        return { ...prev, [touchedProject]: nextTasks };
      });
    },
    []
  );

  const handleMove = useCallback(
    async ({ cardId, fromColumn, toColumn, toIndex }: KanbanOnMoveArgs) => {
      const nextStatus = toColumn as MnTaskStatus;
      const card = allCards.find(c => c.id === cardId);
      if (!card) return;

      // Compute a new listSortOrder by averaging neighbours on the
      // destination column. This keeps the ordering monotonic without
      // requiring the backend to re-index siblings.
      const destinationCards =
        columns.find(c => c.id === toColumn)?.cards ?? [];
      const without = destinationCards.filter(c => c.id !== cardId);
      const previous = without[toIndex - 1];
      const next = without[toIndex];
      const previousOrder = previous?.listSortOrder ?? 0;
      const nextOrder = next?.listSortOrder ?? previousOrder + 2;
      const newOrder = (previousOrder + nextOrder) / 2;

      // Optimistic local update so the card snaps to the new column before
      // the server round-trip completes.
      applyOptimisticUpdate(cardId, task => ({
        ...task,
        status: nextStatus,
        listSortOrder: newOrder,
      }));

      try {
        if (fromColumn !== toColumn) {
          await (triggerStatus as (args: unknown) => Promise<unknown>)({
            taskId: cardId,
            status: nextStatus,
          });
        }
        const updateInput: UpdateMnTaskInput = { listSortOrder: newOrder };
        if (fromColumn !== toColumn) {
          updateInput.status = nextStatus;
        }
        await (triggerUpdate as (args: unknown) => Promise<unknown>)({
          taskId: cardId,
          input: updateInput,
        });
      } catch (err) {
        notify.error({
          title: 'Could not move task',
          message: errorMessage(err),
        });
        // Restore the prior state on failure.
        applyOptimisticUpdate(cardId, task => ({
          ...task,
          status: card.status,
          listSortOrder: card.listSortOrder,
        }));
      }
    },
    [allCards, applyOptimisticUpdate, columns, triggerStatus, triggerUpdate]
  );

  return (
    <div className={styles.kanbanWrapper} data-testid="manut-pm-kanban">
      {projects.map(project => (
        <ProjectTaskLoader
          key={project.id}
          project={project}
          onLoaded={handleLoaded}
        />
      ))}
      <KanbanBoard<KanbanTaskCard>
        columns={columns}
        onMove={handleMove}
        testIdPrefix="manut-pm-kanban-board"
        emptyText="No tasks in this status."
        renderCard={card => (
          <div>
            <div className={styles.kanbanCardTitle}>{card.title}</div>
            <div className={styles.kanbanCardMetaRow}>
              {card.projectName ? (
                <span className={styles.kanbanCardProject}>
                  {card.projectName}
                </span>
              ) : null}
              <span
                className={`${styles.kanbanCardMeta} ${priorityClass(card.priority)}`}
              >
                {formatPriorityShort(card.priority)}
              </span>
              {card.dueAt ? (
                <span className={styles.kanbanCardMeta}>
                  {formatDueDate(card.dueAt) || '–'}
                </span>
              ) : null}
            </div>
          </div>
        )}
      />
    </div>
  );
};

interface ProjectsListProps {
  workspaceId: string;
  onCreateProject: () => void;
  onOpenProject: (projectId: string) => void;
}

const ProjectsList = ({
  workspaceId,
  onCreateProject,
  onOpenProject,
}: ProjectsListProps) => {
  const queryArg = {
    query: mnProjectsQuery,
    variables: { workspaceId },
  } as unknown as NonNullable<Parameters<typeof useQuery>[0]>;

  const { data, error, mutate } = useQuery(queryArg, MANUT_LIVE_QUERY_OPTIONS);

  const projects = (
    data as unknown as { mnProjects?: MnProjectDto[] } | undefined
  )?.mnProjects;

  if (error) {
    return (
      <ErrorBox
        message={
          isGraphQLSchemaValidationError(error)
            ? PROJECTS_UNAVAILABLE_MESSAGE
            : error.message
        }
        onRetry={() => void mutate()}
      />
    );
  }

  if (!projects || projects.length === 0) {
    return <EmptyState onCreate={onCreateProject} />;
  }

  return (
    <>
      <ProjectsExportToolbar projects={projects} />
      <div className={styles.list}>
        {projects.map(project => (
          <ProjectCard
            key={project.id}
            project={project}
            onOpen={onOpenProject}
          />
        ))}
      </div>
    </>
  );
};

interface ProjectsKanbanProps {
  workspaceId: string;
  onCreateProject: () => void;
}

const ProjectsKanban = ({
  workspaceId,
  onCreateProject,
}: ProjectsKanbanProps) => {
  const queryArg = {
    query: mnProjectsQuery,
    variables: { workspaceId },
  } as unknown as NonNullable<Parameters<typeof useQuery>[0]>;

  const { data, error, mutate } = useQuery(queryArg, MANUT_LIVE_QUERY_OPTIONS);

  const projects = (
    data as unknown as { mnProjects?: MnProjectDto[] } | undefined
  )?.mnProjects;

  if (error) {
    return <ErrorBox message={error.message} onRetry={() => void mutate()} />;
  }

  if (!projects || projects.length === 0) {
    return <EmptyState onCreate={onCreateProject} />;
  }

  return (
    <>
      <ProjectsExportToolbar projects={projects} />
      <TasksKanbanView projects={projects} workspaceId={workspaceId} />
    </>
  );
};

const ProjectsPage = () => {
  const workspaceService = useService(WorkspaceService);
  const workspaceId = workspaceService.workspace.id;
  const workbench = useService(WorkbenchService).workbench;

  const [creatingProject, setCreatingProject] = useState(false);

  const handleOpenProject = useCallback(
    (projectId: string) => {
      workbench.open(`/projects/${projectId}`);
    },
    [workbench]
  );
  const [viewMode, setViewMode] = useState<ProjectsViewMode>('list');

  const handleCreatedProject = useCallback(
    (project: MnProjectDto) => {
      // Open the freshly created project so the user can immediately add tasks
      // and edit details.
      workbench.open(`/projects/${project.id}`);
    },
    [workbench]
  );

  const handleViewModeChange = useCallback((next: ProjectsViewMode) => {
    setViewMode(next);
  }, []);

  const fallback = useMemo(() => <SkeletonList />, []);

  return (
    <>
      <ViewTitle title="Projects" />
      <ViewIcon icon="allDocs" />
      <ViewHeader>
        <ProjectsHeader
          onCreate={() => setCreatingProject(true)}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
        />
      </ViewHeader>
      <ViewBody>
        <div className={styles.root} data-testid="manut-pm-page">
          <div className={styles.titleBlock}>
            <div className={styles.title}>Projects &amp; tasks</div>
            <div className={styles.subtitle}>
              Track work for this workspace. Tasks live under projects you
              create.
            </div>
          </div>
          <Suspense fallback={fallback}>
            {viewMode === 'kanban' ? (
              <ProjectsKanban
                workspaceId={workspaceId}
                onCreateProject={() => setCreatingProject(true)}
              />
            ) : (
              <ProjectsList
                workspaceId={workspaceId}
                onCreateProject={() => setCreatingProject(true)}
                onOpenProject={handleOpenProject}
              />
            )}
          </Suspense>
        </div>
        <NewProjectModal
          open={creatingProject}
          workspaceId={workspaceId}
          onClose={() => setCreatingProject(false)}
          onCreated={handleCreatedProject}
        />
      </ViewBody>
      <AllDocSidebarTabs />
    </>
  );
};

export const Component = () => <ProjectsPage />;
