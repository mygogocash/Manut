import type { ReactNode } from 'react';

import type {
  Insight,
  InsightSeverity,
} from '../../entities/insight.entity';
import * as styles from './index.css';

const severityClassname: Record<InsightSeverity, string> = {
  INFO: styles.severityInfo,
  NOTABLE: styles.severityNotable,
  ACTION_REQUIRED: styles.severityActionRequired,
};

const severityLabel: Record<InsightSeverity, string> = {
  INFO: 'Info',
  NOTABLE: 'Notable',
  ACTION_REQUIRED: 'Action',
};

const formatRelativeTime = (iso: string): string => {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return '';
  const diffMs = Date.now() - ts;
  const minutes = Math.floor(diffMs / (1000 * 60));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

interface InsightCardProps {
  insight: Insight;
  /**
   * If provided, the card renders the body using this renderer. Pass a
   * markdown-aware component (see `MarkdownText` below) to enable bold,
   * italic, links, etc. When omitted the body is rendered as plain text.
   */
  renderBody?: (body: string) => ReactNode;
  onAcknowledge?: (insightId: string) => void | Promise<void>;
  onCopyLink?: (insightId: string) => void;
  /** Set true while either action is in flight. */
  busy?: boolean;
  /** True if the card just animated in (subscription/new-creation). */
  fresh?: boolean;
}

export function InsightCard({
  insight,
  renderBody,
  onAcknowledge,
  onCopyLink,
  busy,
  fresh,
}: InsightCardProps) {
  const acknowledged = Boolean(insight.acknowledgedAt);
  const showActions = onAcknowledge || onCopyLink;
  const body = renderBody ? renderBody(insight.body) : insight.body;
  return (
    <article
      className={`${styles.card} ${fresh ? styles.cardFresh : ''}`}
      data-testid={`analytics-insight-card-${insight.id}`}
      data-acknowledged={acknowledged ? 'true' : 'false'}
    >
      <div className={styles.headerRow}>
        <span className={styles.titleText}>{insight.title}</span>
        <span
          className={`${styles.severityChip} ${severityClassname[insight.severity]}`}
        >
          {severityLabel[insight.severity]}
        </span>
      </div>
      <div className={styles.body}>{body}</div>
      <div className={styles.metaRow}>
        <span>{formatRelativeTime(insight.createdAt)}</span>
        {insight.platforms.length > 0 ? (
          <div className={styles.platformsRow}>
            {insight.platforms.map(p => (
              <span key={p} className={styles.platformChip}>
                {p}
              </span>
            ))}
          </div>
        ) : null}
        {insight.modelUsed ? (
          <span className={styles.modelChip} title={insight.modelUsed}>
            {insight.modelUsed}
          </span>
        ) : null}
        {showActions ? (
          <div className={styles.actionsRow}>
            {onCopyLink ? (
              <button
                type="button"
                className={styles.actionButton}
                onClick={() => onCopyLink(insight.id)}
                disabled={busy}
                data-testid={`analytics-insight-copy-link-${insight.id}`}
              >
                Copy link
              </button>
            ) : null}
            {onAcknowledge ? (
              <button
                type="button"
                className={styles.actionButton}
                onClick={() => void onAcknowledge(insight.id)}
                disabled={busy || acknowledged}
                data-testid={`analytics-insight-ack-${insight.id}`}
              >
                {acknowledged ? 'Acknowledged' : 'Acknowledge'}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
