import { Button } from '@affine/component';
import type { FC } from 'react';
import { useCallback, useMemo, useState } from 'react';

import * as styles from './diagnostic-fallback.css';
import {
  buildDiagnosticInfo,
  copyDiagnosticInfo,
  generateTraceId,
  isNetworkError,
} from './error-utils';

export interface DiagnosticErrorFallbackProps {
  error: unknown;
  onReload: () => void;
}

const formatTimestamp = (date: Date) => date.toISOString();

export const DiagnosticErrorFallback: FC<DiagnosticErrorFallbackProps> = ({
  error,
  onReload,
}) => {
  // Generate the trace ID + timestamp once, when the boundary mounts. This
  // gives the user a stable identifier they can reference.
  const traceId = useMemo(() => generateTraceId(), []);
  const timestamp = useMemo(() => formatTimestamp(new Date()), []);

  const network = useMemo(() => isNetworkError(error), [error]);

  const message = useMemo(() => {
    if (error instanceof Error) return error.message || error.name || 'Error';
    if (typeof error === 'string') return error;
    return String(error);
  }, [error]);

  const diagnosticText = useMemo(
    () => buildDiagnosticInfo({ error, traceId, timestamp }),
    [error, traceId, timestamp]
  );

  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>(
    'idle'
  );

  const onCopy = useCallback(() => {
    copyDiagnosticInfo(diagnosticText)
      .then(ok => {
        setCopyState(ok ? 'copied' : 'failed');
        window.setTimeout(() => setCopyState('idle'), 2000);
      })
      .catch(() => {
        setCopyState('failed');
        window.setTimeout(() => setCopyState('idle'), 2000);
      });
  }, [diagnosticText]);

  const copyLabel =
    copyState === 'copied'
      ? 'Copied!'
      : copyState === 'failed'
        ? 'Copy failed'
        : 'Copy diagnostic info';

  if (network) {
    return (
      <div className={styles.layout}>
        <div className={styles.container}>
          <h1 className={styles.title}>Check your connection</h1>
          <p className={styles.description}>
            We couldn&apos;t reach the server. This usually means your device is
            offline or the network blocked the request. Check your connection
            and try again.
          </p>
          <pre className={styles.codeBlock}>{message}</pre>
          <div className={styles.metaRow}>
            <div className={styles.metaLine}>
              <span className={styles.metaLabel}>Trace ID:</span>
              <code className={styles.traceId}>{traceId}</code>
            </div>
            <div className={styles.metaLine}>
              <span className={styles.metaLabel}>Time:</span>
              <span>{timestamp}</span>
            </div>
          </div>
          <div className={styles.buttonRow}>
            <Button
              variant="primary"
              size="large"
              onClick={onReload}
              className={styles.button}
            >
              Retry
            </Button>
            <Button size="large" onClick={onCopy} className={styles.button}>
              {copyLabel}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.layout}>
      <div className={styles.container}>
        <h1 className={styles.title}>Something went wrong</h1>
        <p className={styles.description}>
          AFFiNE ran into an unexpected error and couldn&apos;t continue. Reload
          the page to recover. If the problem persists, copy the diagnostic info
          below and share it with support.
        </p>
        <pre className={styles.codeBlock}>{message}</pre>
        <div className={styles.metaRow}>
          <div className={styles.metaLine}>
            <span className={styles.metaLabel}>Trace ID:</span>
            <code
              className={styles.traceId}
              title="Click to select"
              onClick={e => {
                const range = document.createRange();
                range.selectNodeContents(e.currentTarget);
                const sel = window.getSelection();
                sel?.removeAllRanges();
                sel?.addRange(range);
              }}
            >
              {traceId}
            </code>
          </div>
          <div className={styles.metaLine}>
            <span className={styles.metaLabel}>Time:</span>
            <span>{timestamp}</span>
          </div>
        </div>
        <div className={styles.buttonRow}>
          <Button
            variant="primary"
            size="large"
            onClick={onReload}
            className={styles.button}
          >
            Reload page
          </Button>
          <Button size="large" onClick={onCopy} className={styles.button}>
            {copyLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
