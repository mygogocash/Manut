import { usePageHelper } from '@affine/core/blocksuite/block-suite-page-list/utils';
import {
  AddPageButton,
  AppDownloadButton,
  AppSidebar,
  CategoryDivider,
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
import { WorkspaceService } from '@affine/core/modules/workspace';
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
  PlusIcon,
  RotateIcon,
} from '@blocksuite/icons/rc';
import { useLiveData, useService, useServices } from '@toeverything/infra';
import type { MouseEvent, ReactElement, ReactNode } from 'react';
import { Fragment, memo, useCallback, useMemo } from 'react';

import {
  NavigationPanelCollections,
  NavigationPanelFavorites,
  NavigationPanelMigrationFavorites,
  NavigationPanelOrganize,
  NavigationPanelTags,
} from '../../desktop/components/navigation-panel';
import { WorkbenchService } from '../../modules/workbench';
import { WorkspaceNavigator } from '../workspace-selector';
import { AgentsSection } from './agents-section';
import { ConnectGithubButton } from './connect-github-button';
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
import {
  getVisibleSidebarMenuItems,
  type SidebarMenuItem,
  type SidebarMenuPreferences,
} from './sidebar-menu-customization';
import { TabStrip } from './tab-strip';
import { newPillButton, newPillIcon } from './tab-strip.css';
import { TemplateDocEntrance } from './template-doc-entrance';
import { TrashButton } from './trash-button';
import { UpdaterButton } from './updater-button';
import { useActiveTab } from './use-active-tab';
import { useSidebarMenuPreferences } from './use-sidebar-menu-preferences';
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

function renderSidebarMenuItems(
  items: readonly SidebarMenuItem<ReactNode>[],
  preferences: SidebarMenuPreferences | undefined
): ReactElement[] {
  return getVisibleSidebarMenuItems(items, preferences).map(
    ({ key, value }) => <Fragment key={key}>{value}</Fragment>
  );
}

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
 * `useActiveTab` hook) and swaps between Home / Chat / Calendar / Inbox /
 * Search.
 */
const TabbedSidebarBody = ({
  onOpenImportModal,
  homeMenuItems,
}: {
  onOpenImportModal: () => void;
  homeMenuItems: SidebarMenuItem<ReactNode>[];
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
      return (
        <HomeView
          onOpenImportModal={onOpenImportModal}
          menuItems={homeMenuItems}
        />
      );
  }
};

/**
 * Bottom "+ New" pill — full-width button rendered at the very bottom of
 * the sidebar when sidebar_tabs_v2 is on. Mirrors the no-ask branch of
 * `AddPageButton` (the existing IconButton) for behavior parity: creates
 * a fresh doc in the current workspace + fires the navigation-panel
 * createDoc telemetry. The Notion-style violet pill styling lives in
 * tab-strip.css.ts so the chip + pill share one brand token family.
 */
const NewDocPill = (): ReactElement => {
  const t = useI18n();
  const workspaceService = useService(WorkspaceService);
  const currentWorkspace = workspaceService.workspace;
  const pageHelper = usePageHelper(currentWorkspace.docCollection);

  const onClickNewPage = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      // `inferOpenMode` would pick this up if we wanted modifier-key open;
      // for the pill we keep it deliberately simple — a regular click
      // opens the new doc in the active workbench view, same as the
      // upstream AddPageButton IconButton (decision: keep the pill quiet
      // until users ask for power-user shortcuts).
      e.preventDefault();
      pageHelper.createPage();
      track.$.navigationPanel.$.createDoc();
    },
    [pageHelper]
  );

  return (
    <button
      type="button"
      className={newPillButton}
      data-testid="sidebar-bottom-new-pill"
      onClick={onClickNewPage}
    >
      <span className={newPillIcon} aria-hidden="true">
        <PlusIcon />
      </span>
      <span>{t['New Page']()}</span>
    </button>
  );
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
  const workspaceService = useService(WorkspaceService);
  const isCloudWorkspace = workspaceService.workspace.flavour !== 'local';
  const workspaceDialogService = useService(WorkspaceDialogService);
  const featureFlagService = useService(FeatureFlagService);
  const { preferences } = useSidebarMenuPreferences();
  // Wave-2 Sidebar Phase 2 / Epic E1.9. When false the sidebar renders the
  // pre-flag layout unchanged; when true the TabStrip mounts under the
  // workspace section and the body swaps per active tab.
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

  const homeMenuItems = useMemo<SidebarMenuItem<ReactNode>[]>(
    () => [
      { key: 'allDocs', value: <AllDocsButton /> },
      { key: 'graph', value: <GraphButton /> },
      { key: 'analytics', value: <AnalyticsButton /> },
      { key: 'projects', value: <ProjectsButton /> },
      { key: 'crm', value: <CrmButton /> },
      { key: 'reminders', value: <RemindersButton /> },
      { key: 'routines', value: <RoutinesButton /> },
      { key: 'releaseRuns', value: <ReleaseRunsButton /> },
      { key: 'journals', value: <AppSidebarJournalButton /> },
      { key: 'agents', value: <AgentsSection /> },
    ],
    []
  );

  const legacyMenuItems = useMemo<SidebarMenuItem<ReactNode>[]>(
    () => [
      { key: 'aiChat', value: <AIChatButton /> },
      {
        key: 'quickSearchAndNewDoc',
        value: (
          <div className={quickSearchAndNewPage}>
            <QuickSearchInput
              className={quickSearch}
              data-testid="slider-bar-quick-search-button"
              data-event-props="$.navigationPanel.$.quickSearch"
              onClick={onOpenQuickSearchModal}
            />
            <AddPageButton />
          </div>
        ),
      },
      {
        key: 'notifications',
        value:
          sessionStatus === 'authenticated' ? <NotificationButton /> : null,
      },
      ...homeMenuItems,
    ],
    [homeMenuItems, onOpenQuickSearchModal, sessionStatus]
  );

  const sectionMenuItems = useMemo<SidebarMenuItem<ReactNode>[]>(
    () => [
      { key: 'favorites', value: <NavigationPanelFavorites /> },
      { key: 'organize', value: <NavigationPanelOrganize /> },
      {
        key: 'migrationFavorites',
        value: <NavigationPanelMigrationFavorites />,
      },
      { key: 'tags', value: <NavigationPanelTags /> },
      { key: 'collections', value: <NavigationPanelCollections /> },
    ],
    []
  );

  const utilityMenuItems = useMemo<SidebarMenuItem<ReactNode>[]>(
    () => [
      { key: 'trash', value: <TrashButton /> },
      {
        key: 'import',
        value: (
          <MenuItem
            data-testid="slider-bar-import-button"
            icon={<ImportIcon />}
            onClick={onOpenImportModal}
          >
            <span data-testid="import-modal-trigger">{t['Import']()}</span>
          </MenuItem>
        ),
      },
      { key: 'templates', value: <TemplateDocEntrance /> },
      {
        key: 'learnMore',
        value: (
          <ExternalMenuLinkItem
            href="https://affine.pro/blog?tag=Release+Note"
            icon={<JournalIcon />}
            label={t['com.affine.app-sidebar.learn-more']()}
          />
        ),
      },
      ...(sidebarTabsV2Enabled
        ? [{ key: 'newDoc', value: <NewDocPill /> } as const]
        : []),
      {
        key: 'downloadApp',
        value: BUILD_CONFIG.isElectron ? (
          <UpdaterButton />
        ) : (
          <AppDownloadButton />
        ),
      },
    ],
    [onOpenImportModal, sidebarTabsV2Enabled, t]
  );

  const tryMenuItems = useMemo<SidebarMenuItem<ReactNode>[]>(
    () => [
      { key: 'inviteMembers', value: <InviteMembersButton /> },
      { key: 'connectGithub', value: <ConnectGithubButton /> },
    ],
    []
  );

  const tryMenuElements = renderSidebarMenuItems(tryMenuItems, preferences);

  return (
    <AppSidebar>
      <SidebarContainer>
        <div
          className={workspaceAndUserWrapper}
          data-testid="sidebar-workspace-section"
        >
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
         * Tabs-v2 quick actions live directly under the workspace section.
         * When the flag is off, keep the legacy primary nav exactly where it
         * was so rollout can stay reversible.
         */}
        {sidebarTabsV2Enabled ? (
          <TabStrip />
        ) : (
          renderSidebarMenuItems(legacyMenuItems, preferences)
        )}
      </SidebarContainer>
      <SidebarScrollableContainer>
        {sidebarTabsV2Enabled ? (
          // Tabs-v2: body content is owned by the active tab. Home re-uses
          // the workspace menu + section components used pre-flag; Chat /
          // Calendar / Inbox / Search render their related menus inline.
          <TabbedSidebarBody
            onOpenImportModal={onOpenImportModal}
            homeMenuItems={homeMenuItems}
          />
        ) : (
          // Phase 1 utility footer landed via PR #116 — utility items
          // (Trash / Import / Invite / Templates / Learn-more) live in
          // the persistent bottom container below, so the scrollable
          // body is just primary nav sections. Settings moved to the
          // user-avatar dropdown (decision #20, account-menu.tsx).
          renderSidebarMenuItems(sectionMenuItems, preferences)
        )}
      </SidebarScrollableContainer>
      {/*
       * Phase 1 utility footer (Manut decision #11). Demoted from the
       * "Others" CollapsibleSection into the persistent bottom container
       * so primary nav stays scannable. Settings has moved to the user
       * avatar dropdown (decision #20).
       */}
      <SidebarContainer className={bottomContainer}>
        {isCloudWorkspace && tryMenuElements.length > 0 ? (
          <CategoryDivider
            label="Try"
            data-testid="sidebar-try-section-label"
          />
        ) : null}
        {tryMenuElements}
        {renderSidebarMenuItems(utilityMenuItems, preferences)}
        <SidebarAudioPlayer />
      </SidebarContainer>
    </AppSidebar>
  );
});

RootAppSidebar.displayName = 'memo(RootAppSidebar)';
