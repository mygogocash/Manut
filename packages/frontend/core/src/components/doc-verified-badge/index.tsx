import { DoneIcon } from '@blocksuite/icons/rc';
import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';
import clsx from 'clsx';
import type { HTMLAttributes } from 'react';

// Use design tokens so the badge respects theme switches (light / dark).
// `button/primary` matches the rest of the workspace's primary-action surface.
const verifiedBadgeStyle = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  color: cssVarV2('button/primary'),
  fontSize: 12,
  fontWeight: 500,
  lineHeight: '20px',
  backgroundColor: cssVarV2('layer/background/primary'),
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
      <DoneIcon fontSize={14} />
      Verified
    </span>
  );
}
