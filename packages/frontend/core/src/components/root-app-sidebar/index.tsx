// Import is already correct, no changes needed
import {
  AddPageButton,
  AppDownloadButton,
  AppSidebar,
  MenuItem,
  MenuLinkItem,
  QuickSearchInput,
  SidebarContainer,
  SidebarScrollableContainer,
} from '@affine/core/modules/app-sidebar/views';
import { ExternalMenuLinkItem } from '@affine/core/modules/app-sidebar/views/menu-item/external-menu-link-item';
import { AuthService, ServerService } from '@affine/core/modules/cloud';
import { WorkspaceDialogService } from '@affine/core/modules/dialogs';
import { FeatureFlagService } from '@affine/core/modules/feature-flag';
import { GraphMini } from '@affine/core/modules/knowledge-graph';
import { CMDKQuickSearchService } from '@affine/core/modules/quicksearch/services/cmdk';
import type { Workspace } from '@affine/core/modules/workspace';
import { useI18n } from '@affine/i18n';
import { track } from '@affine/track';
import type { Store } from '@blocksuite/affine/store';
import {
  AiOutlineIcon,
  AllDocsIcon,
  BlockIcon,
  CollaborationIcon,
  DataPanelIcon,
  DateTimeIcon,
  FolderIcon,
  HistoryIcon,
  ImportIcon,
  JournalIcon,
  RotateIcon,
  SettingsIcon,
} from '@blocksuite/icons/rc';
import { useLiveData, useService, useServices } from '@toeverything/infra';
import type { ReactElement } from 'react';
import { memo, useCallback } from 'react';

import {
  CollapsibleSection,
  NavigationPanelCollections,
  NavigationPanelFavorites,
  NavigationPanelMigrationFavorites,
  NavigationPanelOrganize,
  NavigationPanelTags,
} from '../../desktop/components/navigation-panel';
import { WorkbenchService } from '../../modules/workbench';
import { WorkspaceNavigator } from '../workspace-selector';
import { AgentsSection } from './agents-section';
import {
  bottomContainer,
  quickSearch,
  quickSearchAndNewPage,
  workspaceAndUserWrapper,
  workspaceWrapper,
} from './index.css';
import { InviteMembersButton } from './invite-members-button';
import { AppSidebarJournalButton } from './journal-button';
import { NotificationButton } from './notification-button';
import { SidebarAudioPlayer } from './sidebar-audio-player';
import { TabStrip } from './tab-strip';
import { TemplateDocEntrance } from './template-doc-entrance';
import { TrashButton } from './trash-button';
import { UpdaterButton } from './updater-button';
import { useActiveTab } from './use-active-tab';
import UserInfo from './user-info';
import { ChatView } from './views/chat-view';
import { HomeView } from './views/home-view';
import { InboxView } from './views/inbox-view';
import { MeetingsView } from './views/meetings-view';

export type RootAppSidebarProps = {
  isPublicWorkspace: boolean;
  onOpenQuickSearchModal: () => void;
  onOpenSettingModal: () => void;
  currentWorkspace: Workspace;
  openPage: (pageId: string) => void;
  createPage: () => Store;
  paths: {
    all: (workspaceId: string) => string;
    trash: (workspaceId: string) => string;
    shared: (workspaceId: string) => string;
  };
};

const AllDocsButton = () => {
  const t = useI18n();
  const { workbenchService } = useServices({
    WorkbenchService,
  });
  const workbench = workbenchService.workbench;
  const allPageActive = useLiveData(
    workbench.location$.selector(location => location.pathname === '/all')
  );

  return (
    <MenuLinkItem icon={<AllDocsIcon />} active={allPageActive} to={'/all'}>
      <span data-testid="all-pages">
        {t['com.affine.workspaceSubPath.all']()}
      </span>
    </MenuLinkItem>
  );
};

const GraphButton = () => {
  const { workbenchService } = useServices({
    WorkbenchService,
  });
  const workbench = workbenchService.workbench;
  const graphActive = useLiveData(
    workbench.location$.selector(location => location.pathname === '/graph')
  );

  return (
    <MenuLinkItem icon={<BlockIcon />} active={graphActive} to={'/graph'}>
      <span data-testid="knowledge-graph">Graph</span>
    </MenuLinkItem>
  );
};

const AnalyticsButton = () => {
  const { workbenchService } = useServices({
    WorkbenchService,
  });
  const workbench = workbenchService.workbench;
  const analyticsActive = useLiveData(
    workbench.location$.selector(location =>
      location.pathname.startsWith('/analytics')
    )
  );

  return (
    <MenuLinkItem
      icon={<DataPanelIcon />}
      active={analyticsActive}
      to={'/analytics'}
    >
      <span data-testid="analytics-nav">Analytics</span>
    </MenuLinkItem>
  );
};

/**
 * Returns true when the backend has `ServerFeature.Manut` enabled
 * (i.e., `ENABLE_SUPERFLOW_MODULE=true` on the server). The sidebar entries
 * and routes for Projects / CRM / Reminders are hidden otherwise so users
 * don't see broken navigation.
 *
 * Reads from `ServerService.server.features$` which the Manut plugin
 * populates on module init.
 */
const useManutEnabled = (): boolean => {
  const serverService = useService(ServerService);
  const serverFeatures = useLiveData(serverService.server.features$);
  // `features$` maps each ServerFeature into a lowercase keyed object
  // (`{ manut: true, copilot: true, ... }`) — NOT an array. See
  // `cloud/entities/server.ts`'s `features$` map. Calling `.includes()`
  // on an object throws `TypeError: t?.includes is not a function`,
  // which crashed the workspace render in production. Use property
  // access — matches the existing `serverFeatures?.copilot` usage
  // below.
  return !!serverFeatures?.manut;
};

const ProjectsButton = () => {
  const enabled = useManutEnabled();
  const { workbenchService } = useServices({
    WorkbenchService,
  });
  const workbench = workbenchService.workbench;
  const active = useLiveData(
    workbench.location$.selector(location =>
      location.pathname.startsWith('/projects')
    )
  );

  if (!enabled) return null;

  return (
    <MenuLinkItem icon={<FolderIcon />} active={active} to={'/projects'}>
      <span data-testid="projects-nav">Projects</span>
    </MenuLinkItem>
  );
};

const CrmButton = () => {
  const enabled = useManutEnabled();
  const { workbenchService } = useServices({
    WorkbenchService,
  });
  const workbench = workbenchService.workbench;
  const active = useLiveData(
    workbench.location$.selector(location =>
      location.pathname.startsWith('/crm')
    )
  );

  if (!enabled) return null;

  return (
    <MenuLinkItem icon={<CollaborationIcon />} active={active} to={'/crm'}>
      <span data-testid="crm-nav">CRM</span>
    </MenuLinkItem>
  );
};

const RemindersButton = () => {
  const enabled = useManutEnabled();
  const { workbenchService } = useServices({
    WorkbenchService,
  });
  const workbench = workbenchService.workbench;
  const active = useLiveData(
    workbench.location$.selector(location =>
      location.pathname.startsWith('/reminders')
    )
  );

  if (!enabled) return null;

  return (
    <MenuLinkItem icon={<DateTimeIcon />} active={active} to={'/reminders'}>
      <span data-testid="reminders-nav">Reminders</span>
    </MenuLinkItem>
  );
};

/**
 * Sidebar link to the Manut Routines page (PR #69 backend + PR 1.5 frontend).
 * Gated on `ServerFeature.Manut` like the other Manut nav entries.
 */
const RoutinesButton = () => {
  const enabled = useManutEnabled();
  const { workbenchService } = useServices({
    WorkbenchService,
  });
  const workbench = workbenchService.workbench;
  const active = useLiveData(
    workbench.location$.selector(location =>
      location.pathname.startsWith('/routines')
    )
  );

  if (!enabled) return null;

  return (
    <MenuLinkItem icon={<RotateIcon />} active={active} to={'/routines'}>
      <span data-testid="routines-nav">Routines</span>
    </MenuLinkItem>
  );
};

/**
 * Sidebar link to the Manut Control Plane release-runs board (Phase 4).
 * Gated on `ServerFeature.Manut` like the other Manut nav entries so
 * users on stock AFFiNE don't see a broken link.
 */
const ReleaseRunsButton = () => {
  const enabled = useManutEnabled();
  const { workbenchService } = useServices({
    WorkbenchService,
  });
  const workbench = workbenchService.workbench;
  const active = useLiveData(
    workbench.location$.selector(location =>
      location.pathname.startsWith('/release-runs')
    )
  );

  if (!enabled) return null;

  return (
    <MenuLinkItem icon={<HistoryIcon />} active={active} to={'/release-runs'}>
      <span data-testid="release-runs-nav">Release runs</span>
    </MenuLinkItem>
  );
};

const AIChatButton = () => {
  const t = useI18n();
  const featureFlagService = useService(FeatureFlagService);
  const serverService = useService(ServerService);
  const serverFeatures = useLiveData(serverService.server.features$);
  const enableAI = useLiveData(featureFlagService.flags.enable_ai.$);

  const { workbenchService } = useServices({
    WorkbenchService,
  });
  const workbench = workbenchService.workbench;
  const aiChatActive = useLiveData(
    workbench.location$.selector(location => location.pathname === '/chat')
  );

  if (!enableAI || !serverFeatures?.copilot) {
    return null;
  }

  return (
    <MenuLinkItem icon={<AiOutlineIcon />} active={aiChatActive} to={'/chat'}>
      <span data-testid="ai-chat">
        {t['com.affine.workspaceSubPath.chat']()}
      </span>
    </MenuLinkItem>
  );
};

/**
 * Renders the scrollable body content for the sidebar when the
 * `sidebar_tabs_v2` flag is on. Reads the active tab via globalState (the
 * `useActiveTab` hook) and swaps between Home / Chat / Meetings / Inbox.
 * Search is not a body view — it opens CMDK as an overlay (see
 * `tab-strip.tsx`) and never reaches this switch.
 */
const TabbedSidebarBody = ({
  onOpenImportModal,
}: {
  onOpenImportModal: () => void;
}): ReactElement => {
  const { activeTab } = useActiveTab();

  switch (activeTab) {
    case 'chat':
      return <ChatView />;
    case 'meetings':
      return <MeetingsView />;
    case 'inbox':
      return <InboxView />;
    case 'home':
    default:
      return <HomeView onOpenImportModal={onOpenImportModal} />;
  }
};

/**
 * This is for the whole affine app sidebar.
 * This component wraps the app sidebar in `@affine/component` with logic and data.
 *
 */
export const RootAppSidebar = memo((): ReactElement => {
  const { workbenchService, cMDKQuickSearchService, authService } = useServices(
    {
      WorkbenchService,
      CMDKQuickSearchService,
      AuthService,
    }
  );

  const sessionStatus = useLiveData(authService.session.status$);
  const t = useI18n();
  const workspaceDialogService = useService(WorkspaceDialogService);
  const featureFlagService = useService(FeatureFlagService);
  // Wave-2 Sidebar Phase 2 / Epic E1.9. When false the sidebar renders the
  // pre-flag layout unchanged; when true the TabStrip mounts above the
  // scrollable container and the body swaps per active tab.
  const sidebarTabsV2Enabled = useLiveData(
    featureFlagService.flags.sidebar_tabs_v2.$
  );
  const workbench = workbenchService.workbench;
  const workspaceSelectorOpen = useLiveData(workbench.workspaceSelectorOpen$);
  const onOpenQuickSearchModal = useCallback(() => {
    cMDKQuickSearchService.toggle();
  }, [cMDKQuickSearchService]);

  const onWorkspaceSelectorOpenChange = useCallback(
    (open: boolean) => {
      workbench.setWorkspaceSelectorOpen(open);
    },
    [workbench]
  );

  const onOpenSettingModal = useCallback(() => {
    workspaceDialogService.open('setting', {
      activeTab: 'appearance',
    });
    track.$.navigationPanel.$.openSettings();
  }, [workspaceDialogService]);

  const handleOpenDocs = useCallback(
    (result: {
      docIds: string[];
      entryId?: string;
      isWorkspaceFile?: boolean;
    }) => {
      const { docIds, entryId, isWorkspaceFile } = result;
      // If the imported file is a workspace file, open the entry page.
      if (isWorkspaceFile && entryId) {
        workbench.openDoc(entryId);
      } else if (!docIds.length) {
        return;
      }
      // Open all the docs when there are multiple docs imported.
      if (docIds.length > 1) {
        workbench.openAll();
      } else {
        // Otherwise, open the only doc.
        workbench.openDoc(docIds[0]);
      }
    },
    [workbench]
  );

  const onOpenImportModal = useCallback(() => {
    track.$.navigationPanel.importModal.open();
    workspaceDialogService.open('import', undefined, payload => {
      if (!payload) {
        return;
      }
      handleOpenDocs(payload);
    });
  }, [workspaceDialogService, handleOpenDocs]);

  return (
    <AppSidebar>
      {/*
       * Five-tab strip — mounted only when the `sidebar_tabs_v2` feature
       * flag is on. Sits above every other sidebar surface so the active
       * tab is always reachable. With the flag off the layout is
       * byte-identical to pre-flag main.
       */}
      {sidebarTabsV2Enabled ? <TabStrip /> : null}
      <SidebarContainer>
        <div className={workspaceAndUserWrapper}>
          <div className={workspaceWrapper}>
            <WorkspaceNavigator
              showEnableCloudButton
              showSyncStatus
              open={workspaceSelectorOpen}
              onOpenChange={onWorkspaceSelectorOpenChange}
              dense
            />
          </div>
          {/*
           * Ambient Knowledge Graph widget — three nodes connected by
           * two faint arcs, with a synaptic pulse whenever the AI
           * touches a doc anywhere in the workspace. Persistent,
           * decorative, carries the Knowledge Graph brand into every
           * page. Renders a 60x24 canvas with pointerEvents: none so
           * it doesn't intercept clicks meant for the workspace
           * switcher or user menu.
           */}
          <GraphMini />
          <UserInfo />
        </div>
        {/*
         * Intelligence (AI chat) sits directly under the workspace switcher
         * so the primary AI interaction is the first nav item users see —
         * before search, before docs. AIChatButton self-gates on
         * enableAI + serverFeatures.copilot so it renders null on
         * deployments without copilot, keeping the layout stable.
         */}
        <AIChatButton />
        <div className={quickSearchAndNewPage}>
          <QuickSearchInput
            className={quickSearch}
            data-testid="slider-bar-quick-search-button"
            data-event-props="$.navigationPanel.$.quickSearch"
            onClick={onOpenQuickSearchModal}
          />
          <AddPageButton />
        </div>
        {/*
         * Notifications sits directly under the search bar so the
         * scan-the-inbox affordance is right next to the find-anything
         * affordance. Self-gates on sessionStatus so it doesn't show
         * for unauthenticated visitors.
         */}
        {sessionStatus === 'authenticated' && <NotificationButton />}
        <AllDocsButton />
        <GraphButton />
        <AnalyticsButton />
        <ProjectsButton />
        <CrmButton />
        <RemindersButton />
        <RoutinesButton />
        <ReleaseRunsButton />
        <AppSidebarJournalButton />
        <AgentsSection />
        <MenuItem
          data-testid="slider-bar-workspace-setting-button"
          icon={<SettingsIcon />}
          onClick={onOpenSettingModal}
        >
          <span data-testid="settings-modal-trigger">
            {t['com.affine.settingSidebar.title']()}
          </span>
        </MenuItem>
      </SidebarContainer>
      <SidebarScrollableContainer>
        {sidebarTabsV2Enabled ? (
          // Tabs-v2: body content is owned by the active tab. Home re-uses
          // the same section components used pre-flag; Chat / Meetings /
          // Inbox render the M1 placeholder views.
          <TabbedSidebarBody onOpenImportModal={onOpenImportModal} />
        ) : (
          <>
            <NavigationPanelFavorites />
            <NavigationPanelOrganize />
            <NavigationPanelMigrationFavorites />
            <NavigationPanelTags />
            <NavigationPanelCollections />
            <CollapsibleSection
              path={['others']}
              title={t['com.affine.rootAppSidebar.others']()}
              contentStyle={{ padding: '6px 8px 0 8px' }}
            >
              <TrashButton />
              <MenuItem
                data-testid="slider-bar-import-button"
                icon={<ImportIcon />}
                onClick={onOpenImportModal}
              >
                <span data-testid="import-modal-trigger">{t['Import']()}</span>
              </MenuItem>
              <InviteMembersButton />
              <TemplateDocEntrance />
              <ExternalMenuLinkItem
                href="https://affine.pro/blog?tag=Release+Note"
                icon={<JournalIcon />}
                label={t['com.affine.app-sidebar.learn-more']()}
              />
            </CollapsibleSection>
          </>
        )}
      </SidebarScrollableContainer>
      <SidebarContainer className={bottomContainer}>
        <SidebarAudioPlayer />
        {BUILD_CONFIG.isElectron ? <UpdaterButton /> : <AppDownloadButton />}
      </SidebarContainer>
    </AppSidebar>
  );
});

RootAppSidebar.displayName = 'memo(RootAppSidebar)';
