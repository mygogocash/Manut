import { Button, Input, Modal, notify, Skeleton } from '@affine/component';
import { useMutation } from '@affine/core/components/hooks/use-mutation';
import { useQuery } from '@affine/core/components/hooks/use-query';
import { WorkbenchService } from '@affine/core/modules/workbench';
import { WorkspaceService } from '@affine/core/modules/workspace';
import { useI18n } from '@affine/i18n';
import { useService } from '@toeverything/infra';
import { debounce } from 'lodash-es';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  gmailMessagesQuery,
  type GmailMessageSummaryDto,
  importGmailMessageMutation,
} from './graphql';
import * as styles from './integration-dialog.css';

interface GmailImportDialogProps {
  onClose: () => void;
}

/**
 * v1.10.2 Gmail import dialog.
 *
 * Search box (debounced 300 ms) → message list → per-row Import button.
 * On successful import the new doc is opened in a new tab and a toast
 * confirms which message was imported. The dialog stays open so the
 * user can import multiple messages in a row without closing/reopening.
 */
export const GmailImportDialog = ({ onClose }: GmailImportDialogProps) => {
  const t = useI18n();
  const workspaceService = useService(WorkspaceService);
  const workbenchService = useService(WorkbenchService);
  const workspaceId = workspaceService.workspace.id;

  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [importingId, setImportingId] = useState<string | null>(null);

  // Debounce by 300 ms — saves us hitting Gmail on every keystroke. We
  // hold the debounced fn in a ref so it survives re-renders; the `useEffect`
  // below feeds new input through it and cancels on unmount.
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

  // Cast at the boundary because the local query is not in the codegen'd
  // discriminated union — same trick the existing connections panel uses.
  const queryArg = {
    query: gmailMessagesQuery,
    variables: { workspaceId, query: debouncedQuery, maxResults: 25 },
  } as unknown as NonNullable<Parameters<typeof useQuery>[0]>;
  const { data, isLoading, error } = useQuery(queryArg);

  const messages = (
    data as unknown as { gmailMessages?: GmailMessageSummaryDto[] } | undefined
  )?.gmailMessages;

  const { trigger: triggerImport } = useMutation({
    mutation: importGmailMessageMutation,
  });

  const handleImport = useCallback(
    async (msg: GmailMessageSummaryDto) => {
      setImportingId(msg.messageId);
      try {
        const response = (await (
          triggerImport as (args: unknown) => Promise<unknown>
        )({
          workspaceId,
          messageId: msg.messageId,
        })) as { importGmailMessage?: string } | undefined;
        const newDocId = response?.importGmailMessage;
        if (!newDocId) {
          throw new Error('Import returned no doc id');
        }
        workbenchService.workbench.openDoc(newDocId, { at: 'new-tab' });
        notify.success({
          title: t['com.affine.integration.gmail.import.success']({
            subject: msg.subject || 'Untitled email',
          }),
        });
      } catch (err) {
        notify.error({
          title: err instanceof Error ? err.message : String(err),
        });
      } finally {
        setImportingId(null);
      }
    },
    [triggerImport, workspaceId, workbenchService, t]
  );

  const onOpenChange = useCallback(
    (open: boolean) => {
      if (!open) onClose();
    },
    [onClose]
  );

  const body = useMemo(() => {
    if (isLoading && !messages) {
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
    if (!messages || messages.length === 0) {
      return (
        <div className={styles.emptyState}>
          {t['com.affine.integration.gmail.import.empty-state']()}
        </div>
      );
    }
    return (
      <ul className={styles.list}>
        {messages.map(msg => (
          <li key={msg.messageId} className={styles.listItem}>
            <div className={styles.itemBody}>
              <div className={styles.itemSubject}>
                {msg.subject || '(no subject)'}
              </div>
              <div className={styles.itemMeta}>
                {[msg.from, formatDate(msg.date)].filter(Boolean).join(' · ')}
              </div>
              {msg.snippet ? (
                <div className={styles.itemSnippet}>{msg.snippet}</div>
              ) : null}
            </div>
            <div className={styles.itemActions}>
              <Button
                variant="primary"
                disabled={importingId === msg.messageId}
                loading={importingId === msg.messageId}
                onClick={() => void handleImport(msg)}
              >
                {t['com.affine.integration.gmail.import.import-button']()}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    );
  }, [error, handleImport, importingId, isLoading, messages, t]);

  return (
    <Modal
      open={true}
      onOpenChange={onOpenChange}
      title={t['com.affine.integration.gmail.import.dialog-title']()}
      contentOptions={{ className: styles.dialog }}
    >
      <div className={styles.searchRow}>
        <Input
          placeholder={t[
            'com.affine.integration.gmail.import.search-placeholder'
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

/**
 * Best-effort date formatter. Gmail returns RFC-2822 dates; if parse
 * fails we fall back to the raw string rather than rendering "Invalid
 * Date".
 */
function formatDate(raw: string): string {
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
