import { UserFriendlyError } from '@affine/error';
import { useI18n } from '@affine/i18n';
import { useLiveData, useServices } from '@toeverything/infra';
import { useCallback, useMemo } from 'react';

import { QuickSearchService } from '../services/quick-search';
import type { QuickSearchGroup } from '../types/group';
import type { QuickSearchItem } from '../types/item';
import { CMDK } from './cmdk';
import { QuickSearchModal } from './modal';

export const QuickSearchContainer = () => {
  const { quickSearchService } = useServices({
    QuickSearchService,
  });
  const quickSearch = quickSearchService.quickSearch;
  const open = useLiveData(quickSearch.show$);
  const query = useLiveData(quickSearch.query$);
  const loading = useLiveData(quickSearch.isLoading$);
  const loadingProgress = useLiveData(quickSearch.loadingProgress$);
  const items = useLiveData(quickSearch.items$);
  const error = useLiveData(quickSearch.error$);
  const options = useLiveData(quickSearch.options$);
  const i18n = useI18n();

  const onToggleQuickSearch = useCallback(
    (open: boolean) => {
      if (open) {
        // should never be here
      } else {
        quickSearch.hide();
      }
    },
    [quickSearch]
  );

  const groups = useMemo(() => {
    const groups: { group?: QuickSearchGroup; items: QuickSearchItem[] }[] = [];

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
  }, [items]);

  const handleChangeQuery = useCallback(
    (query: string) => {
      quickSearch.setQuery(query);
    },
    [quickSearch]
  );

  const handleSubmit = useCallback(
    (item: QuickSearchItem, newTab?: boolean) => {
      if (newTab) {
        // Stash the "open in new tab" intent on the item so consumer
        // callbacks (e.g. CMDKQuickSearchService) can read it via the
        // payload without us changing every QuickSearchSession contract.
        // Read fresh state inside the callback per React 19 manual-
        // memoization guidance — we don't want the closure to capture
        // a stale `item`.
        const enriched: QuickSearchItem = {
          ...item,
          payload: {
            ...(item.payload as Record<string, unknown> | undefined),
            __cmdkOpenInNewTab: true,
          },
        };
        quickSearch.submit(enriched);
        return;
      }
      quickSearch.submit(item);
    },
    [quickSearch]
  );

  const enhancedLayout = options?.enhancedLayout === true;

  return (
    <QuickSearchModal
      open={open}
      onOpenChange={onToggleQuickSearch}
      wide={enhancedLayout}
    >
      <CMDK
        query={query}
        groups={groups}
        error={error ? UserFriendlyError.fromAny(error).message : null}
        loading={loading}
        loadingProgress={loadingProgress}
        onQueryChange={handleChangeQuery}
        onSubmit={handleSubmit}
        inputLabel={options?.label && i18n.t(options.label)}
        placeholder={options?.placeholder && i18n.t(options.placeholder)}
        groupBy={enhancedLayout ? 'timestamp' : 'source'}
        enhancedLayout={enhancedLayout}
      />
    </QuickSearchModal>
  );
};
