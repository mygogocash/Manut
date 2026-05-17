import { Button, Input, Modal, notify } from '@affine/component';
import { useMutation } from '@affine/core/components/hooks/use-mutation';
import { useQuery } from '@affine/core/components/hooks/use-query';
import {
  type CreateMnAgentInput,
  createMnAgentMutation,
  type MnAgentDto,
} from '@affine/core/modules/manut-control-plane';
import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import * as styles from './agents-list.css';

// Shape returned by the existing manut-pm `mnProjects` query. We re-declare
// it here (instead of importing from `manut-pm`) to keep this panel's import
// boundary self-contained — the only field we need is `id` + `name`.
interface ProjectsResponse {
  mnProjects?: ReadonlyArray<{
    id: string;
    name: string;
  }>;
}

// We can't depend on `manut-pm` for the project picker query without
// widening the dependency surface. Re-declare a minimal local op that
// mirrors `mnProjectsQuery` from `@affine/core/modules/manut-pm`. Replace
// with the codegen import once both modules ship.
const projectsForAgentPickerQuery = {
  id: 'mnProjectsQuery' as const,
  op: 'mnProjects',
  query: `query mnProjects($workspaceId: String!) {
  mnProjects(workspaceId: $workspaceId) {
    id
    name
  }
}`,
};

const ROLE_TEMPLATE_OPTIONS = [
  'release-captain',
  'builder',
  'verifier',
  'deployer',
  'historian',
] as const;

type RoleTemplate = (typeof ROLE_TEMPLATE_OPTIONS)[number];

const DEFAULT_ADAPTER = 'copilot_chat_session';

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Unexpected error';
}

interface AgentCreateFormProps {
  open: boolean;
  workspaceId: string;
  defaultProjectId: string | null;
  onClose: () => void;
  onCreated: (agent: MnAgentDto) => void;
}

/**
 * Controlled modal form for registering a new MnAgent.
 *
 * Project picker is gracefully degraded — if the backend isn't shipping
 * `mnProjects` yet (or the user's workspace has no projects), we fall back
 * to a free-form project-id input.
 */
export const AgentCreateForm = ({
  open,
  workspaceId,
  defaultProjectId,
  onClose,
  onCreated,
}: AgentCreateFormProps) => {
  const [projectId, setProjectId] = useState<string>(defaultProjectId ?? '');
  const [roleTemplate, setRoleTemplate] = useState<RoleTemplate>(
    ROLE_TEMPLATE_OPTIONS[0]
  );
  const [name, setName] = useState('');
  const [adapterType, setAdapterType] = useState(DEFAULT_ADAPTER);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { trigger } = useMutation({ mutation: createMnAgentMutation });

  useEffect(() => {
    if (open) {
      setProjectId(defaultProjectId ?? '');
      setRoleTemplate(ROLE_TEMPLATE_OPTIONS[0]);
      setName('');
      setAdapterType(DEFAULT_ADAPTER);
      setError(null);
      setSubmitting(false);
    }
  }, [open, defaultProjectId]);

  const projectsQueryArg = useMemo(
    () =>
      ({
        query: projectsForAgentPickerQuery,
        variables: { workspaceId },
      }) as unknown as NonNullable<Parameters<typeof useQuery>[0]>,
    [workspaceId]
  );

  // Project picker query is optional — if it errors (schema not shipped,
  // PM module not enabled) we silently fall back to a free-form text input.
  const { data: projectsData, error: projectsError } =
    useQuery(projectsQueryArg);

  const projects = (
    (projectsData as ProjectsResponse | undefined)?.mnProjects ?? []
  ).slice();

  const handleClose = useCallback(() => {
    if (submitting) return;
    onClose();
  }, [onClose, submitting]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmedName = name.trim();
      const trimmedAdapter = adapterType.trim() || DEFAULT_ADAPTER;
      const trimmedProjectId = projectId.trim();

      if (!trimmedName) {
        setError('Agent name is required.');
        return;
      }

      setError(null);
      setSubmitting(true);
      try {
        const input: CreateMnAgentInput = {
          workspaceId,
          projectId: trimmedProjectId ? trimmedProjectId : null,
          name: trimmedName,
          roleTemplate,
          adapterType: trimmedAdapter,
        };
        const response = (await (
          trigger as (args: unknown) => Promise<unknown>
        )({ input })) as { createMnAgent?: MnAgentDto } | undefined;
        const created = response?.createMnAgent;
        if (!created) {
          throw new Error('Server did not return the new agent.');
        }
        notify.success({
          title: 'Agent registered',
          message: created.name,
        });
        onCreated(created);
      } catch (err) {
        const message = errorMessage(err);
        setError(message);
        notify.error({ title: 'Could not register agent', message });
      } finally {
        setSubmitting(false);
      }
    },
    [
      adapterType,
      name,
      onCreated,
      projectId,
      roleTemplate,
      trigger,
      workspaceId,
    ]
  );

  return (
    <Modal
      open={open}
      onOpenChange={(value: boolean) => {
        if (!value) handleClose();
      }}
      title="Register agent"
      description="Create a new agent in this workspace's control plane."
    >
      <form
        className={styles.formGrid}
        onSubmit={event => void handleSubmit(event)}
      >
        <div className={styles.fieldRow}>
          <label className={styles.fieldLabel} htmlFor="cp-agent-name">
            Name
          </label>
          <Input
            id="cp-agent-name"
            value={name}
            placeholder="e.g. release-bot-prod"
            autoFocus
            onChange={setName}
            data-testid="cp-agent-create-name"
          />
        </div>

        <div className={styles.fieldRow}>
          <label className={styles.fieldLabel} htmlFor="cp-agent-project">
            Project
          </label>
          {projects.length > 0 && !projectsError ? (
            <select
              id="cp-agent-project"
              className={styles.select}
              value={projectId}
              onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                setProjectId(event.target.value)
              }
              data-testid="cp-agent-create-project"
            >
              <option value="">(workspace-wide)</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          ) : (
            <Input
              id="cp-agent-project"
              value={projectId}
              placeholder="(optional) project id"
              onChange={setProjectId}
              data-testid="cp-agent-create-project"
            />
          )}
          <div className={styles.fieldHint}>
            Optional. Leave blank to bind the agent at workspace scope.
          </div>
        </div>

        <div className={styles.fieldRow}>
          <label className={styles.fieldLabel} htmlFor="cp-agent-role">
            Role template
          </label>
          <select
            id="cp-agent-role"
            className={styles.select}
            value={roleTemplate}
            onChange={(event: ChangeEvent<HTMLSelectElement>) =>
              setRoleTemplate(event.target.value as RoleTemplate)
            }
            data-testid="cp-agent-create-role"
          >
            {ROLE_TEMPLATE_OPTIONS.map(option => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <div className={styles.fieldHint}>
            Matches the five operating roles. Each maps to a default
            responsibility + escalation policy.
          </div>
        </div>

        <div className={styles.fieldRow}>
          <label className={styles.fieldLabel} htmlFor="cp-agent-adapter">
            Adapter type
          </label>
          <Input
            id="cp-agent-adapter"
            value={adapterType}
            placeholder={DEFAULT_ADAPTER}
            onChange={setAdapterType}
            data-testid="cp-agent-create-adapter"
          />
          <div className={styles.fieldHint}>
            Defaults to <code>{DEFAULT_ADAPTER}</code>. Choose
            <code> github-actions</code>, <code>deploy.sh</code>, or any adapter
            your backend exposes.
          </div>
        </div>

        {error ? <div className={styles.formError}>{error}</div> : null}

        <div className={styles.formActions}>
          <Button onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={submitting}
            disabled={submitting || !name.trim()}
            data-testid="cp-agent-create-submit"
          >
            Register
          </Button>
        </div>
      </form>
    </Modal>
  );
};
