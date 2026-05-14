import { Button, Input, Modal, notify } from '@affine/component';
import { useMutation } from '@affine/core/components/hooks/use-mutation';
import { useQuery } from '@affine/core/components/hooks/use-query';
import {
  type CreateMnProjectInput,
  createMnProjectMutation,
  type MnProjectDto,
  mnProjectsQuery,
} from '@affine/core/modules/manut-pm';
import {
  ViewBody,
  ViewHeader,
  ViewIcon,
  ViewTitle,
  WorkbenchService,
} from '@affine/core/modules/workbench';
import { WorkspaceService } from '@affine/core/modules/workspace';
import { FolderIcon, PlusIcon } from '@blocksuite/icons/rc';
import { useService } from '@toeverything/infra';
import {
  type ChangeEvent,
  type MouseEvent as ReactMouseEvent,
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

function errorMessage(err: unknown): string {
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

  const { data, error, mutate } = useQuery(queryArg);

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
    <div className={styles.list}>
      {projects.map(project => (
        <ProjectCard
          key={project.id}
          project={project}
          onOpen={onOpenProject}
        />
      ))}
    </div>
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

  const handleCreatedProject = useCallback(
    (project: MnProjectDto) => {
      // Open the freshly created project so the user can immediately add tasks
      // and edit details.
      workbench.open(`/projects/${project.id}`);
    },
    [workbench]
  );

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
              onCreateProject={() => setCreatingProject(true)}
              onOpenProject={handleOpenProject}
            />
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
