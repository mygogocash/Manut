import { Button, Input, Modal, notify } from '@affine/component';
import { useMutation } from '@affine/core/components/hooks/use-mutation';
import { useQuery } from '@affine/core/components/hooks/use-query';
import {
  type CreateMnProjectInput,
  createMnProjectMutation,
  type CreateMnTaskInput,
  createMnTaskMutation,
  deleteMnTaskMutation,
  MN_TASK_PRIORITIES,
  MN_TASK_STATUSES,
  type MnProjectDto,
  mnProjectsQuery,
  type MnTaskDto,
  type MnTaskPriority,
  mnTasksQuery,
  type MnTaskStatus,
  updateMnTaskStatusMutation,
} from '@affine/core/modules/manut-pm';
import {
  ViewBody,
  ViewHeader,
  ViewIcon,
  ViewTitle,
} from '@affine/core/modules/workbench';
import { WorkspaceService } from '@affine/core/modules/workspace';
import { isGraphQLSchemaValidationError } from '@affine/error';
import { DeleteIcon, FolderIcon, PlusIcon } from '@blocksuite/icons/rc';
import { useService } from '@toeverything/infra';
import {
  type ChangeEvent,
  Suspense,
  useCallback,
  useMemo,
  useState,
} from 'react';

import { Header } from '../../../../components/pure/header';
import { AllDocSidebarTabs } from '../layouts/all-doc-sidebar-tabs';
import * as styles from './projects.css';

interface ProjectsHeaderProps {
  onCreate: () => void;
}

const ProjectsHeader = ({ onCreate }: ProjectsHeaderProps) => (
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
      <Button variant="primary" prefix={<PlusIcon />} onClick={onCreate}>
        New project
      </Button>
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

function formatDueDate(value: string | null): string {
  if (!value) return '';
  const t = Date.parse(value);
  if (isNaN(t)) return '';
  const d = new Date(t);
  const now = new Date();
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
}

function priorityClass(priority: MnTaskPriority): string {
  switch (priority) {
    case 'URGENT':
      return styles.priorityUrgent;
    case 'HIGH':
      return styles.priorityHigh;
    case 'MEDIUM':
      return styles.priorityMedium;
    case 'LOW':
      return styles.priorityLow;
    case 'NONE':
    default:
      return styles.priorityNone;
  }
}

function readableStatus(value: MnTaskStatus): string {
  switch (value) {
    case 'IN_PROGRESS':
      return 'In progress';
    case 'BACKLOG':
      return 'Backlog';
    case 'TODO':
      return 'To do';
    case 'DONE':
      return 'Done';
    case 'CANCELLED':
      return 'Cancelled';
    default:
      return value;
  }
}

function readablePriority(value: MnTaskPriority): string {
  switch (value) {
    case 'NONE':
      return 'No priority';
    case 'LOW':
      return 'Low';
    case 'MEDIUM':
      return 'Medium';
    case 'HIGH':
      return 'High';
    case 'URGENT':
      return 'Urgent';
    default:
      return value;
  }
}

// en-only copy; follow-up to thread through i18n once we open that can.
const PROJECTS_UNAVAILABLE_MESSAGE =
  'Projects is not enabled on this workspace. Ask your administrator to enable the Manut module.';

function errorMessage(err: unknown): string {
  if (isGraphQLSchemaValidationError(err)) return PROJECTS_UNAVAILABLE_MESSAGE;
  return err instanceof Error ? err.message : 'Unexpected error';
}

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

interface NewTaskModalProps {
  open: boolean;
  projectId: string;
  onClose: () => void;
  onCreated: (task: MnTaskDto) => void;
}

const NewTaskModal = ({
  open,
  projectId,
  onClose,
  onCreated,
}: NewTaskModalProps) => {
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<MnTaskStatus>('TODO');
  const [priority, setPriority] = useState<MnTaskPriority>('MEDIUM');
  const [dueAt, setDueAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { trigger } = useMutation({ mutation: createMnTaskMutation });

  const reset = useCallback(() => {
    setTitle('');
    setStatus('TODO');
    setPriority('MEDIUM');
    setDueAt('');
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
      const trimmed = title.trim();
      if (!trimmed) {
        setError('Task title is required.');
        return;
      }
      setError(null);
      setSubmitting(true);
      try {
        const dueIso = dueAt ? new Date(dueAt).toISOString() : null;
        const input: CreateMnTaskInput = {
          title: trimmed,
          status,
          priority,
          dueAt: dueIso,
        };
        const response = (await (
          trigger as (args: unknown) => Promise<unknown>
        )({ projectId, input })) as { createMnTask?: MnTaskDto } | undefined;
        const created = response?.createMnTask;
        if (!created) {
          throw new Error('Server did not return the created task.');
        }
        notify.success({ title: `Added task "${created.title}"` });
        onCreated(created);
        reset();
        onClose();
      } catch (err) {
        const message = errorMessage(err);
        setError(message);
        notify.error({ title: 'Could not add task', message });
      } finally {
        setSubmitting(false);
      }
    },
    [
      dueAt,
      onClose,
      onCreated,
      priority,
      projectId,
      reset,
      status,
      title,
      trigger,
    ]
  );

  return (
    <Modal
      open={open}
      onOpenChange={value => {
        if (!value) handleClose();
      }}
      title="Add task"
      description="Create a new task in this project."
    >
      <form
        className={styles.formGrid}
        onSubmit={event => void handleSubmit(event)}
      >
        <div className={styles.fieldRow}>
          <label className={styles.fieldLabel} htmlFor="sf-task-title">
            Title
          </label>
          <Input
            id="sf-task-title"
            value={title}
            placeholder="What needs doing?"
            autoFocus
            onChange={setTitle}
          />
        </div>
        <div className={styles.fieldHorizontal}>
          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel} htmlFor="sf-task-status">
              Status
            </label>
            <select
              id="sf-task-status"
              className={styles.select}
              value={status}
              onChange={event => setStatus(event.target.value as MnTaskStatus)}
            >
              {MN_TASK_STATUSES.map(option => (
                <option key={option} value={option}>
                  {readableStatus(option)}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel} htmlFor="sf-task-priority">
              Priority
            </label>
            <select
              id="sf-task-priority"
              className={styles.select}
              value={priority}
              onChange={event =>
                setPriority(event.target.value as MnTaskPriority)
              }
            >
              {MN_TASK_PRIORITIES.map(option => (
                <option key={option} value={option}>
                  {readablePriority(option)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className={styles.fieldRow}>
          <label className={styles.fieldLabel} htmlFor="sf-task-due">
            Due date (optional)
          </label>
          <Input
            id="sf-task-due"
            type="date"
            value={dueAt}
            onChange={setDueAt}
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
            disabled={submitting || !title.trim()}
            onClick={event => void handleSubmit(event)}
          >
            Add task
          </Button>
        </div>
      </form>
    </Modal>
  );
};

interface TaskRowProps {
  task: MnTaskDto;
  onStatusChange: (taskId: string, status: MnTaskStatus) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
}

const TaskRow = ({ task, onStatusChange, onDelete }: TaskRowProps) => {
  const [pending, setPending] = useState(false);

  const handleStatusChange = useCallback(
    async (event: ChangeEvent<HTMLSelectElement>) => {
      const next = event.target.value as MnTaskStatus;
      if (next === task.status) return;
      setPending(true);
      try {
        await onStatusChange(task.id, next);
      } finally {
        setPending(false);
      }
    },
    [onStatusChange, task.id, task.status]
  );

  const handleDelete = useCallback(async () => {
    setPending(true);
    try {
      await onDelete(task.id);
    } finally {
      setPending(false);
    }
  }, [onDelete, task.id]);

  const done = task.status === 'DONE' || task.status === 'CANCELLED';
  const due = formatDueDate(task.dueAt);

  return (
    <div className={styles.taskRow} data-testid="manut-pm-task-row">
      <span className={done ? styles.taskTitleDone : styles.taskTitle}>
        {task.title}
      </span>
      <span className={`${styles.taskMeta} ${priorityClass(task.priority)}`}>
        {readablePriority(task.priority)}
      </span>
      <span className={styles.taskMeta}>{due || '-'}</span>
      <select
        className={styles.inlineSelect}
        value={task.status}
        disabled={pending}
        onChange={event => void handleStatusChange(event)}
        aria-label="Task status"
      >
        {MN_TASK_STATUSES.map(option => (
          <option key={option} value={option}>
            {readableStatus(option)}
          </option>
        ))}
      </select>
      <button
        type="button"
        className={styles.iconButton}
        onClick={() => void handleDelete()}
        disabled={pending}
        aria-label="Delete task"
        title="Delete task"
      >
        <DeleteIcon />
      </button>
    </div>
  );
};

interface ProjectCardProps {
  project: MnProjectDto;
  expanded: boolean;
  onToggle: (projectId: string) => void;
  onAddTaskClick: (projectId: string) => void;
  workspaceId: string;
}

const ProjectCard = ({
  project,
  expanded,
  onToggle,
  onAddTaskClick,
}: ProjectCardProps) => {
  return (
    <div className={styles.card} data-testid="manut-pm-project-card">
      <button
        type="button"
        className={styles.cardHeader}
        onClick={() => onToggle(project.id)}
        aria-expanded={expanded}
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
            {expanded ? 'Hide tasks' : 'Show tasks'}
          </span>
        </div>
      </button>
      {expanded ? (
        <div className={styles.cardBody}>
          <Suspense fallback={<SkeletonList />}>
            <ProjectTasksSection
              projectId={project.id}
              onAddTaskClick={() => onAddTaskClick(project.id)}
            />
          </Suspense>
        </div>
      ) : null}
    </div>
  );
};

interface ProjectTasksSectionProps {
  projectId: string;
  onAddTaskClick: () => void;
}

const ProjectTasksSection = ({
  projectId,
  onAddTaskClick,
}: ProjectTasksSectionProps) => {
  const queryArg = {
    query: mnTasksQuery,
    variables: { projectId },
  } as unknown as NonNullable<Parameters<typeof useQuery>[0]>;

  const { data, error, mutate } = useQuery(queryArg);

  const tasks = (data as unknown as { mnTasks?: MnTaskDto[] } | undefined)
    ?.mnTasks;

  const { trigger: triggerStatus } = useMutation({
    mutation: updateMnTaskStatusMutation,
  });
  const { trigger: triggerDelete } = useMutation({
    mutation: deleteMnTaskMutation,
  });

  const handleStatusChange = useCallback(
    async (taskId: string, next: MnTaskStatus) => {
      try {
        await (triggerStatus as (args: unknown) => Promise<unknown>)({
          taskId,
          status: next,
        });
        await mutate();
      } catch (err) {
        notify.error({
          title: 'Failed to update task',
          message: errorMessage(err),
        });
      }
    },
    [mutate, triggerStatus]
  );

  const handleDelete = useCallback(
    async (taskId: string) => {
      try {
        await (triggerDelete as (args: unknown) => Promise<unknown>)({
          taskId,
        });
        await mutate();
      } catch (err) {
        notify.error({
          title: 'Failed to delete task',
          message: errorMessage(err),
        });
      }
    },
    [mutate, triggerDelete]
  );

  if (error) {
    return (
      <div className={styles.errorBox} role="alert">
        <span>
          {isGraphQLSchemaValidationError(error)
            ? PROJECTS_UNAVAILABLE_MESSAGE
            : `Failed to load tasks: ${error.message}`}
        </span>
        <Button onClick={() => void mutate()}>Retry</Button>
      </div>
    );
  }

  if (!tasks || tasks.length === 0) {
    return (
      <>
        <div className={styles.emptyStateBody}>
          No tasks yet. Add the first one.
        </div>
        <div className={styles.taskFooterRow}>
          <span />
          <Button prefix={<PlusIcon />} onClick={onAddTaskClick}>
            Add task
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className={styles.taskList}>
        {tasks.map(task => (
          <TaskRow
            key={task.id}
            task={task}
            onStatusChange={handleStatusChange}
            onDelete={handleDelete}
          />
        ))}
      </div>
      <div className={styles.taskFooterRow}>
        <span className={styles.taskMeta}>
          {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
        </span>
        <Button prefix={<PlusIcon />} onClick={onAddTaskClick}>
          Add task
        </Button>
      </div>
    </>
  );
};

interface ProjectsListProps {
  workspaceId: string;
  expandedProjectId: string | null;
  onToggleExpand: (projectId: string) => void;
  onCreateProject: () => void;
  onAddTaskTo: (projectId: string) => void;
}

const ProjectsList = ({
  workspaceId,
  expandedProjectId,
  onToggleExpand,
  onCreateProject,
  onAddTaskTo,
}: ProjectsListProps) => {
  const queryArg = {
    query: mnProjectsQuery,
    variables: { workspaceId },
  } as unknown as NonNullable<Parameters<typeof useQuery>[0]>;

  const { data, error, mutate } = useQuery(queryArg);

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
    <div className={styles.list}>
      {projects.map(project => (
        <ProjectCard
          key={project.id}
          project={project}
          expanded={expandedProjectId === project.id}
          onToggle={onToggleExpand}
          onAddTaskClick={onAddTaskTo}
          workspaceId={workspaceId}
        />
      ))}
    </div>
  );
};

const ProjectsPage = () => {
  const workspaceService = useService(WorkspaceService);
  const workspaceId = workspaceService.workspace.id;

  const [creatingProject, setCreatingProject] = useState(false);
  const [addingTaskFor, setAddingTaskFor] = useState<string | null>(null);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(
    null
  );

  const handleToggleExpand = useCallback((projectId: string) => {
    setExpandedProjectId(prev => (prev === projectId ? null : projectId));
  }, []);

  const handleAddTaskTo = useCallback((projectId: string) => {
    setAddingTaskFor(projectId);
  }, []);

  const handleCreatedProject = useCallback((project: MnProjectDto) => {
    // Auto-expand the freshly created project so the user can add tasks
    // immediately. The SWR query refreshes itself on next render.
    setExpandedProjectId(project.id);
  }, []);

  const handleCreatedTask = useCallback(() => {
    // Tasks list re-fetches on its own SWR cycle.
  }, []);

  const fallback = useMemo(() => <SkeletonList />, []);

  return (
    <>
      <ViewTitle title="Projects" />
      <ViewIcon icon="allDocs" />
      <ViewHeader>
        <ProjectsHeader onCreate={() => setCreatingProject(true)} />
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
            <ProjectsList
              workspaceId={workspaceId}
              expandedProjectId={expandedProjectId}
              onToggleExpand={handleToggleExpand}
              onCreateProject={() => setCreatingProject(true)}
              onAddTaskTo={handleAddTaskTo}
            />
          </Suspense>
        </div>
        <NewProjectModal
          open={creatingProject}
          workspaceId={workspaceId}
          onClose={() => setCreatingProject(false)}
          onCreated={handleCreatedProject}
        />
        {addingTaskFor ? (
          <NewTaskModal
            open={true}
            projectId={addingTaskFor}
            onClose={() => setAddingTaskFor(null)}
            onCreated={handleCreatedTask}
          />
        ) : null}
      </ViewBody>
      <AllDocSidebarTabs />
    </>
  );
};

export const Component = () => <ProjectsPage />;
