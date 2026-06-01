import {
  Button,
  Input,
  Modal,
  notify,
  useConfirmModal,
} from '@affine/component';
import { useMutation } from '@affine/core/components/hooks/use-mutation';
import { useQuery } from '@affine/core/components/hooks/use-query';
import {
  archiveMnProjectMutation,
  type CreateMnTaskInput,
  createMnTaskMutation,
  deleteMnTaskMutation,
  MN_TASK_PRIORITIES,
  MN_TASK_STATUSES,
  type MnProjectDto,
  mnProjectsQuery,
  type MnProjectStatus,
  type MnTaskDto,
  type MnTaskPriority,
  mnTasksQuery,
  type MnTaskStatus,
  type UpdateMnProjectInput,
  updateMnProjectMutation,
  type UpdateMnTaskInput,
  updateMnTaskMutation,
  updateMnTaskStatusMutation,
} from '@affine/core/modules/manut-pm';
import { MANUT_LIVE_QUERY_OPTIONS } from '@affine/core/modules/manut-shared';
import {
  ViewBody,
  ViewHeader,
  ViewIcon,
  ViewTitle,
  WorkbenchService,
} from '@affine/core/modules/workbench';
import { WorkspaceService } from '@affine/core/modules/workspace';
import {
  ArrowLeftBigIcon,
  DeleteIcon,
  DownloadIcon,
  EditIcon,
  PlusIcon,
} from '@blocksuite/icons/rc';
import { useService } from '@toeverything/infra';
import {
  type ChangeEvent,
  type FC,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useParams } from 'react-router-dom';

import { Header } from '../../../../components/pure/header';
import { AllDocSidebarTabs } from '../layouts/all-doc-sidebar-tabs';
import { buildPmTasksCsv, downloadCsv, pmExportFilename } from './csv-export';
import * as styles from './detail.css';
import {
  dueAtInputValue,
  dueAtToIso,
  formatDueDate,
  priorityClass,
  readablePriority,
  readableStatus,
} from './helpers';
import * as listStyles from './projects.css';

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Unexpected error';
}

// -------------------- Project edit modal --------------------

interface EditProjectModalProps {
  open: boolean;
  project: MnProjectDto;
  onClose: () => void;
  onSaved: (project: MnProjectDto) => void;
}

const EditProjectModal: FC<EditProjectModalProps> = ({
  open,
  project,
  onClose,
  onSaved,
}) => {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? '');
  const [status, setStatus] = useState<MnProjectStatus>(project.status);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(project.name);
      setDescription(project.description ?? '');
      setStatus(project.status);
      setError(null);
    }
  }, [open, project.description, project.name, project.status]);

  const { trigger } = useMutation({ mutation: updateMnProjectMutation });

  const handleClose = useCallback(() => {
    if (submitting) return;
    onClose();
  }, [onClose, submitting]);

  const handleSubmit = useCallback(
    async (event: { preventDefault: () => void }) => {
      event.preventDefault();
      const trimmedName = name.trim();
      if (!trimmedName) {
        setError('Project name is required.');
        return;
      }
      setError(null);
      setSubmitting(true);
      try {
        const input: UpdateMnProjectInput = {
          name: trimmedName,
          description: description.trim() ? description.trim() : null,
          status,
        };
        const response = (await (
          trigger as (args: unknown) => Promise<unknown>
        )({ projectId: project.id, input })) as
          | { updateMnProject?: MnProjectDto }
          | undefined;
        const updated = response?.updateMnProject;
        if (!updated) {
          throw new Error('Server did not return the updated project.');
        }
        notify.success({ title: `Updated "${updated.name}"` });
        onSaved(updated);
        onClose();
      } catch (err) {
        const message = errorMessage(err);
        setError(message);
        notify.error({ title: 'Could not update project', message });
      } finally {
        setSubmitting(false);
      }
    },
    [description, name, onClose, onSaved, project.id, status, trigger]
  );

  return (
    <Modal
      open={open}
      onOpenChange={value => {
        if (!value) handleClose();
      }}
      title="Edit project"
      description="Update the project name, description, or status."
    >
      <form
        className={listStyles.formGrid}
        onSubmit={event => void handleSubmit(event)}
      >
        <div className={listStyles.fieldRow}>
          <label
            className={listStyles.fieldLabel}
            htmlFor="manut-project-edit-name"
          >
            Name
          </label>
          <Input
            id="manut-project-edit-name"
            value={name}
            autoFocus
            onChange={setName}
          />
        </div>
        <div className={listStyles.fieldRow}>
          <label
            className={listStyles.fieldLabel}
            htmlFor="manut-project-edit-desc"
          >
            Description
          </label>
          <textarea
            id="manut-project-edit-desc"
            className={listStyles.textarea}
            value={description}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
              setDescription(event.target.value)
            }
          />
        </div>
        <div className={listStyles.fieldRow}>
          <label
            className={listStyles.fieldLabel}
            htmlFor="manut-project-edit-status"
          >
            Status
          </label>
          <select
            id="manut-project-edit-status"
            className={listStyles.select}
            value={status}
            onChange={event => setStatus(event.target.value as MnProjectStatus)}
          >
            <option value="ACTIVE">Active</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
        {error ? <div className={listStyles.formError}>{error}</div> : null}
        <div className={listStyles.formActions}>
          <Button onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={submitting}
            disabled={submitting || !name.trim()}
            onClick={event => void handleSubmit(event)}
          >
            Save changes
          </Button>
        </div>
      </form>
    </Modal>
  );
};

// -------------------- Task edit modal --------------------

interface EditTaskModalProps {
  open: boolean;
  task: MnTaskDto;
  onClose: () => void;
  onSaved: (task: MnTaskDto) => void;
}

const EditTaskModal: FC<EditTaskModalProps> = ({
  open,
  task,
  onClose,
  onSaved,
}) => {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? '');
  const [status, setStatus] = useState<MnTaskStatus>(task.status);
  const [priority, setPriority] = useState<MnTaskPriority>(task.priority);
  const [dueAt, setDueAt] = useState(dueAtInputValue(task.dueAt));
  const [assigneeUserId, setAssigneeUserId] = useState(
    task.assigneeUserId ?? ''
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTitle(task.title);
      setDescription(task.description ?? '');
      setStatus(task.status);
      setPriority(task.priority);
      setDueAt(dueAtInputValue(task.dueAt));
      setAssigneeUserId(task.assigneeUserId ?? '');
      setError(null);
    }
  }, [
    open,
    task.assigneeUserId,
    task.description,
    task.dueAt,
    task.priority,
    task.status,
    task.title,
  ]);

  const { trigger } = useMutation({ mutation: updateMnTaskMutation });

  const handleClose = useCallback(() => {
    if (submitting) return;
    onClose();
  }, [onClose, submitting]);

  const handleSubmit = useCallback(
    async (event: { preventDefault: () => void }) => {
      event.preventDefault();
      const trimmedTitle = title.trim();
      if (!trimmedTitle) {
        setError('Task title is required.');
        return;
      }
      setError(null);
      setSubmitting(true);
      try {
        const trimmedAssignee = assigneeUserId.trim();
        const input: UpdateMnTaskInput = {
          title: trimmedTitle,
          description: description.trim() ? description.trim() : null,
          status,
          priority,
          dueAt: dueAtToIso(dueAt),
          assigneeUserId: trimmedAssignee ? trimmedAssignee : null,
        };
        const response = (await (
          trigger as (args: unknown) => Promise<unknown>
        )({ taskId: task.id, input })) as
          | { updateMnTask?: MnTaskDto }
          | undefined;
        const updated = response?.updateMnTask;
        if (!updated) {
          throw new Error('Server did not return the updated task.');
        }
        notify.success({ title: `Updated "${updated.title}"` });
        onSaved(updated);
        onClose();
      } catch (err) {
        const message = errorMessage(err);
        setError(message);
        notify.error({ title: 'Could not update task', message });
      } finally {
        setSubmitting(false);
      }
    },
    [
      assigneeUserId,
      description,
      dueAt,
      onClose,
      onSaved,
      priority,
      status,
      task.id,
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
      title="Edit task"
      description="Update task details."
    >
      <form
        className={listStyles.formGrid}
        onSubmit={event => void handleSubmit(event)}
      >
        <div className={listStyles.fieldRow}>
          <label
            className={listStyles.fieldLabel}
            htmlFor="manut-task-edit-title"
          >
            Title
          </label>
          <Input
            id="manut-task-edit-title"
            value={title}
            autoFocus
            onChange={setTitle}
          />
        </div>
        <div className={listStyles.fieldRow}>
          <label
            className={listStyles.fieldLabel}
            htmlFor="manut-task-edit-desc"
          >
            Description
          </label>
          <textarea
            id="manut-task-edit-desc"
            className={listStyles.textarea}
            value={description}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
              setDescription(event.target.value)
            }
          />
        </div>
        <div className={listStyles.fieldHorizontal}>
          <div className={listStyles.fieldRow}>
            <label
              className={listStyles.fieldLabel}
              htmlFor="manut-task-edit-status"
            >
              Status
            </label>
            <select
              id="manut-task-edit-status"
              className={listStyles.select}
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
          <div className={listStyles.fieldRow}>
            <label
              className={listStyles.fieldLabel}
              htmlFor="manut-task-edit-priority"
            >
              Priority
            </label>
            <select
              id="manut-task-edit-priority"
              className={listStyles.select}
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
        <div className={listStyles.fieldRow}>
          <label
            className={listStyles.fieldLabel}
            htmlFor="manut-task-edit-due"
          >
            Due date
          </label>
          <Input
            id="manut-task-edit-due"
            type="date"
            value={dueAt}
            onChange={setDueAt}
          />
        </div>
        <div className={listStyles.fieldRow}>
          <label
            className={listStyles.fieldLabel}
            htmlFor="manut-task-edit-assignee"
          >
            Assignee user id (optional)
          </label>
          <Input
            id="manut-task-edit-assignee"
            value={assigneeUserId}
            placeholder="Workspace member user id"
            onChange={setAssigneeUserId}
          />
        </div>
        {error ? <div className={listStyles.formError}>{error}</div> : null}
        <div className={listStyles.formActions}>
          <Button onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={submitting}
            disabled={submitting || !title.trim()}
            onClick={event => void handleSubmit(event)}
          >
            Save changes
          </Button>
        </div>
      </form>
    </Modal>
  );
};

// -------------------- New task modal (reused from list page conceptually) --------------------

interface NewTaskModalProps {
  open: boolean;
  projectId: string;
  onClose: () => void;
  onCreated: (task: MnTaskDto) => void;
}

const NewTaskModal: FC<NewTaskModalProps> = ({
  open,
  projectId,
  onClose,
  onCreated,
}) => {
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
        const dueIso = dueAtToIso(dueAt);
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
        className={listStyles.formGrid}
        onSubmit={event => void handleSubmit(event)}
      >
        <div className={listStyles.fieldRow}>
          <label
            className={listStyles.fieldLabel}
            htmlFor="manut-task-new-title"
          >
            Title
          </label>
          <Input
            id="manut-task-new-title"
            value={title}
            placeholder="What needs doing?"
            autoFocus
            onChange={setTitle}
          />
        </div>
        <div className={listStyles.fieldHorizontal}>
          <div className={listStyles.fieldRow}>
            <label
              className={listStyles.fieldLabel}
              htmlFor="manut-task-new-status"
            >
              Status
            </label>
            <select
              id="manut-task-new-status"
              className={listStyles.select}
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
          <div className={listStyles.fieldRow}>
            <label
              className={listStyles.fieldLabel}
              htmlFor="manut-task-new-priority"
            >
              Priority
            </label>
            <select
              id="manut-task-new-priority"
              className={listStyles.select}
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
        <div className={listStyles.fieldRow}>
          <label className={listStyles.fieldLabel} htmlFor="manut-task-new-due">
            Due date (optional)
          </label>
          <Input
            id="manut-task-new-due"
            type="date"
            value={dueAt}
            onChange={setDueAt}
          />
        </div>
        {error ? <div className={listStyles.formError}>{error}</div> : null}
        <div className={listStyles.formActions}>
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

// -------------------- Task row --------------------

interface TaskRowProps {
  task: MnTaskDto;
  onStatusChange: (taskId: string, status: MnTaskStatus) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
  onEdit: (task: MnTaskDto) => void;
}

const TaskRow: FC<TaskRowProps> = ({
  task,
  onStatusChange,
  onDelete,
  onEdit,
}) => {
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

  const handleDelete = useCallback(
    async (event: React.MouseEvent) => {
      event.stopPropagation();
      setPending(true);
      try {
        await onDelete(task.id);
      } finally {
        setPending(false);
      }
    },
    [onDelete, task.id]
  );

  const handleEdit = useCallback(
    (event: React.MouseEvent) => {
      // Don't open the editor when interacting with the status select or
      // the inline delete button.
      const target = event.target as HTMLElement | null;
      if (target && target.closest('select,button')) {
        return;
      }
      onEdit(task);
    },
    [onEdit, task]
  );

  const done = task.status === 'DONE' || task.status === 'CANCELLED';
  const due = formatDueDate(task.dueAt);

  return (
    <div
      className={`${listStyles.taskRow} ${styles.taskRowClickable}`}
      data-testid="manut-pm-task-row"
      role="button"
      tabIndex={0}
      onClick={handleEdit}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onEdit(task);
        }
      }}
    >
      <span className={done ? listStyles.taskTitleDone : listStyles.taskTitle}>
        {task.title}
      </span>
      <span
        className={`${listStyles.taskMeta} ${priorityClass(task.priority)}`}
      >
        {readablePriority(task.priority)}
      </span>
      <span className={listStyles.taskMeta}>{due || '-'}</span>
      <select
        className={listStyles.inlineSelect}
        value={task.status}
        disabled={pending}
        onChange={event => void handleStatusChange(event)}
        onClick={event => event.stopPropagation()}
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
        className={listStyles.iconButton}
        onClick={event => void handleDelete(event)}
        disabled={pending}
        aria-label="Delete task"
        title="Delete task"
      >
        <DeleteIcon />
      </button>
    </div>
  );
};

// -------------------- Project tasks list --------------------

interface ProjectTasksProps {
  projectId: string;
  projectName: string;
  onAddTaskClick: () => void;
  onEditTask: (task: MnTaskDto) => void;
}

const ProjectTasks: FC<ProjectTasksProps> = ({
  projectId,
  projectName,
  onAddTaskClick,
  onEditTask,
}) => {
  const queryArg = {
    query: mnTasksQuery,
    variables: { projectId },
  } as unknown as NonNullable<Parameters<typeof useQuery>[0]>;

  const { data, error, mutate } = useQuery(queryArg, MANUT_LIVE_QUERY_OPTIONS);

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

  const handleExport = useCallback(() => {
    if (!tasks || tasks.length === 0) return;
    try {
      downloadCsv(
        pmExportFilename('tasks'),
        buildPmTasksCsv(tasks, projectName)
      );
      notify.success({
        title: 'CSV exported',
        message: `${tasks.length} task${tasks.length === 1 ? '' : 's'} exported.`,
      });
    } catch (err) {
      notify.error({
        title: 'Could not export tasks',
        message: errorMessage(err),
      });
    }
  }, [projectName, tasks]);

  if (error) {
    return (
      <div className={listStyles.errorBox} role="alert">
        <span>Failed to load tasks: {error.message}</span>
        <Button onClick={() => void mutate()}>Retry</Button>
      </div>
    );
  }

  if (!tasks || tasks.length === 0) {
    return (
      <>
        <div className={listStyles.emptyStateBody}>
          No tasks yet. Add the first one.
        </div>
        <div className={listStyles.taskFooterRow}>
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
      <div className={listStyles.taskList}>
        {tasks.map(task => (
          <TaskRow
            key={task.id}
            task={task}
            onStatusChange={handleStatusChange}
            onDelete={handleDelete}
            onEdit={onEditTask}
          />
        ))}
      </div>
      <div className={listStyles.taskFooterRow}>
        <span className={listStyles.taskMeta}>
          {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
        </span>
        <div className={listStyles.taskFooterActions}>
          <Button
            prefix={<DownloadIcon />}
            onClick={handleExport}
            data-testid="manut-pm-export-tasks"
          >
            Export CSV
          </Button>
          <Button prefix={<PlusIcon />} onClick={onAddTaskClick}>
            Add task
          </Button>
        </div>
      </div>
    </>
  );
};

// -------------------- Detail body --------------------

interface ProjectDetailBodyProps {
  projectId: string;
  workspaceId: string;
}

const ProjectDetailBody: FC<ProjectDetailBodyProps> = ({
  projectId,
  workspaceId,
}) => {
  const queryArg = {
    query: mnProjectsQuery,
    variables: { workspaceId },
  } as unknown as NonNullable<Parameters<typeof useQuery>[0]>;

  const { data, error, mutate } = useQuery(queryArg, MANUT_LIVE_QUERY_OPTIONS);

  const project = useMemo(() => {
    const projects = (
      data as unknown as { mnProjects?: MnProjectDto[] } | undefined
    )?.mnProjects;
    return projects?.find(p => p.id === projectId);
  }, [data, projectId]);

  const workbench = useService(WorkbenchService).workbench;
  const { openConfirmModal } = useConfirmModal();

  const [editing, setEditing] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [editingTask, setEditingTask] = useState<MnTaskDto | null>(null);

  const { trigger: triggerArchive } = useMutation({
    mutation: archiveMnProjectMutation,
  });

  const handleSaved = useCallback(
    (_updated: MnProjectDto) => {
      // Refresh the project list query so the header reflects new values.
      mutate().catch(err => {
        console.error('Failed to refresh projects', err);
      });
    },
    [mutate]
  );

  const handleArchive = useCallback(() => {
    if (!project) return;
    openConfirmModal({
      title: 'Archive project?',
      description: (
        <span>
          Archiving “{project.name}” hides it from active project lists. You can
          restore it later by editing the project status.
        </span>
      ),
      confirmText: 'Archive project',
      cancelText: 'Cancel',
      confirmButtonOptions: { variant: 'error' },
      onConfirm: async () => {
        try {
          await (triggerArchive as (args: unknown) => Promise<unknown>)({
            projectId: project.id,
          });
          notify.success({ title: `Archived “${project.name}”` });
          await mutate();
          workbench.open('/projects');
        } catch (err) {
          notify.error({
            title: 'Could not archive project',
            message: errorMessage(err),
          });
        }
      },
    });
  }, [mutate, openConfirmModal, project, triggerArchive, workbench]);

  const handleBack = useCallback(() => {
    workbench.open('/projects');
  }, [workbench]);

  if (error) {
    return (
      <div className={listStyles.errorBox} role="alert">
        <span>Failed to load project: {error.message}</span>
        <Button onClick={() => void mutate()}>Retry</Button>
      </div>
    );
  }

  if (!project) {
    return (
      <div className={styles.notFound} data-testid="manut-pm-project-not-found">
        <span className={styles.notFoundTitle}>Project not found</span>
        <span>The project you are looking for may have been deleted.</span>
        <Button prefix={<ArrowLeftBigIcon />} onClick={handleBack}>
          Back to projects
        </Button>
      </div>
    );
  }

  const archived = project.status === 'ARCHIVED';

  return (
    <div className={styles.scroll}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <div className={styles.headerTopRow}>
            <div className={styles.headerInfo}>
              <div className={styles.titleRow}>
                <h1 className={styles.nameInput}>{project.name}</h1>
                <span
                  className={
                    archived
                      ? styles.statusBadge
                      : `${styles.statusBadge} ${styles.statusBadgeActive}`
                  }
                  data-testid="manut-pm-detail-status"
                >
                  {archived ? 'Archived' : 'Active'}
                </span>
              </div>
              <div
                className={
                  project.description
                    ? styles.description
                    : `${styles.description} ${styles.descriptionEmpty}`
                }
              >
                {project.description ?? 'No description yet.'}
              </div>
            </div>
            <div className={styles.headerActions}>
              <Button prefix={<ArrowLeftBigIcon />} onClick={handleBack}>
                Back
              </Button>
              <Button prefix={<EditIcon />} onClick={() => setEditing(true)}>
                Edit project
              </Button>
              {!archived ? (
                <Button variant="error" onClick={handleArchive}>
                  Archive
                </Button>
              ) : null}
            </div>
          </div>
          {archived ? (
            <div className={styles.archiveBanner}>
              This project is archived. Edit the project to restore it to
              Active.
            </div>
          ) : null}
        </header>

        <section className={styles.sections}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>Tasks</span>
            <Button
              variant="primary"
              prefix={<PlusIcon />}
              onClick={() => setCreatingTask(true)}
            >
              Add task
            </Button>
          </div>
          <Suspense
            fallback={
              <div className={listStyles.skeletonGroup}>
                <div className={listStyles.skeletonRow} />
                <div className={listStyles.skeletonRow} />
              </div>
            }
          >
            <ProjectTasks
              projectId={project.id}
              projectName={project.name}
              onAddTaskClick={() => setCreatingTask(true)}
              onEditTask={setEditingTask}
            />
          </Suspense>
        </section>
      </div>

      <EditProjectModal
        open={editing}
        project={project}
        onClose={() => setEditing(false)}
        onSaved={handleSaved}
      />
      <NewTaskModal
        open={creatingTask}
        projectId={project.id}
        onClose={() => setCreatingTask(false)}
        onCreated={() => {
          /* tasks list will refetch via its own SWR cycle */
        }}
      />
      {editingTask ? (
        <EditTaskModal
          open={true}
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onSaved={() => {
            /* tasks list will refetch via its own SWR cycle */
          }}
        />
      ) : null}
    </div>
  );
};

// -------------------- Page wrapper --------------------

const ProjectDetailPage: FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const workspaceService = useService(WorkspaceService);
  const workspaceId = workspaceService.workspace.id;

  return (
    <>
      <ViewTitle title="Project" />
      <ViewIcon icon="allDocs" />
      <ViewHeader>
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
              Project detail
            </span>
          }
        />
      </ViewHeader>
      <ViewBody>
        <div className={styles.root} data-testid="manut-pm-detail-page">
          {!projectId ? (
            <div className={styles.notFound}>
              <span className={styles.notFoundTitle}>Project not found</span>
              <span>No project id provided in the URL.</span>
            </div>
          ) : (
            <Suspense
              fallback={<div className={styles.loading}>Loading project…</div>}
            >
              <ProjectDetailBody
                projectId={projectId}
                workspaceId={workspaceId}
              />
            </Suspense>
          )}
        </div>
      </ViewBody>
      <AllDocSidebarTabs />
    </>
  );
};

export const Component = () => <ProjectDetailPage />;
