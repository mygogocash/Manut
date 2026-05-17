import { Button, Modal, notify } from '@affine/component';
import {
  SettingRow,
  SettingWrapper,
} from '@affine/component/setting-components';
import { useMutation } from '@affine/core/components/hooks/use-mutation';
import {
  exportWorkspaceSnapshotMutation,
  type MnExportSnapshotDto,
} from '@affine/core/modules/manut-control-plane';
import { WorkspaceService } from '@affine/core/modules/workspace';
import { useService } from '@toeverything/infra';
import { useCallback, useState } from 'react';

import * as styles from '../../general-setting/control-plane-roles/skill-editor-drawer.css';

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Unexpected error';
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'] as const;
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 100 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function formatTimestamp(value: string | null): string {
  if (!value) return '-';
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return '-';
  return new Date(ms).toLocaleString();
}

/**
 * Decode a base64 string into a `Blob` for download.
 *
 * Browsers expose `atob` for base64; we then materialise the bytes into a
 * `Uint8Array` so the resulting blob has the correct length. We deliberately
 * avoid `fetch('data:...')` round-trips — they hide errors and can trip CSP.
 */
function base64ToBlob(base64: string, contentType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: contentType });
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Defer revoke so the browser has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

interface ExportResultModalProps {
  open: boolean;
  snapshot: MnExportSnapshotDto | null;
  onClose: () => void;
}

const ExportResultModal = ({
  open,
  snapshot,
  onClose,
}: ExportResultModalProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopyHash = useCallback(async () => {
    if (!snapshot) return;
    try {
      await navigator.clipboard.writeText(snapshot.sha256);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      notify.error({
        title: 'Could not copy',
        message: errorMessage(err),
      });
    }
  }, [snapshot]);

  if (!snapshot) {
    return null;
  }

  return (
    <Modal
      open={open}
      onOpenChange={(value: boolean) => {
        if (!value) onClose();
      }}
      title="Workspace snapshot exported"
      description="A signed snapshot of this workspace has been generated and downloaded. Keep the SHA-256 to verify integrity later."
      width={560}
    >
      <div
        className={styles.exportResultRoot}
        data-testid="cp-export-result-modal"
      >
        <div className={styles.exportResultFacts}>
          <div className={styles.exportResultLabel}>Generated</div>
          <div className={styles.exportResultValue}>
            {formatTimestamp(snapshot.generatedAt)}
          </div>

          <div className={styles.exportResultLabel}>Size</div>
          <div className={styles.exportResultValue}>
            {formatBytes(snapshot.sizeBytes)}
          </div>

          <div className={styles.exportResultLabel}>SHA-256</div>
          <div
            className={`${styles.exportResultValue} ${styles.exportResultMono}`}
            data-testid="cp-export-sha256"
          >
            {snapshot.sha256}
          </div>
        </div>

        <div className={styles.exportResultActions}>
          <Button
            onClick={() => void handleCopyHash()}
            data-testid="cp-export-copy-hash"
          >
            {copied ? 'Copied' : 'Copy SHA-256'}
          </Button>
          <Button
            variant="primary"
            onClick={onClose}
            data-testid="cp-export-close"
          >
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
};

/**
 * SettingWrapper panel that lets the workspace owner export a portable
 * snapshot.
 *
 * Triggers the `exportWorkspaceSnapshot` mutation, base64-decodes the blob,
 * downloads it, and displays the SHA-256 hash in a result modal so the
 * operator can record it for offline integrity verification.
 */
export const ExportSnapshotPanel = () => {
  const workspace = useService(WorkspaceService).workspace;
  const workspaceId = workspace.id;

  const [snapshot, setSnapshot] = useState<MnExportSnapshotDto | null>(null);
  const [exporting, setExporting] = useState(false);

  const { trigger } = useMutation({
    mutation: exportWorkspaceSnapshotMutation,
  });

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const response = (await (trigger as (args: unknown) => Promise<unknown>)({
        workspaceId,
      })) as { exportWorkspaceSnapshot?: MnExportSnapshotDto } | undefined;
      const result = response?.exportWorkspaceSnapshot;
      if (!result) {
        throw new Error('Server did not return a snapshot.');
      }

      // Stream the blob to the user's filesystem before showing the modal so
      // a failed download doesn't leave the user thinking they have the file.
      const blob = base64ToBlob(result.blobBase64, 'application/json');
      const stamp = new Date(result.generatedAt)
        .toISOString()
        .replace(/[:.]/g, '-');
      triggerDownload(blob, `manut-workspace-${workspaceId}-${stamp}.json`);

      setSnapshot(result);
      notify.success({
        title: 'Workspace exported',
        message: `Saved ${formatBytes(result.sizeBytes)} snapshot.`,
      });
    } catch (err) {
      notify.error({
        title: 'Could not export workspace',
        message: errorMessage(err),
      });
    } finally {
      setExporting(false);
    }
  }, [trigger, workspaceId]);

  const handleCloseModal = useCallback(() => {
    setSnapshot(null);
  }, []);

  return (
    <SettingWrapper title="Export workspace">
      <SettingRow
        name="Workspace snapshot"
        desc="Download a signed snapshot of this workspace's docs, skills, and metadata. The SHA-256 hash can be recorded for later integrity verification."
        data-testid="cp-export-snapshot-row"
      >
        <Button
          variant="primary"
          onClick={() => void handleExport()}
          loading={exporting}
          disabled={exporting}
          data-testid="cp-export-snapshot-button"
        >
          Export workspace
        </Button>
      </SettingRow>
      <ExportResultModal
        open={snapshot !== null}
        snapshot={snapshot}
        onClose={handleCloseModal}
      />
    </SettingWrapper>
  );
};
