import { Button, notify } from '@affine/component';
import { useMutation } from '@affine/core/components/hooks/use-mutation';
import { useNavigateHelper } from '@affine/core/components/hooks/use-navigate-helper';
import { WorkspaceService } from '@affine/core/modules/workspace';
import { useService } from '@toeverything/infra';
import type { ChangeEvent } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';

import { IntegrationSettingHeader } from '../setting';
import type {
  ImportMnHandoverInput,
  ImportMnHandoverResult,
} from './graphql';
import { importMnHandoverMutation } from './graphql';
import * as styles from './setting-panel.css';

interface HandoverPreview {
  workflowName: string;
  runId: string;
  imageTag: string;
  imageDigest: string;
  agentCount: number;
  taskCount: number;
  gates: string[];
}

const EMPTY_PREVIEW: HandoverPreview = {
  workflowName: '',
  runId: '',
  imageTag: '',
  imageDigest: '',
  agentCount: 0,
  taskCount: 0,
  gates: [],
};

const MAX_AGENTS = 20;
const MAX_TASKS = 100;
const MAX_GATES = 50;

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function readObject(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readArray(value: unknown, label: string, maxItems: number) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }
  if (value.length > maxItems) {
    throw new Error(`${label} has too many items.`);
  }
  return value;
}

function parsePreview(
  source: string
): { ok: true; preview: HandoverPreview } | { ok: false; message: string } {
  if (!source.trim()) {
    return { ok: true, preview: EMPTY_PREVIEW };
  }

  try {
    const parsed = JSON.parse(source) as Record<string, unknown>;
    if (parsed.schemaVersion !== 1) {
      throw new Error('schemaVersion must be 1.');
    }

    const workflow = readObject(parsed.workflow);
    const controlPlane = readObject(parsed.controlPlane);
    const release = readObject(parsed.release);

    if (
      !workflow ||
      !controlPlane ||
      !release ||
      !readObject(parsed.rollback)
    ) {
      throw new Error('Missing required handover sections.');
    }

    const agents = readArray(parsed.agents, 'agents', MAX_AGENTS);
    const tasks = readArray(parsed.taskTree, 'taskTree', MAX_TASKS);
    const gates = readArray(
      parsed.verificationGates,
      'verificationGates',
      MAX_GATES
    )
      .map(gate => readString(gate))
      .filter(Boolean);

    return {
      ok: true,
      preview: {
        workflowName:
          readString(controlPlane?.name) ||
          readString(workflow?.mode) ||
          'Manut handover',
        runId: readString(workflow?.runId),
        imageTag: readString(release?.imageTag),
        imageDigest: readString(release?.imageDigest),
        agentCount: agents.length,
        taskCount: tasks.length,
        gates,
      },
    };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : 'The handover JSON is invalid.',
    };
  }
}

const PreviewRow = ({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) => (
  <>
    <div className={styles.previewLabel}>{label}</div>
    <div className={styles.previewValue}>{value || '-'}</div>
  </>
);

export const MnHandoverIcon = () => {
  return <span className={styles.icon}>SF</span>;
};

export const MnHandoverSettingPanel = () => {
  const workspaceService = useService(WorkspaceService);
  const workspaceId = workspaceService.workspace.id;
  const { jumpToPage } = useNavigateHelper();
  const inputRef = useRef<HTMLInputElement>(null);

  const [handoverJson, setHandoverJson] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportMnHandoverResult | null>(
    null
  );

  const previewResult = useMemo(
    () => parsePreview(handoverJson),
    [handoverJson]
  );
  const preview = previewResult.ok ? previewResult.preview : EMPTY_PREVIEW;
  const canImport = Boolean(handoverJson.trim()) && previewResult.ok;

  const { trigger } = useMutation({
    mutation: importMnHandoverMutation,
  });

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        const content = await file.text();
        setFileName(file.name);
        setResult(null);
        setError(null);
        setHandoverJson(content);
      } catch {
        setError('Could not read that file. Please paste the JSON instead.');
      }
      event.target.value = '';
    },
    []
  );

  const handleImport = useCallback(async () => {
    if (!canImport) return;

    setImporting(true);
    setError(null);
    setResult(null);

    try {
      const input: ImportMnHandoverInput = { handoverJson };
      const response = (await (trigger as (args: unknown) => Promise<unknown>)({
        workspaceId,
        input,
      })) as { importMnHandover?: ImportMnHandoverResult };
      const imported = response.importMnHandover;
      if (!imported) {
        throw new Error('The server did not return an imported doc.');
      }
      setResult(imported);
      notify.success({
        title: imported.updated ? 'Handover updated' : 'Handover imported',
        message: imported.title,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to import handover.';
      setError(message);
      notify.error({ title: 'Failed to import handover', message });
    } finally {
      setImporting(false);
    }
  }, [canImport, handoverJson, trigger, workspaceId]);

  return (
    <div className={styles.root}>
      <IntegrationSettingHeader
        icon={<MnHandoverIcon />}
        name="Manut Handover"
        desc="Import release handover JSON into a workspace doc."
      />

      <section className={styles.section}>
        <div className={styles.actionRow}>
          <div>
            <div className={styles.sectionTitle}>Handover JSON</div>
            <div className={styles.muted}>
              {fileName ? `Loaded ${fileName}` : 'Paste JSON or upload a file.'}
            </div>
          </div>
          <div className={styles.leftActions}>
            <input
              ref={inputRef}
              className={styles.fileInput}
              type="file"
              accept=".json,application/json"
              onChange={event => void handleFileChange(event)}
            />
            <Button onClick={() => inputRef.current?.click()}>
              Upload JSON
            </Button>
          </div>
        </div>

        <textarea
          className={styles.textarea}
          value={handoverJson}
          spellCheck={false}
          placeholder='{"schemaVersion":1,"workflow":{...},"release":{...}}'
          onChange={event => {
            setFileName(null);
            setResult(null);
            setError(null);
            setHandoverJson(event.target.value);
          }}
        />
      </section>

      {!previewResult.ok ? (
        <div className={styles.errorMessage}>
          JSON preview failed: {previewResult.message}
        </div>
      ) : null}
      {error ? <div className={styles.errorMessage}>{error}</div> : null}
      {result ? (
        <div className={styles.successRow}>
          <div className={styles.successMessage}>
            {result.updated ? 'Updated' : 'Created'} &quot;{result.title}&quot;
            ({result.docId})
          </div>
          <Button onClick={() => jumpToPage(workspaceId, result.docId)}>
            Open doc
          </Button>
        </div>
      ) : null}

      <section className={styles.section}>
        <div className={styles.sectionTitle}>Release facts</div>
        <div className={styles.preview}>
          <div className={styles.previewGrid}>
            <PreviewRow label="Workflow" value={preview.workflowName} />
            <PreviewRow label="Run ID" value={preview.runId} />
            <PreviewRow label="Image tag" value={preview.imageTag} />
            <PreviewRow label="Image digest" value={preview.imageDigest} />
            <PreviewRow label="Agents" value={preview.agentCount} />
            <PreviewRow label="Tasks" value={preview.taskCount} />
          </div>
          {preview.gates.length ? (
            <ul className={styles.gates}>
              {preview.gates.map(gate => (
                <li key={gate}>{gate}</li>
              ))}
            </ul>
          ) : (
            <div className={styles.previewValue}>No gates found.</div>
          )}
        </div>
      </section>

      <div className={styles.actionRow}>
        <div className={styles.muted}>
          Backend validation runs during import; this preview is informational.
        </div>
        <Button
          variant="primary"
          loading={importing}
          disabled={!canImport || importing}
          onClick={() => void handleImport()}
        >
          Create doc
        </Button>
      </div>
    </div>
  );
};
