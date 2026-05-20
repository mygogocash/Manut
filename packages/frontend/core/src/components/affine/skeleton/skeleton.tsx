/**
 * Manut M2 E2.7 — brand skeleton primitives.
 *
 * Three primitives intended to replace ad-hoc spinners in loading-state
 * UX paths:
 *   - {@link Skeleton} — generic block/line/circle placeholder
 *   - {@link SkeletonGroup} — stack of N text lines with sensible default
 *   - {@link SkeletonCard} — title + body lines composition that mirrors
 *     the doc card / settings card shapes used in the explorer
 *
 * Differs from the existing `@affine/component` Skeleton primitive in two
 * ways:
 *   1. Brand-accent shimmer (violet) instead of neutral pulse — the
 *      explicit brand-violet tint makes loading states feel intentional
 *      rather than "the page hasn't decided what to render yet".
 *   2. Local — does not pull from `@affine/component` package root so it
 *      can be referenced from `.css.ts` consumers without dragging in
 *      the DOM-touching siblings that crashed v1.10.2 builds.
 *
 * Reduced-motion users see the placeholder shape with no moving gradient.
 * Width/height/borderRadius all flow through inline styles so the caller
 * controls layout.
 */
import clsx from 'clsx';
import type { CSSProperties, HTMLAttributes } from 'react';

import * as styles from './skeleton.css';

export type SkeletonAnimation = 'shimmer' | 'pulse' | 'none';
export type SkeletonVariant = 'block' | 'text' | 'circle';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** CSS width — number is interpreted as px, string passes through. */
  width?: number | string;
  /** CSS height — number is interpreted as px, string passes through. */
  height?: number | string;
  /** Override border-radius. Defaults to `--manut-radius-input` (8px). */
  borderRadius?: number | string;
  /** Animation style. Defaults to `shimmer`. */
  animation?: SkeletonAnimation;
  /** Visual variant. Defaults to `block`. */
  variant?: SkeletonVariant;
}

function toCssLength(value: number | string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return typeof value === 'number' ? `${value}px` : value;
}

export const Skeleton = ({
  width,
  height,
  borderRadius,
  animation = 'shimmer',
  variant = 'block',
  className,
  style,
  ...rest
}: SkeletonProps) => {
  const composedStyle: CSSProperties = {
    width: toCssLength(width),
    height: toCssLength(height),
    borderRadius: toCssLength(borderRadius),
    ...style,
  };

  return (
    <div
      aria-hidden="true"
      role="presentation"
      data-testid="manut-skeleton"
      data-variant={variant}
      data-animation={animation}
      className={clsx(
        styles.root,
        variant === 'circle' && styles.circle,
        variant === 'text' && styles.textLine,
        animation === 'shimmer' && styles.shimmer,
        animation === 'pulse' && styles.pulse,
        className
      )}
      style={composedStyle}
      {...rest}
    />
  );
};

export interface SkeletonGroupProps {
  /** Number of stacked text lines. Defaults to 3. */
  lines?: number;
  /** Optional className for the group wrapper. */
  className?: string;
  /** Optional inline style for the group wrapper. */
  style?: CSSProperties;
  /** Animation passed through to every child line. Defaults to `shimmer`. */
  animation?: SkeletonAnimation;
}

/**
 * Stack of N text-line skeletons. The last line gets a narrower width to
 * mimic the natural rag of a real paragraph.
 */
export const SkeletonGroup = ({
  lines = 3,
  className,
  style,
  animation = 'shimmer',
}: SkeletonGroupProps) => {
  const count = Math.max(1, lines);
  return (
    <div className={clsx(styles.group, className)} style={style}>
      {Array.from({ length: count }, (_, index) => {
        const isLast = index === count - 1;
        const width = isLast ? '62%' : '100%';
        return (
          <Skeleton
            key={index}
            variant="text"
            animation={animation}
            width={width}
          />
        );
      })}
    </div>
  );
};

export interface SkeletonCardProps {
  /** Number of body text lines. Defaults to 3. */
  bodyLines?: number;
  /** Whether to render a circular avatar above the title. Defaults to false. */
  withAvatar?: boolean;
  /** Optional className for the card wrapper. */
  className?: string;
  /** Optional inline style for the card wrapper. */
  style?: CSSProperties;
}

/**
 * Title + body composition that matches the AFFiNE doc-card and
 * settings-card silhouettes. Use as a drop-in fallback while a list of
 * cards is loading.
 */
export const SkeletonCard = ({
  bodyLines = 3,
  withAvatar = false,
  className,
  style,
}: SkeletonCardProps) => {
  return (
    <div
      className={clsx(styles.group, className)}
      style={style}
      data-testid="manut-skeleton-card"
    >
      {withAvatar ? (
        <Skeleton variant="circle" width={32} height={32} animation="pulse" />
      ) : null}
      <Skeleton width="70%" height={18} borderRadius={6} />
      <SkeletonGroup lines={bodyLines} />
    </div>
  );
};
