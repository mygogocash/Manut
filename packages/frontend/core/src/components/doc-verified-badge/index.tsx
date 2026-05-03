import { DoneIcon } from '@blocksuite/icons/rc';
import clsx from 'clsx';
import type { HTMLAttributes } from 'react';

import { verifiedBadgeStyle } from './index.css';

export interface DocVerifiedBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /**
   * Whether the doc is currently verified (verifiedAt is set and not expired).
   */
  isVerified: boolean;
}

/**
 * A small badge displayed next to a doc title when the doc has been officially
 * verified by a workspace admin.
 */
export function DocVerifiedBadge({
  isVerified,
  className,
  ...rest
}: DocVerifiedBadgeProps) {
  if (!isVerified) return null;

  return (
    <span
      className={clsx(verifiedBadgeStyle, className)}
      title="This page has been verified by a workspace admin"
      aria-label="Verified page"
      {...rest}
    >
      <DoneIcon fontSize={14} />
      Verified
    </span>
  );
}
