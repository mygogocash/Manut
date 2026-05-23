import { Avatar } from '@affine/component';
import { useWorkspaceInfo } from '@affine/core/components/hooks/use-workspace-info';
import { WorkspaceAvatar } from '@affine/core/components/workspace-avatar';
import { WorkspaceService } from '@affine/core/modules/workspace';
import { UNTITLED_WORKSPACE_NAME } from '@affine/env/constant';
import { ArrowDownSmallIcon } from '@blocksuite/icons/rc';
import { useServiceOptional } from '@toeverything/infra';
import clsx from 'clsx';
import { type ButtonHTMLAttributes, forwardRef } from 'react';

import { card, dropdownIcon, label } from './card.css';

export interface CurrentWorkspaceCardProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  compact?: boolean;
}

export const CurrentWorkspaceCard = forwardRef<
  HTMLButtonElement,
  CurrentWorkspaceCardProps
>(function CurrentWorkspaceCard(
  { compact, onClick, className, ...attrs },
  ref
) {
  const currentWorkspace = useServiceOptional(WorkspaceService)?.workspace;
  const info = useWorkspaceInfo(currentWorkspace?.meta);
  const name = info?.name ?? UNTITLED_WORKSPACE_NAME;

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className={clsx(card, className)}
      data-compact={compact ? 'true' : 'false'}
      data-testid="mobile-workspace-switcher-trigger"
      aria-label={`Switch workspace, current workspace ${name}`}
      {...attrs}
    >
      {currentWorkspace ? (
        <WorkspaceAvatar
          key={currentWorkspace?.id}
          meta={currentWorkspace?.meta}
          rounded={3}
          data-testid="workspace-avatar"
          size={40}
          name={name}
          colorfulFallback
        />
      ) : (
        <Avatar size={40} rounded={3} colorfulFallback />
      )}
      {!compact ? (
        <div className={label}>
          {name}
          <ArrowDownSmallIcon className={dropdownIcon} />
        </div>
      ) : null}
    </button>
  );
});
