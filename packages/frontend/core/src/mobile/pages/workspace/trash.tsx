import { useThemeColorV2, Wrapper } from '@affine/component';
import { EmptyDocs } from '@affine/core/components/affine/empty';
import {
  createDocExplorerContext,
  DocExplorerContext,
} from '@affine/core/components/explorer/context';
import { DocsExplorer } from '@affine/core/components/explorer/docs-view/docs-list';
import { CollectionRulesService } from '@affine/core/modules/collection-rules';
import { useI18n } from '@affine/i18n';
import { DeleteIcon } from '@blocksuite/icons/rc';
import { useLiveData, useService } from '@toeverything/infra';
import { useEffect, useState } from 'react';

import { Page } from '../../components/page';
import { PageHeader } from '../../components/page-header';
import * as styles from './trash.css';

const TrashDocs = () => {
  const [explorerContextValue] = useState(() =>
    createDocExplorerContext({
      quickFavorite: false,
      showDocIcon: false,
      showMoreOperation: false,
      showDragHandle: false,
      displayProperties: [
        'system:createdAt',
        'system:updatedAt',
        'system:tags',
      ],
      view: 'masonry',
      groupBy: undefined,
      orderBy: undefined,
    })
  );
  const collectionRulesService = useService(CollectionRulesService);
  const groups = useLiveData(explorerContextValue.groups$);
  const isEmpty =
    groups.length === 0 ||
    (groups.length > 0 && groups.every(group => !group.items.length));

  useEffect(() => {
    const subscription = collectionRulesService
      .watch({
        filters: [
          { type: 'system', key: 'trash', method: 'is', value: 'true' },
        ],
        orderBy: {
          type: 'system',
          key: 'updatedAt',
          desc: true,
        },
      })
      .subscribe({
        next: result => {
          explorerContextValue.groups$.next(result.groups);
        },
        error: console.error,
      });
    return () => subscription.unsubscribe();
  }, [collectionRulesService, explorerContextValue.groups$]);

  if (isEmpty) {
    return (
      <>
        <EmptyDocs type="trash" absoluteCenter />
        <Wrapper height={0} flexGrow={1} />
      </>
    );
  }

  return (
    <DocExplorerContext.Provider value={explorerContextValue}>
      <DocsExplorer masonryItemWidthMin={150} />
    </DocExplorerContext.Provider>
  );
};

const TrashHeader = () => {
  const t = useI18n();
  return (
    <PageHeader back prefix={<DeleteIcon className={styles.headerIcon} />}>
      <span className={styles.headerTitle}>
        {t['com.affine.workspaceSubPath.trash']()}
      </span>
    </PageHeader>
  );
};

export const Component = () => {
  useThemeColorV2('layer/background/mobile/primary');

  return (
    <Page header={<TrashHeader />} tab={false}>
      <TrashDocs />
    </Page>
  );
};
