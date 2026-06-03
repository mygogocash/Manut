import { SettingHeader } from '@affine/component/setting-components';
import { useWorkspaceInfo } from '@affine/core/components/hooks/use-workspace-info';
import { ServerService } from '@affine/core/modules/cloud';
import type { SettingTab } from '@affine/core/modules/dialogs/constant';
import { WorkspacePermissionService } from '@affine/core/modules/permissions';
import { EmbeddingSettings } from '@affine/core/modules/workspace-indexer-embedding';
import { ServerDeploymentType } from '@affine/graphql';
import { useI18n } from '@affine/i18n';
import {
  AiEmbeddingIcon,
  CollaborationIcon,
  DataPanelIcon,
  IntegrationsIcon,
  PaymentIcon,
  PropertyIcon,
  SaveIcon,
  SettingsIcon,
} from '@blocksuite/icons/rc';
import { useLiveData, useService } from '@toeverything/infra';
import { useMemo } from 'react';

import type { SettingSidebarItem, SettingState } from '../types';
import { WorkspaceAnalyticsConnections } from './analytics-connections';
import { WorkspaceSettingBilling } from './billing';
import { IntegrationSetting } from './integration';
import { WorkspaceSettingLicense } from './license';
import { MembersPanel } from './members';
import { WorkspaceSettingDetail } from './preference';
import { WorkspaceSettingProperties } from './properties';
import { WorkspaceSettingStorage } from './storage';

const UnavailableOperationalSetting = ({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) => {
  return (
    <>
      <SettingHeader
        title={title}
        subtitle="Operational settings unavailable"
      />
      <div
        role="status"
        style={{
          padding: '16px 20px',
          borderRadius: '8px',
          border: '1px solid var(--affine-border-color)',
          backgroundColor: 'var(--affine-background-secondary-color)',
          fontSize: '14px',
          lineHeight: '20px',
          color: 'var(--affine-text-primary-color)',
        }}
      >
        <p style={{ margin: 0, fontWeight: 600 }}>
          This panel is not connected yet.
        </p>
        <p
          style={{
            marginTop: '8px',
            marginBottom: 0,
            color: 'var(--affine-text-secondary-color)',
          }}
        >
          {subtitle}
        </p>
      </div>
    </>
  );
};

export const WorkspaceSetting = ({
  activeTab,
  scrollAnchor,
  onCloseSetting,
  onChangeSettingState,
}: {
  activeTab: SettingTab;
  scrollAnchor?: string;
  onCloseSetting: () => void;
  onChangeSettingState: (settingState: SettingState) => void;
}) => {
  const t = useI18n();
  switch (activeTab) {
    case 'workspace:preference':
      return <WorkspaceSettingDetail onCloseSetting={onCloseSetting} />;
    case 'workspace:properties':
      return <WorkspaceSettingProperties />;
    case 'workspace:members':
      return (
        <MembersPanel
          onCloseSetting={onCloseSetting}
          onChangeSettingState={onChangeSettingState}
        />
      );
    case 'workspace:billing':
      return <WorkspaceSettingBilling />;
    case 'workspace:storage':
      return <WorkspaceSettingStorage onCloseSetting={onCloseSetting} />;
    case 'workspace:license':
      return <WorkspaceSettingLicense onCloseSetting={onCloseSetting} />;
    case 'workspace:integrations':
      return <IntegrationSetting scrollAnchor={scrollAnchor} />;
    case 'workspace:embedding':
      return <EmbeddingSettings />;
    case 'workspace:analytics-connections':
      return <WorkspaceAnalyticsConnections />;
    case 'workspace:budget':
      return (
        <UnavailableOperationalSetting
          title={t['com.manut.settings.workspace.budget.title']()}
          subtitle="Budget data is not wired to a live fetcher in this build, so spend and quota state are hidden instead of shown as empty."
        />
      );
    case 'workspace:workQueues':
      return (
        <UnavailableOperationalSetting
          title={t['com.manut.settings.workspace.work-queues.title']()}
          subtitle="Work Queues need a project selector and live queue fetchers before they can be managed from settings."
        />
      );
    default:
      return null;
  }
};

export const useWorkspaceSettingList = (): SettingSidebarItem[] => {
  const workspaceService = useService(WorkspaceService);
  const information = useWorkspaceInfo(workspaceService.workspace);
  const serverService = useService(ServerService);
  const workspacePermissionService = useService(
    WorkspacePermissionService
  ).permission;
  const isOwner = useLiveData(workspacePermissionService.isOwner$);
  const isAdmin = useLiveData(workspacePermissionService.isAdmin$);
  const canManageConnections = Boolean(isOwner || isAdmin);

  const isSelfhosted = useLiveData(
    serverService.server.config$.selector(
      c => c.type === ServerDeploymentType.Selfhosted
    )
  );

  const t = useI18n();

  const showBilling =
    !isSelfhosted && information?.isTeam && information?.isOwner;
  // MANUT: hide the License tab on self-hosted. The Manut fork ships
  // FOSS with no seat cap and no upgrade prompts, so the entire License /
  // "Get teams plan" surface is removed from the workspace settings sidebar.
  // The route case `'workspace:license'` in the switch above is kept (and the
  // panel renders a "all features enabled" notice) so direct-URL deep-links
  // and other call sites that still reference the tab remain non-broken.
  const showLicense = false;
  // Original upstream: const showLicense = information?.isOwner && isSelfhosted;
  const items = useMemo<SettingSidebarItem[]>(() => {
    return [
      {
        key: 'workspace:preference',
        title: t['com.affine.settings.workspace.preferences'](),
        icon: <SettingsIcon />,
        testId: 'workspace-setting:preference',
      },
      {
        key: 'workspace:properties',
        title: t['com.affine.settings.workspace.properties'](),
        icon: <PropertyIcon />,
        testId: 'workspace-setting:properties',
      },
      {
        key: 'workspace:members',
        title: t['Members'](),
        icon: <CollaborationIcon />,
        testId: 'workspace-setting:members',
      },
      {
        key: 'workspace:integrations',
        title: t['com.affine.integration.integrations'](),
        icon: <IntegrationsIcon />,
        testId: 'workspace-setting:integrations',
      },
      canManageConnections && {
        key: 'workspace:analytics-connections' as SettingTab,
        title: 'Analytics · Connections',
        icon: <DataPanelIcon />,
        testId: 'workspace-setting:analytics-connections',
      },
      {
        key: 'workspace:storage',
        title: t['Storage'](),
        icon: <SaveIcon />,
        testId: 'workspace-setting:storage',
      },
      {
        key: 'workspace:embedding',
        title:
          t[
            'com.affine.settings.workspace.indexer-embedding.embedding.title'
          ](),
        icon: <AiEmbeddingIcon />,
        testId: 'workspace-setting:embedding',
      },
      showBilling && {
        key: 'workspace:billing' as SettingTab,
        title: t['com.affine.settings.workspace.billing'](),
        icon: <PaymentIcon />,
        testId: 'workspace-setting:billing',
      },
      showLicense && {
        key: 'workspace:license' as SettingTab,
        title: t['com.affine.settings.workspace.license'](),
        icon: <PaymentIcon />,
        testId: 'workspace-setting:license',
      },
    ].filter((item): item is SettingSidebarItem => !!item);
  }, [canManageConnections, showBilling, showLicense, t]);

  return items;
};
