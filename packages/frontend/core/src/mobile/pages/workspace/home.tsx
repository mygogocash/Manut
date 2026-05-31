import {
  SafeArea,
  startScopedViewTransition,
  useConfirmModal,
  useThemeColorV2,
} from '@affine/component';
import { CopilotClient } from '@affine/core/blocksuite/ai';
import {
  AIChatContent,
  type ChatContextValue,
} from '@affine/core/blocksuite/ai/components/ai-chat-content';
import type { PromptKey } from '@affine/core/blocksuite/ai/provider/prompt';
import { usePageHelper } from '@affine/core/blocksuite/block-suite-page-list/utils';
import { NotificationServiceImpl } from '@affine/core/blocksuite/view-extensions/editor-view/notification-service';
import { useAIChatConfig } from '@affine/core/components/hooks/affine/use-ai-chat-config';
import { useAISpecs } from '@affine/core/components/hooks/affine/use-ai-specs';
import { useAISubscribe } from '@affine/core/components/hooks/affine/use-ai-subscribe';
import { useAsyncCallback } from '@affine/core/components/hooks/affine-async-hooks';
import {
  AIDraftService,
  AIToolsConfigService,
} from '@affine/core/modules/ai-button';
import { AIModelService } from '@affine/core/modules/ai-button/services/models';
import {
  EventSourceService,
  GraphQLService,
  ServerService,
  SubscriptionService,
} from '@affine/core/modules/cloud';
import { WorkspaceDialogService } from '@affine/core/modules/dialogs';
import { DocsService } from '@affine/core/modules/doc';
import { FeatureFlagService } from '@affine/core/modules/feature-flag';
import { PeekViewService } from '@affine/core/modules/peek-view';
import { TemplateDocService } from '@affine/core/modules/template-doc';
import { AppThemeService } from '@affine/core/modules/theme';
import { WorkbenchService } from '@affine/core/modules/workbench';
import { WorkspaceService } from '@affine/core/modules/workspace';
import track from '@affine/track';
import {
  AiIcon,
  CloseIcon,
  EditIcon,
  HistoryIcon,
  InboxIcon,
  PlusIcon,
  SearchIcon,
  TodayIcon,
} from '@blocksuite/icons/rc';
import { useFramework, useLiveData, useService } from '@toeverything/infra';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  NavigationPanelCollections,
  NavigationPanelFavorites,
  NavigationPanelOrganize,
  NavigationPanelTags,
} from '../../components/navigation';
import { searchVTScope } from '../../components/search-input/style.css';
import { HomeHeader, RecentDocs } from '../../views';
import type { MobileHomeMenu } from '../../views/home-header';
import * as styles from './home.css';

type CopilotSession = Awaited<ReturnType<CopilotClient['getSession']>>;

function useMobileCopilotClient() {
  const graphqlService = useService(GraphQLService);
  const eventSourceService = useService(EventSourceService);

  return useMemo(
    () => new CopilotClient(graphqlService.gql, eventSourceService.eventSource),
    [eventSourceService, graphqlService]
  );
}

const MobileAskAIPanel = ({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) => {
  const framework = useFramework();
  const workspaceService = useService(WorkspaceService);
  const workspaceId = workspaceService.workspace.id;
  const workbench = useService(WorkbenchService).workbench;
  const client = useMobileCopilotClient();
  const specs = useAISpecs();
  const handleAISubscribe = useAISubscribe();
  const { docDisplayConfig, reasoningConfig, searchMenuConfig } =
    useAIChatConfig();
  const confirmModal = useConfirmModal();
  const notificationService = useMemo(
    () =>
      new NotificationServiceImpl(
        confirmModal.closeConfirmModal,
        confirmModal.openConfirmModal
      ),
    [confirmModal.closeConfirmModal, confirmModal.openConfirmModal]
  );
  const [chatContent, setChatContent] = useState<AIChatContent | null>(null);
  const [currentSession, setCurrentSession] = useState<CopilotSession | null>(
    null
  );
  const [isBodyProvided, setIsBodyProvided] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);

  const createSession = useCallback(
    async (options: Partial<BlockSuitePresets.AICreateSessionOptions> = {}) => {
      if (currentSession) {
        return currentSession;
      }
      const session = await client.createSessionWithHistory({
        workspaceId,
        promptName: 'Chat With AFFiNE AI' satisfies PromptKey,
        reuseLatestChat: false,
        ...options,
      });
      setCurrentSession(session);
      return session;
    },
    [client, currentSession, workspaceId]
  );

  const onContextChange = useCallback((_context: Partial<ChatContextValue>) => {
    // AIChatContent owns the visible message state. This callback keeps the
    // mobile sheet compatible with the shared chat runtime contract.
  }, []);

  const onOpenDoc = useCallback(
    (docId: string) => {
      workbench.openDoc({ docId, fromTab: 'true' });
      onClose();
    },
    [onClose, workbench]
  );

  const onChatContainerRef = useCallback((node: HTMLDivElement | null) => {
    chatContainerRef.current = node;
    setIsBodyProvided(!!node);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    createSession().catch(console.error);
  }, [open, createSession]);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      chatContainerRef.current
        ?.querySelector<HTMLTextAreaElement>('[data-testid="chat-panel-input"]')
        ?.focus();
    }, 120);
    return () => window.clearTimeout(id);
  }, [chatContent, open]);

  useEffect(() => {
    if (!open || !isBodyProvided || !chatContainerRef.current) return;

    let content = chatContent;
    if (!content) {
      content = new AIChatContent();
    }

    content.session = currentSession;
    content.workspaceId = workspaceId;
    content.extensions = specs;
    content.host = undefined;
    content.docDisplayConfig = docDisplayConfig;
    content.searchMenuConfig = searchMenuConfig;
    content.reasoningConfig = reasoningConfig;
    content.onContextChange = onContextChange;
    content.affineFeatureFlagService = framework.get(FeatureFlagService);
    content.affineWorkspaceDialogService = framework.get(
      WorkspaceDialogService
    );
    content.peekViewService = framework.get(PeekViewService);
    content.affineThemeService = framework.get(AppThemeService);
    content.notificationService = notificationService;
    content.aiDraftService = framework.get(AIDraftService);
    content.aiToolsConfigService = framework.get(AIToolsConfigService);
    content.serverService = framework.get(ServerService);
    content.subscriptionService = framework.get(SubscriptionService);
    content.aiModelService = framework.get(AIModelService);
    content.onAISubscribe = handleAISubscribe;
    content.createSession = createSession;
    content.onOpenDoc = onOpenDoc;

    if (!chatContent) {
      content.independentMode = true;
      content.onboardingOffsetY = 0;
      setChatContent(content);
    }

    const contentElement = content as unknown as HTMLElement;
    if (contentElement.parentElement !== chatContainerRef.current) {
      chatContainerRef.current.append(contentElement);
    }
  }, [
    chatContent,
    createSession,
    currentSession,
    docDisplayConfig,
    framework,
    handleAISubscribe,
    isBodyProvided,
    notificationService,
    onContextChange,
    onOpenDoc,
    open,
    reasoningConfig,
    searchMenuConfig,
    specs,
    workspaceId,
  ]);

  useEffect(() => {
    return () => {
      (chatContent as unknown as HTMLElement | null)?.remove();
    };
  }, [chatContent]);

  if (!open) return null;

  return (
    <div className={styles.askAiOverlay} role="presentation" onClick={onClose}>
      <section
        className={styles.askAiSheet}
        role="dialog"
        aria-label="Manut AI chat"
        data-testid="mobile-ask-ai-panel"
        onClick={event => event.stopPropagation()}
      >
        <div className={styles.askAiSheetHeader}>
          <button
            className={styles.askAiSheetIconButton}
            type="button"
            aria-label="Open AI history"
          >
            <HistoryIcon width={24} height={24} />
          </button>
          <div className={styles.askAiSheetIdentity}>
            <span className={styles.askAiSheetAvatar}>
              <AiIcon width={32} height={32} />
            </span>
            <span className={styles.askAiSheetTitle}>Manut AI</span>
          </div>
          <button
            className={styles.askAiSheetIconButton}
            type="button"
            aria-label="Close Manut AI"
            onClick={onClose}
          >
            <CloseIcon width={24} height={24} />
          </button>
        </div>

        <div className={styles.askAiSheetBody} ref={onChatContainerRef} />
      </section>
    </div>
  );
};

const useCreatePage = () => {
  const workbench = useService(WorkbenchService).workbench;
  const workspaceService = useService(WorkspaceService);
  const templateDocService = useService(TemplateDocService);
  const docsService = useService(DocsService);

  const currentWorkspace = workspaceService.workspace;
  const pageHelper = usePageHelper(currentWorkspace.docCollection);
  const enablePageTemplate = useLiveData(
    templateDocService.setting.enablePageTemplate$
  );
  const pageTemplateDocId = useLiveData(
    templateDocService.setting.pageTemplateDocId$
  );

  return useAsyncCallback(async () => {
    if (enablePageTemplate && pageTemplateDocId) {
      const docId = await docsService.duplicateFromTemplate(pageTemplateDocId);
      workbench.openDoc({ docId, fromTab: 'true' });
    } else {
      const doc = pageHelper.createPage(undefined, { show: false });
      workbench.openDoc({ docId: doc.id, fromTab: 'true' });
    }
    track.$.navigationPanel.$.createDoc();
  }, [
    docsService,
    enablePageTemplate,
    pageHelper,
    pageTemplateDocId,
    workbench,
  ]);
};

const HomeActionDock = ({
  onAskAI,
  onCreatePage,
}: {
  onAskAI: () => void;
  onCreatePage: () => void;
}) => {
  const workbench = useService(WorkbenchService).workbench;

  const openSearch = useCallback(() => {
    startScopedViewTransition(searchVTScope, () => {
      workbench.open('/search');
    });
  }, [workbench]);

  return (
    <SafeArea bottom bottomOffset={12} className={styles.dockSafeArea}>
      <div className={styles.dock}>
        <button
          className={styles.dockCircle}
          type="button"
          aria-label="Open search"
          onClick={openSearch}
        >
          <SearchIcon width={26} height={26} />
        </button>
        <button
          className={styles.askAiButton}
          type="button"
          aria-label="Ask AI"
          onClick={onAskAI}
        >
          <span className={styles.askAiIcon}>
            <AiIcon width={22} height={22} />
          </span>
          Ask AI
        </button>
        <button
          className={styles.dockCircle}
          type="button"
          aria-label="Create a new doc"
          onClick={onCreatePage}
        >
          <EditIcon width={26} height={26} />
        </button>
      </div>
    </SafeArea>
  );
};

const HomeSurface = () => {
  return (
    <div
      key="home"
      className={styles.surface}
      data-menu="home"
      data-testid="mobile-home-surface-home"
    >
      <RecentDocs />
      <SafeArea bottom>
        <div className={styles.sections}>
          <NavigationPanelFavorites />
          <NavigationPanelOrganize />
          <NavigationPanelCollections />
          <NavigationPanelTags />
        </div>
      </SafeArea>
    </div>
  );
};

const ChatsSurface = ({ onStartChat }: { onStartChat: () => void }) => {
  return (
    <div
      key="chats"
      className={styles.surface}
      data-menu="chats"
      data-testid="mobile-home-surface-chats"
    >
      <div className={styles.emptySurface}>
        <span className={styles.emptySurfaceIcon}>
          <AiIcon />
        </span>
        <h2 className={styles.emptySurfaceTitle}>No chats yet</h2>
        <p className={styles.emptySurfaceCopy}>
          Search across your workspace, create docs, and more with Manut AI.
        </p>
        <button
          type="button"
          className={styles.emptySurfaceAction}
          onClick={onStartChat}
        >
          Start new chat
        </button>
      </div>
    </div>
  );
};

const MeetingsSurface = ({
  onCreateMeetingNote,
}: {
  onCreateMeetingNote: () => void;
}) => {
  return (
    <div
      key="meetings"
      className={styles.surface}
      data-menu="meetings"
      data-testid="mobile-home-surface-meetings"
    >
      <div className={styles.menuSection}>
        <section className={styles.menuGroup}>
          <div className={styles.menuGroupTitle}>Today</div>
          <button
            type="button"
            className={styles.menuRow}
            onClick={onCreateMeetingNote}
          >
            <span className={styles.menuRowIcon}>
              <PlusIcon />
            </span>
            New meeting note
          </button>
        </section>
        <section className={styles.menuGroup}>
          <div className={styles.menuGroupTitle}>This week</div>
          <div className={styles.menuRow}>
            <span className={styles.menuRowIcon}>
              <TodayIcon />
            </span>
            Meeting notes will appear here
          </div>
        </section>
      </div>
    </div>
  );
};

const InboxSurface = () => {
  return (
    <div
      key="inbox"
      className={styles.surface}
      data-menu="inbox"
      data-testid="mobile-home-surface-inbox"
    >
      <div className={styles.emptySurface}>
        <span className={styles.emptySurfaceIcon}>
          <InboxIcon />
        </span>
        <h2 className={styles.emptySurfaceTitle}>Inbox zero</h2>
        <p className={styles.emptySurfaceCopy}>
          Mentions, invitations, and workspace updates will show up here.
        </p>
      </div>
    </div>
  );
};

const MobileHomeSurface = ({
  activeMenu,
  onCreatePage,
  onStartChat,
}: {
  activeMenu: MobileHomeMenu;
  onCreatePage: () => void;
  onStartChat: () => void;
}) => {
  switch (activeMenu) {
    case 'chats':
      return <ChatsSurface onStartChat={onStartChat} />;
    case 'meetings':
      return <MeetingsSurface onCreateMeetingNote={onCreatePage} />;
    case 'inbox':
      return <InboxSurface />;
    case 'home':
    default:
      return <HomeSurface />;
  }
};

export const Component = () => {
  useThemeColorV2('layer/background/mobile/primary');
  const [activeMenu, setActiveMenu] = useState<MobileHomeMenu>('home');
  const [askAiOpen, setAskAiOpen] = useState(false);
  const createPage = useCreatePage();
  const openAskAI = useCallback(() => setAskAiOpen(true), []);

  return (
    <main className={styles.page}>
      <HomeHeader activeMenu={activeMenu} onMenuChange={setActiveMenu} />
      <MobileHomeSurface
        activeMenu={activeMenu}
        onCreatePage={createPage}
        onStartChat={openAskAI}
      />
      <HomeActionDock onAskAI={openAskAI} onCreatePage={createPage} />
      <MobileAskAIPanel open={askAiOpen} onClose={() => setAskAiOpen(false)} />
    </main>
  );
};
