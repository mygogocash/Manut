import { QuickSearch } from '@affine/core/modules/quicksearch';
import { CMDKQuickSearchService } from '@affine/core/modules/quicksearch/services/cmdk';
import type { QuickSearchGroup } from '@affine/core/modules/quicksearch/types/group';
import type { QuickSearchItem } from '@affine/core/modules/quicksearch/types/item';
import { CMDK } from '@affine/core/modules/quicksearch/views/cmdk';
import { UserFriendlyError } from '@affine/error';
import { useI18n } from '@affine/i18n';
import { useFramework, useLiveData, useService } from '@toeverything/infra';
import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo } from 'react';

import * as styles from './views.css';

type QuickSearchGroups = {
  group?: QuickSearchGroup;
  items: QuickSearchItem[];
}[];

function groupItems(items: QuickSearchItem[]): QuickSearchGroups {
  const groups: QuickSearchGroups = [];

  for (const item of items) {
    const group = item.group;
    const existingGroup = groups.find(g => g.group?.id === group?.id);
    if (existingGroup) {
      existingGroup.items.push(item);
    } else {
      groups.push({ group, items: [item] });
    }
  }

  for (const { items } of groups) {
    items.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  }

  groups.sort((a, b) => {
    const group = (b.group?.score ?? 0) - (a.group?.score ?? 0);
    if (group !== 0) {
      return group;
    }
    return (b.items[0].score ?? 0) - (a.items[0].score ?? 0);
  });

  return groups;
}

function withNewTabIntent(item: QuickSearchItem): QuickSearchItem {
  const payload =
    item.payload && typeof item.payload === 'object'
      ? (item.payload as Record<string, unknown>)
      : {};

  return {
    ...item,
    payload: {
      ...payload,
      __cmdkOpenInNewTab: true,
    },
  };
}

/**
 * Search tab body — an inline, sidebar-scoped CMDK surface. It reuses the
 * default CMDK sessions and result routing, but keeps its own QuickSearch
 * entity so clicking the sidebar Search tab swaps the sidebar body instead of
 * opening the global modal overlay.
 */
export function SearchView(): ReactElement {
  const framework = useFramework();
  const t = useI18n();
  const cMDKQuickSearchService = useService(CMDKQuickSearchService);

  const quickSearch = useMemo(
    () => framework.createEntity(QuickSearch),
    [framework]
  );

  useEffect(() => {
    quickSearch.show(
      cMDKQuickSearchService.createDefaultSessions(),
      () => undefined,
      { defaultQuery: '' }
    );
    return () => quickSearch.hide();
  }, [cMDKQuickSearchService, quickSearch]);

  const query = useLiveData(quickSearch.query$);
  const items = useLiveData(quickSearch.items$);
  const error = useLiveData(quickSearch.error$);
  const loading = useLiveData(quickSearch.isLoading$);
  const loadingProgress = useLiveData(quickSearch.loadingProgress$);

  const groups = useMemo(() => groupItems(items), [items]);

  const handleChangeQuery = useCallback(
    (query: string) => {
      quickSearch.setQuery(query);
    },
    [quickSearch]
  );

  const handleSubmit = useCallback(
    (item: QuickSearchItem, newTab = false) => {
      const result = newTab ? withNewTabIntent(item) : item;
      if (result.beforeSubmit && !result.beforeSubmit()) {
        return;
      }
      cMDKQuickSearchService.handleResult(result);
      quickSearch.setQuery('');
    },
    [cMDKQuickSearchService, quickSearch]
  );

  const safeLoadingProgress =
    typeof loadingProgress === 'number' && Number.isFinite(loadingProgress)
      ? loadingProgress
      : undefined;

  return (
    <div className={styles.searchRoot} data-testid="sidebar-search-view">
      <CMDK
        query={query}
        groups={groups}
        error={error ? UserFriendlyError.fromAny(error).message : null}
        loading={loading}
        loadingProgress={safeLoadingProgress}
        onQueryChange={handleChangeQuery}
        onSubmit={handleSubmit}
        inputLabel="Search"
        placeholder={t['com.affine.cmdk.docs.placeholder']()}
      />
    </div>
  );
}
