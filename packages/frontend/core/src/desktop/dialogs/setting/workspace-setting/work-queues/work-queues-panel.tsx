import {
  SettingHeader,
  SettingWrapper,
} from '@affine/component/setting-components';
import type {
  CreateMnWorkQueueInput,
  MnWorkQueueDto,
  MnWorkQueueRule,
  MnWorkQueueRuleOp,
} from '@affine/core/modules/manut-pm/types';
import { useCallback, useMemo, useState } from 'react';

import * as styles from './work-queues-panel.css';

/**
 * M14 — Work Queues settings panel.
 *
 * Renders the list of queues for the workspace, exposes the public
 * webhook URL with copy-to-clipboard + rotate, and offers a simple
 * key/op/value rule editor. Advanced routing (multiple assignees,
 * priority overrides, action chains) is left for follow-up.
 *
 * Data layer: the GraphQL operations are declared in
 * `@affine/core/modules/manut-pm/graphql.ts`. Wiring them to the host
 * `useQuery` / `useMutation` hooks happens at the call site (the host
 * hook varies by surface — web vs mobile). When no fetcher is provided
 * this component renders empty / disabled so the panel can ship behind
 * a feature flag without a runtime crash.
 */

interface RouteFetchers {
  fetchQueues: (workspaceId: string) => Promise<MnWorkQueueDto[]>;
  createQueue: (
    workspaceId: string,
    input: CreateMnWorkQueueInput
  ) => Promise<MnWorkQueueDto>;
  rotateToken: (
    workspaceId: string,
    queueId: string
  ) => Promise<MnWorkQueueDto>;
  updateQueueRules: (
    workspaceId: string,
    queueId: string,
    routingRulesJson: string
  ) => Promise<MnWorkQueueDto>;
  archiveQueue: (
    workspaceId: string,
    queueId: string
  ) => Promise<MnWorkQueueDto>;
}

interface WorkQueuesPanelProps {
  workspaceId: string;
  projectId?: string;
  fetchers?: Partial<RouteFetchers>;
}

function parseRules(json: string): MnWorkQueueRule[] {
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) {
      return parsed as MnWorkQueueRule[];
    }
  } catch {
    /* empty */
  }
  return [];
}

interface IntakeUrlProps {
  token: string;
}

function intakeUrl(token: string): string {
  // Match the controller mount point. The leading slash is added by
  // window.location so the URL is workspace-host-correct.
  const base =
    typeof window !== 'undefined' && window.location
      ? `${window.location.origin}`
      : '';
  return `${base}/api/work-queues/${token}/intake`;
}

function IntakeUrlBlock({ token }: IntakeUrlProps) {
  const url = intakeUrl(token);
  const onCopy = useCallback(() => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(url).catch(() => {
        /* clipboard write best-effort */
      });
    }
  }, [url]);
  return (
    <div className={styles.tokenRow} data-testid="work-queue-token-row">
      <span className={styles.tokenValue}>{url}</span>
      <button
        type="button"
        className={styles.copyButton}
        onClick={onCopy}
        data-testid="work-queue-copy-url"
      >
        Copy
      </button>
    </div>
  );
}

interface QueueCardProps {
  queue: MnWorkQueueDto;
  onRotate: () => void;
  onSaveRules: (rulesJson: string) => void;
  onArchive: () => void;
}

function QueueCard({
  queue,
  onRotate,
  onSaveRules,
  onArchive,
}: QueueCardProps) {
  const [rules, setRules] = useState<MnWorkQueueRule[]>(() =>
    parseRules(queue.routingRulesJson)
  );

  const updateRule = useCallback((idx: number, next: MnWorkQueueRule) => {
    setRules(prev => prev.map((r, i) => (i === idx ? next : r)));
  }, []);

  const removeRule = useCallback((idx: number) => {
    setRules(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const addRule = useCallback(() => {
    setRules(prev => [
      ...prev,
      {
        match: { field: '', op: 'eq', value: '' },
      },
    ]);
  }, []);

  const onSave = useCallback(() => {
    onSaveRules(JSON.stringify(rules));
  }, [rules, onSaveRules]);

  return (
    <div className={styles.queueCard} data-testid={`work-queue-${queue.id}`}>
      <div className={styles.queueHeader}>
        <div>
          <div className={styles.queueTitle}>{queue.name}</div>
          {queue.description ? (
            <div className={styles.queueDescription}>{queue.description}</div>
          ) : null}
        </div>
        {!queue.isActive ? (
          <span className={styles.inactiveBadge}>Archived</span>
        ) : null}
      </div>
      <IntakeUrlBlock token={queue.intakeWebhookToken} />
      <div className={styles.rulesEditor}>
        {rules.map((rule, idx) => (
          <div className={styles.ruleRow} key={idx}>
            <input
              className={styles.fieldInput}
              placeholder="payload field (e.g. severity)"
              value={rule.match.field}
              onChange={e =>
                updateRule(idx, {
                  ...rule,
                  match: { ...rule.match, field: e.target.value },
                })
              }
            />
            <select
              className={styles.fieldSelect}
              value={rule.match.op}
              onChange={e =>
                updateRule(idx, {
                  ...rule,
                  match: {
                    ...rule.match,
                    op: e.target.value as MnWorkQueueRuleOp,
                  },
                })
              }
            >
              <option value="eq">equals</option>
              <option value="contains">contains</option>
            </select>
            <input
              className={styles.fieldInput}
              placeholder="value"
              value={rule.match.value}
              onChange={e =>
                updateRule(idx, {
                  ...rule,
                  match: { ...rule.match, value: e.target.value },
                })
              }
            />
            <input
              className={styles.fieldInput}
              placeholder="agent id (optional)"
              value={rule.assignToAgentId ?? ''}
              onChange={e =>
                updateRule(idx, {
                  ...rule,
                  assignToAgentId: e.target.value || undefined,
                })
              }
            />
            <button
              type="button"
              className={styles.ruleRemove}
              onClick={() => removeRule(idx)}
              aria-label="Remove rule"
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          className={styles.addRuleButton}
          onClick={addRule}
          data-testid={`work-queue-${queue.id}-add-rule`}
        >
          + Add routing rule
        </button>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          className={styles.createButton}
          onClick={onSave}
          data-testid={`work-queue-${queue.id}-save-rules`}
        >
          Save rules
        </button>
        <button
          type="button"
          className={styles.rotateButton}
          onClick={onRotate}
          data-testid={`work-queue-${queue.id}-rotate`}
        >
          Rotate token
        </button>
        {queue.isActive ? (
          <button
            type="button"
            className={styles.rotateButton}
            onClick={onArchive}
            data-testid={`work-queue-${queue.id}-archive`}
          >
            Archive
          </button>
        ) : null}
      </div>
    </div>
  );
}

interface CreateFormProps {
  projectId: string;
  onCreate: (input: CreateMnWorkQueueInput) => void;
}

function CreateForm({ projectId, onCreate }: CreateFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const canSubmit = name.trim().length > 0 && projectId.trim().length > 0;
  return (
    <div className={styles.createForm} data-testid="work-queue-create-form">
      <div className={styles.sectionHeader}>New work queue</div>
      <input
        className={styles.fieldInput}
        placeholder="Queue name"
        value={name}
        onChange={e => setName(e.target.value)}
        data-testid="work-queue-create-name"
      />
      <input
        className={styles.fieldInput}
        placeholder="Description (optional)"
        value={description}
        onChange={e => setDescription(e.target.value)}
      />
      <button
        type="button"
        className={styles.createButton}
        disabled={!canSubmit}
        onClick={() => {
          if (!canSubmit) return;
          onCreate({
            projectId,
            name: name.trim(),
            description: description.trim() || null,
          });
          setName('');
          setDescription('');
        }}
        data-testid="work-queue-create-submit"
      >
        Create queue
      </button>
    </div>
  );
}

export function WorkQueuesPanel({
  workspaceId,
  projectId,
  fetchers,
}: WorkQueuesPanelProps) {
  const [queues, setQueues] = useState<MnWorkQueueDto[]>([]);

  // Lazy initial fetch — caller passes the fetcher when wired.
  useMemo(() => {
    if (!fetchers?.fetchQueues) return;
    let cancelled = false;
    void fetchers
      .fetchQueues(workspaceId)
      .then(rows => {
        if (!cancelled) setQueues(rows);
      })
      .catch(() => {
        /* empty */
      });
    return () => {
      cancelled = true;
    };
  }, [fetchers, workspaceId]);

  const handleCreate = useCallback(
    (input: CreateMnWorkQueueInput) => {
      if (!fetchers?.createQueue) return;
      fetchers
        .createQueue(workspaceId, input)
        .then(row => {
          setQueues(prev => [...prev, row]);
        })
        .catch(() => {
          /* error surface via toast/banner in follow-up */
        });
    },
    [fetchers, workspaceId]
  );

  const handleRotate = useCallback(
    (queueId: string) => {
      if (!fetchers?.rotateToken) return;
      fetchers
        .rotateToken(workspaceId, queueId)
        .then(row => {
          setQueues(prev => prev.map(q => (q.id === queueId ? row : q)));
        })
        .catch(() => {
          /* error surface via toast/banner in follow-up */
        });
    },
    [fetchers, workspaceId]
  );

  const handleSaveRules = useCallback(
    (queueId: string, routingRulesJson: string) => {
      if (!fetchers?.updateQueueRules) return;
      fetchers
        .updateQueueRules(workspaceId, queueId, routingRulesJson)
        .then(row => {
          setQueues(prev => prev.map(q => (q.id === queueId ? row : q)));
        })
        .catch(() => {
          /* error surface via toast/banner in follow-up */
        });
    },
    [fetchers, workspaceId]
  );

  const handleArchive = useCallback(
    (queueId: string) => {
      if (!fetchers?.archiveQueue) return;
      fetchers
        .archiveQueue(workspaceId, queueId)
        .then(row => {
          setQueues(prev => prev.map(q => (q.id === queueId ? row : q)));
        })
        .catch(() => {
          /* error surface via toast/banner in follow-up */
        });
    },
    [fetchers, workspaceId]
  );

  return (
    <SettingWrapper>
      <SettingHeader
        title="Work Queues"
        subtitle="Public intake webhooks that route inbound requests into tasks via routing rules."
      />
      <div className={styles.wrapper}>
        {projectId ? (
          <CreateForm projectId={projectId} onCreate={handleCreate} />
        ) : (
          <div className={styles.empty}>
            Select a project to create a work queue for it.
          </div>
        )}
        {queues.length === 0 ? (
          <div className={styles.empty}>
            No work queues yet. Create one above to start receiving intake.
          </div>
        ) : (
          queues.map(queue => (
            <QueueCard
              key={queue.id}
              queue={queue}
              onRotate={() => handleRotate(queue.id)}
              onSaveRules={rules => handleSaveRules(queue.id, rules)}
              onArchive={() => handleArchive(queue.id)}
            />
          ))
        )}
      </div>
    </SettingWrapper>
  );
}
