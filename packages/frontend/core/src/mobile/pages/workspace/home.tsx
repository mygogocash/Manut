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
import { AiIcon, EditIcon, SearchIcon } from '@blocksuite/icons/rc';
import { useLiveData, useService } from '@toeverything/infra';
import { useCallback } from 'react';

import {
  NavigationPanelCollections,
  NavigationPanelFavorites,
  NavigationPanelOrganize,
  NavigationPanelTags,
} from '../../components/navigation';
import { searchVTScope } from '../../components/search-input/style.css';
import { HomeHeader, RecentDocs } from '../../views';
import * as styles from './home.css';

const HomeActionDock = () => {
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

  const openSearch = useCallback(() => {
    startScopedViewTransition(searchVTScope, () => {
      workbench.open('/search');
    });
  }, [workbench]);

  const createPage = useAsyncCallback(async () => {
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
          onClick={openSearch}
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
          onClick={createPage}
        >
          <EditIcon width={26} height={26} />
        </button>
      </div>
    </SafeArea>
  );
};

export const Component = () => {
  useThemeColorV2('layer/background/mobile/primary');

  return (
    <main className={styles.page}>
      <HomeHeader />
      <RecentDocs />
      <SafeArea bottom>
        <div className={styles.sections}>
          <NavigationPanelFavorites />
          <NavigationPanelOrganize />
          <NavigationPanelCollections />
          <NavigationPanelTags />
        </div>
      </SafeArea>
      <HomeActionDock />
    </main>
  );
};
