import { Tooltip } from '@affine/component';
import clsx from 'clsx';
import type { HTMLAttributes, MouseEvent, ReactNode } from 'react';
import { useCallback } from 'react';

import {
  card,
  cardContent,
  cardDesc,
  cardFooter,
  cardHeader,
  cardIcon,
  cardStatus,
  cardTitle,
  cloudOnlyBadge,
} from './card.css';

interface IntegrationCardProps extends HTMLAttributes<HTMLElement> {
  link?: string;
  /**
   * When true, the card is gated behind a cloud workspace. It's rendered
   * muted with a "Cloud only" badge, clicks are suppressed, and a tooltip
   * explains the gating on hover.
   */
  cloudOnly?: boolean;
  /** Tooltip text shown when `cloudOnly` is true. */
  cloudOnlyTooltip?: ReactNode;
  /** Badge label shown when `cloudOnly` is true. */
  cloudOnlyLabel?: string;
}

export const IntegrationCard = ({
  className,
  link,
  cloudOnly,
  cloudOnlyTooltip,
  cloudOnlyLabel,
  onClick,
  children,
  ...props
}: IntegrationCardProps) => {
  const handleClick = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      if (cloudOnly) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      onClick?.(event);
    },
    [cloudOnly, onClick]
  );

  const badge = cloudOnly ? (
    <span className={cloudOnlyBadge}>{cloudOnlyLabel ?? 'Cloud only'}</span>
  ) : null;

  const cardEl =
    link && !cloudOnly ? (
      <a
        className={clsx(className, card)}
        {...props}
        href={link}
        target="_blank"
        rel="noreferrer"
        onClick={handleClick}
      >
        {children}
      </a>
    ) : (
      <div
        className={clsx(className, card)}
        {...props}
        data-cloud-only={cloudOnly ? 'true' : undefined}
        aria-disabled={cloudOnly || undefined}
        onClick={handleClick}
      >
        {badge}
        {children}
      </div>
    );

  if (cloudOnly && cloudOnlyTooltip) {
    return <Tooltip content={cloudOnlyTooltip}>{cardEl}</Tooltip>;
  }

  return cardEl;
};

export const IntegrationCardIcon = ({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => {
  return <div className={clsx(cardIcon, className)} {...props} />;
};

export const IntegrationCardHeader = ({
  className,
  icon,
  title,
  status,
  ...props
}: HTMLAttributes<HTMLHeadElement> & {
  icon?: ReactNode;
  title?: string;
  status?: ReactNode;
}) => {
  return (
    <header className={clsx(cardHeader, className)} {...props}>
      <IntegrationCardIcon>{icon}</IntegrationCardIcon>
      <div>
        <div className={cardTitle}>{title}</div>
        {status ? <div className={cardStatus}>{status}</div> : null}
      </div>
    </header>
  );
};

export const IntegrationCardContent = ({
  className,
  desc,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  desc?: string;
}) => {
  return (
    <div className={clsx(cardContent, className)} {...props}>
      <div className={cardDesc}>{desc}</div>
    </div>
  );
};

export const IntegrationCardFooter = ({
  className,
  ...props
}: HTMLAttributes<HTMLElement>) => {
  return <footer className={clsx(cardFooter, className)} {...props} />;
};
