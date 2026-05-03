import { Menu, MenuItem, MenuTrigger, notify } from '@affine/component';
import { useAsyncCallback } from '@affine/core/components/hooks/affine-async-hooks';
import { useWorkspaceName } from '@affine/core/components/hooks/use-workspace-info';
import { EditorService } from '@affine/core/modules/editor';
import { DocGrantedUsersService } from '@affine/core/modules/permissions';
import { ShareInfoService } from '@affine/core/modules/share-doc';
import {
  type WorkspaceMetadata,
  WorkspaceService,
} from '@affine/core/modules/workspace';
import { UserFriendlyError } from '@affine/error';
import { DocRole, PublicDocMode } from '@affine/graphql';
import { useI18n } from '@affine/i18n';
import { track } from '@affine/track';
import * as RadixRadioGroup from '@radix-ui/react-radio-group';
import { useLiveData, useService } from '@toeverything/infra';
import clsx from 'clsx';
import { useCallback, useEffect, useMemo } from 'react';

import { PlanTag } from '../plan-tag';
import * as styles from './general-access.css';

type AccessTier = 'invited' | 'workspace' | 'public';
type PermissionLevel = 'view' | 'edit';

interface GeneralAccessProps {
  workspaceMetadata: WorkspaceMetadata;
  hittingPaywall: boolean;
  openPaywallModal?: () => void;
  canManageUsers: boolean;
  canPublish: boolean;
}

/**
 * Notion-style "General access" section with three mutually exclusive tiers
 * (radio-group) plus a per-tier permission level.
 *
 * Tier mapping to existing data model:
 *   - "invited"   -> defaultRole = None  AND public = false
 *   - "workspace" -> defaultRole in {Reader, Editor} AND public = false
 *   - "public"    -> public = true (publishDoc mutation)
 *
 * Permission level only applies to "workspace" and "public":
 *   - workspace: Reader = Can view, Editor = Can edit (mapped to defaultRole)
 *   - public: backend currently only supports read-only public links, so
 *     "Can edit" is disabled on this tier. The dropdown is rendered but the
 *     edit option is greyed out with an explanatory tooltip.
 */
export const GeneralAccess = ({
  workspaceMetadata,
  hittingPaywall,
  openPaywallModal,
  canManageUsers,
  canPublish,
}: GeneralAccessProps) => {
  const t = useI18n();
  const workspaceService = useService(WorkspaceService);
  const editorService = useService(EditorService);
  const shareInfoService = useService(ShareInfoService);
  const docGrantedUsersService = useService(DocGrantedUsersService);

  const localWorkspaceName = useLiveData(workspaceService.workspace.name$);
  const profileName = useWorkspaceName(workspaceMetadata);
  const workspaceName = profileName ?? localWorkspaceName ?? '';

  const info = useLiveData(shareInfoService.shareInfo.info$);
  const isRevalidating = useLiveData(shareInfoService.shareInfo.isRevalidating$);
  const currentMode = useLiveData(editorService.editor.mode$);

  useEffect(() => {
    shareInfoService.shareInfo.revalidate();
  }, [shareInfoService]);

  const isPublic = !!info?.public;
  const defaultRole = info?.defaultRole;

  // Derive the active tier from the underlying state.
  const activeTier: AccessTier = useMemo(() => {
    if (isPublic) return 'public';
    if (
      defaultRole === DocRole.Reader ||
      defaultRole === DocRole.Editor ||
      defaultRole === DocRole.Manager
    ) {
      return 'workspace';
    }
    return 'invited';
  }, [defaultRole, isPublic]);

  // Derive the active permission level for whichever tier is selected.
  const activePermission: PermissionLevel = useMemo(() => {
    if (activeTier === 'workspace') {
      return defaultRole === DocRole.Editor || defaultRole === DocRole.Manager
        ? 'edit'
        : 'view';
    }
    if (activeTier === 'public') {
      // Backend only supports read-only public links today.
      return 'view';
    }
    return 'view';
  }, [activeTier, defaultRole]);

  const updateDefaultRole = useAsyncCallback(
    async (role: DocRole) => {
      try {
        track.$.sharePanel.$.modifyDocDefaultRole({ role });
        await docGrantedUsersService.updateDocDefaultRole(role);
        shareInfoService.shareInfo.revalidate();
      } catch (error) {
        const err = UserFriendlyError.fromAny(error);
        notify.error({ title: err.name, message: err.message });
      }
    },
    [docGrantedUsersService, shareInfoService.shareInfo]
  );

  const handleTierChange = useCallback(
    (next: AccessTier) => {
      if (next === activeTier) return;

      // Permission-tier transitions guarded against missing capability.
      if ((next === 'workspace' || next === 'public') && hittingPaywall) {
        openPaywallModal?.();
        return;
      }
      if (next === 'public' && !canPublish) return;
      if ((next === 'invited' || next === 'workspace') && !canManageUsers) {
        return;
      }

      const transition = async () => {
        if (next === 'invited') {
          if (isPublic) await shareInfoService.shareInfo.disableShare();
          await docGrantedUsersService.updateDocDefaultRole(DocRole.None);
        } else if (next === 'workspace') {
          if (isPublic) await shareInfoService.shareInfo.disableShare();
          // Default to Reader unless an Editor was previously implied.
          const targetRole =
            activePermission === 'edit' ? DocRole.Editor : DocRole.Reader;
          await docGrantedUsersService.updateDocDefaultRole(targetRole);
        } else if (next === 'public') {
          // Public link does not require defaultRole change; we keep the
          // existing defaultRole as a fallback for non-public viewers, but
          // also reset it to None so that toggling back to "invited" yields a
          // clean state.
          await docGrantedUsersService.updateDocDefaultRole(DocRole.None);
          await shareInfoService.shareInfo.enableShare(
            currentMode === 'edgeless'
              ? PublicDocMode.Edgeless
              : PublicDocMode.Page
          );
        }
        shareInfoService.shareInfo.revalidate();
      };

      transition().catch(error => {
        const err = UserFriendlyError.fromAny(error);
        notify.error({ title: err.name, message: err.message });
      });
    },
    [
      activeTier,
      activePermission,
      canManageUsers,
      canPublish,
      currentMode,
      docGrantedUsersService,
      hittingPaywall,
      isPublic,
      openPaywallModal,
      shareInfoService.shareInfo,
    ]
  );

  const handlePermissionChange = useCallback(
    (next: PermissionLevel) => {
      if (next === activePermission) return;
      if (activeTier === 'workspace') {
        if (hittingPaywall) {
          openPaywallModal?.();
          return;
        }
        updateDefaultRole(next === 'edit' ? DocRole.Editor : DocRole.Reader);
      }
      // For "public" tier the only supported value is view; ignore "edit".
      // For "invited" tier no permission level is shown.
    },
    [
      activePermission,
      activeTier,
      hittingPaywall,
      openPaywallModal,
      updateDefaultRole,
    ]
  );

  const tiers: Array<{
    value: AccessTier;
    label: string;
    description: string;
    disabled: boolean;
  }> = useMemo(
    () => [
      {
        value: 'invited',
        label: t['com.affine.share-menu.tier.invited.label'](),
        description: t['com.affine.share-menu.tier.invited.description'](),
        disabled: !canManageUsers,
      },
      {
        value: 'workspace',
        label: t['com.affine.share-menu.tier.workspace.label']({
          workspaceName,
        }),
        description: t['com.affine.share-menu.tier.workspace.description'](),
        disabled: !canManageUsers,
      },
      {
        value: 'public',
        label: t['com.affine.share-menu.tier.public.label'](),
        description: t['com.affine.share-menu.tier.public.description'](),
        disabled: !canPublish,
      },
    ],
    [canManageUsers, canPublish, t, workspaceName]
  );

  return (
    <div className={styles.generalAccessRoot}>
      <RadixRadioGroup.Root
        value={activeTier}
        onValueChange={(v: string) => handleTierChange(v as AccessTier)}
        className={styles.tierList}
        aria-label="General access"
      >
        {tiers.map(tier => {
          const selected = activeTier === tier.value;
          return (
            <div
              key={tier.value}
              data-disabled={tier.disabled ? 'true' : 'false'}
              className={clsx(styles.tierRow, {
                [styles.tierRowSelected]: selected,
                [styles.tierRowDisabled]: tier.disabled,
              })}
            >
              <RadixRadioGroup.Item
                value={tier.value}
                disabled={tier.disabled || isRevalidating}
                className={styles.radioCircle}
                data-testid={`share-tier-${tier.value}`}
                id={`share-tier-${tier.value}`}
              >
                <RadixRadioGroup.Indicator className={styles.radioIndicator} />
              </RadixRadioGroup.Item>
              <label
                htmlFor={`share-tier-${tier.value}`}
                className={styles.tierLabelBlock}
              >
                <div className={styles.tierLabel}>{tier.label}</div>
                <div className={styles.tierDescription}>{tier.description}</div>
              </label>
              {selected && tier.value !== 'invited' ? (
                <PermissionDropdown
                  tier={tier.value}
                  active={activePermission}
                  hittingPaywall={hittingPaywall}
                  disabled={tier.disabled}
                  onSelect={handlePermissionChange}
                />
              ) : null}
            </div>
          );
        })}
      </RadixRadioGroup.Root>
    </div>
  );
};

interface PermissionDropdownProps {
  tier: AccessTier;
  active: PermissionLevel;
  hittingPaywall: boolean;
  disabled?: boolean;
  onSelect: (next: PermissionLevel) => void;
}

const PermissionDropdown = ({
  tier,
  active,
  hittingPaywall,
  disabled,
  onSelect,
}: PermissionDropdownProps) => {
  const t = useI18n();

  const label =
    active === 'edit'
      ? t['com.affine.share-menu.permission.can-edit']()
      : t['com.affine.share-menu.permission.can-view']();

  // For the "public" tier we currently only support read-only links.
  const editDisabledForTier = tier === 'public';

  return (
    <Menu
      contentOptions={{ align: 'end' }}
      items={
        <>
          <MenuItem
            onSelect={() => onSelect('view')}
            selected={active === 'view'}
          >
            <div className={styles.permissionItem}>
              <span>{t['com.affine.share-menu.permission.can-view']()}</span>
            </div>
          </MenuItem>
          <MenuItem
            onSelect={() => {
              if (editDisabledForTier) return;
              onSelect('edit');
            }}
            selected={active === 'edit'}
            disabled={editDisabledForTier}
          >
            <div className={styles.permissionItem}>
              <span>{t['com.affine.share-menu.permission.can-edit']()}</span>
              {hittingPaywall && tier === 'workspace' ? <PlanTag /> : null}
              {editDisabledForTier ? (
                <span className={styles.permissionHint}>
                  {t[
                    'com.affine.share-menu.permission.public-edit-unsupported'
                  ]()}
                </span>
              ) : null}
            </div>
          </MenuItem>
        </>
      }
    >
      <MenuTrigger
        className={styles.permissionTrigger}
        variant="plain"
        suffixClassName={styles.permissionTriggerSuffix}
        disabled={disabled}
        data-testid={`share-tier-${tier}-permission-trigger`}
      >
        {label}
      </MenuTrigger>
    </Menu>
  );
};
