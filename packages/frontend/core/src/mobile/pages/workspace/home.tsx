import {
  SafeArea,
  startScopedViewTransition,
  useThemeColorV2,
} from '@affine/component';
import { usePageHelper } from '@affine/core/blocksuite/block-suite-page-list/utils';
import { useAsyncCallback } from '@affine/core/components/hooks/affine-async-hooks';
import { DocsService } from '@affine/core/modules/doc';
import { TemplateDocService } from '@affine/core/modules/template-doc';
import { WorkbenchService } from '@affine/core/modules/workbench';
import { WorkspaceService } from '@affine/core/modules/workspace';
import track from '@affine/track';
import {
  AiIcon,
  ArrowUpBigIcon,
  CloseIcon,
  EditIcon,
  FilterIcon,
  HistoryIcon,
  InboxIcon,
  PlusIcon,
  SearchIcon,
  TodayIcon,
} from '@blocksuite/icons/rc';
import { useLiveData, useService } from '@toeverything/infra';
import { useCallback, useEffect, useRef, useState } from 'react';

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

const MobileAskAIPanel = ({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) => {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(id);
  }, [open]);

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

        <div className={styles.askAiSheetBody} />

        <div className={styles.askAiComposer}>
          <textarea
            ref={inputRef}
            className={styles.askAiTextarea}
            placeholder="Ask, search, or make anything..."
            rows={2}
          />
          <div className={styles.askAiComposerActions}>
            <button
              className={styles.askAiComposerButton}
              type="button"
              aria-label="Add context"
            >
              <PlusIcon width={24} height={24} />
            </button>
            <button
              className={styles.askAiComposerButton}
              type="button"
              aria-label="AI options"
            >
              <FilterIcon width={24} height={24} />
            </button>
            <button
              className={styles.askAiSendButton}
              type="button"
              aria-label="Send message"
              disabled
            >
              <ArrowUpBigIcon width={20} height={20} />
            </button>
          </div>
        </div>
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
