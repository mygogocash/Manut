import { Button, Input, Modal, notify, Skeleton } from '@affine/component';
import { useQuery } from '@affine/core/components/hooks/use-query';
import { WorkspaceService } from '@affine/core/modules/workspace';
import { useI18n } from '@affine/i18n';
import { useService } from '@toeverything/infra';
import { debounce } from 'lodash-es';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { type DriveFileDto, driveFilesQuery } from './graphql';
import * as styles from './integration-dialog.css';

interface DrivePickerDialogProps {
  onClose: () => void;
}

/**
 * v1.10.2 Drive picker.
 *
 * Search box → file list. Each row shows the icon + name + modified-date
 * + size, with two actions:
 *   - Copy link: writes `webViewLink` to the clipboard so the user can
 *     paste into a doc (AFFiNE renders Drive links as inline previews).
 *   - Open in Drive: opens `webViewLink` in a new tab.
 *
 * We don't auto-import file content because Drive serves a zoo of MIME
 * types — see drive.service.ts for the rationale.
 */
export const DrivePickerDialog = ({ onClose }: DrivePickerDialogProps) => {
  const t = useI18n();
  const workspaceService = useService(WorkspaceService);
  const workspaceId = workspaceService.workspace.id;

  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounce by 300 ms; held in a ref so the same instance survives
  // re-renders and we can cancel it on unmount.
  const updateDebouncedRef = useRef(
    debounce((value: string) => setDebouncedQuery(value), 300)
  );

  useEffect(() => {
    updateDebouncedRef.current(searchInput);
  }, [searchInput]);

  useEffect(() => {
    const fn = updateDebouncedRef.current;
    return () => fn.cancel();
  }, []);

  const queryArg = {
    query: driveFilesQuery,
    variables: { workspaceId, query: debouncedQuery, pageSize: 25 },
  } as unknown as NonNullable<Parameters<typeof useQuery>[0]>;
  const { data, isLoading, error } = useQuery(queryArg);

  const files = (data as unknown as { driveFiles?: DriveFileDto[] } | undefined)
    ?.driveFiles;

  const handleCopyLink = useCallback(
    (file: DriveFileDto) => {
      const link = file.webViewLink;
      if (!link) {
        notify.error({ title: 'No web link available for this file.' });
        return;
      }
      navigator.clipboard.writeText(link).then(
        () => {
          notify.success({
            title:
              t['com.affine.integration.google-drive.picker.copied-toast'](),
          });
        },
        () => {
          notify.error({ title: 'Failed to copy link to clipboard.' });
        }
      );
    },
    [t]
  );

  const handleOpenInDrive = useCallback((file: DriveFileDto) => {
    if (file.webViewLink) {
      window.open(file.webViewLink, '_blank', 'noopener,noreferrer');
    }
  }, []);

  const onOpenChange = useCallback(
    (open: boolean) => {
      if (!open) onClose();
    },
    [onClose]
  );

  const body = useMemo(() => {
    if (isLoading && !files) {
      return (
        <div className={styles.skeletonGroup}>
          <Skeleton width="100%" height={48} />
          <Skeleton width="100%" height={48} />
          <Skeleton width="100%" height={48} />
        </div>
      );
    }
    if (error) {
      return <div className={styles.errorMessage}>{error.message}</div>;
    }
    if (!files || files.length === 0) {
      return (
        <div className={styles.emptyState}>
          {t['com.affine.integration.google-drive.picker.empty-state']()}
        </div>
      );
    }
    return (
      <ul className={styles.list}>
        {files.map(file => (
          <li key={file.id} className={styles.listItem}>
            <div className={styles.itemBody}>
              <div className={styles.driveTitleRow}>
                {file.iconLink ? (
                  // The icons come from `drive-thirdparty.googleusercontent.com`
                  // and are 16×16 sprites — render as-is. Decorative, so
                  // alt="" so screen readers skip them.
                  <img
                    className={styles.driveIcon}
                    src={file.iconLink}
                    alt=""
                    width={16}
                    height={16}
                  />
                ) : null}
                <span className={styles.itemSubject}>{file.name}</span>
              </div>
              <div className={styles.itemMeta}>
                {[formatDate(file.modifiedTime), formatBytes(file.size)]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            </div>
            <div className={styles.itemActions}>
              <Button
                variant="secondary"
                onClick={() => handleOpenInDrive(file)}
                disabled={!file.webViewLink}
              >
                {t[
                  'com.affine.integration.google-drive.picker.open-in-drive'
                ]()}
              </Button>
              <Button
                variant="primary"
                onClick={() => handleCopyLink(file)}
                disabled={!file.webViewLink}
              >
                {t['com.affine.integration.google-drive.picker.copy-link']()}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    );
  }, [error, files, handleCopyLink, handleOpenInDrive, isLoading, t]);

  return (
    <Modal
      open={true}
      onOpenChange={onOpenChange}
      title={t['com.affine.integration.google-drive.picker.dialog-title']()}
      contentOptions={{ className: styles.dialog }}
    >
      <div className={styles.searchRow}>
        <Input
          placeholder={t[
            'com.affine.integration.google-drive.picker.search-placeholder'
          ]()}
          value={searchInput}
          onChange={value => setSearchInput(value)}
          autoFocus
        />
      </div>
      <div className={styles.listScroll}>{body}</div>
    </Modal>
  );
};

function formatDate(raw: string | undefined | null): string {
  if (!raw) return '';
  const t = Date.parse(raw);
  if (isNaN(t)) return raw;
  const d = new Date(t);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  });
}

/**
 * Drive returns sizes as stringified bytes. Folders / Google-native docs
 * don't have a size — render nothing in that case.
 */
function formatBytes(raw: string | undefined | null): string {
  if (!raw) return '';
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = n;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 100 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}
