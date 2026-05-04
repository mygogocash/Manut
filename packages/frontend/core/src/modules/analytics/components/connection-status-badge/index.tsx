import type { ConnectionStatus } from '../../entities/platform-connection.entity';
import * as styles from './index.css';

const labelMap: Record<ConnectionStatus, string> = {
  ACTIVE: 'Connected',
  PAUSED: 'Paused',
  EXPIRED: 'Expired',
  ERROR: 'Error',
  NOT_CONNECTED: 'Not connected',
};

const containerClass: Record<ConnectionStatus, string> = {
  ACTIVE: styles.active,
  PAUSED: styles.paused,
  EXPIRED: styles.expired,
  ERROR: styles.error,
  NOT_CONNECTED: styles.notConnected,
};

const dotClass: Record<ConnectionStatus, string> = {
  ACTIVE: styles.dotActive,
  PAUSED: styles.dotPaused,
  EXPIRED: styles.dotExpired,
  ERROR: styles.dotError,
  NOT_CONNECTED: styles.dotNotConnected,
};

interface ConnectionStatusBadgeProps {
  status: ConnectionStatus;
}

export function ConnectionStatusBadge({ status }: ConnectionStatusBadgeProps) {
  return (
    <span className={`${styles.badge} ${containerClass[status]}`}>
      <span className={`${styles.dot} ${dotClass[status]}`} />
      {labelMap[status]}
    </span>
  );
}
