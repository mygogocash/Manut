import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';
import { CheckCircleIcon } from '@blocksuite/icons/rc';
import clsx from 'clsx';
import type { HTMLAttributes } from 'react';

const verifiedBadgeStyle = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  color: '#1565c0',
  fontSize: 12,
  fontWeight: 500,
  lineHeight: '20px',
  backgroundColor: 'rgba(21, 101, 192, 0.08)',
  borderRadius: 4,
  padding: '2px 8px',
  flexShrink: 0,
});

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
      <CheckCircleIcon fontSize={14} />
      Verified
    </span>
  );
}
