// packages/frontend/core/src/blocksuite/ai/hooks/useChatPanelConfig.ts
import { AIPlaygroundService } from '@affine/core/modules/ai-button/services/playground';
import { AIReasoningService } from '@affine/core/modules/ai-button/services/reasoning';
import { CollectionService } from '@affine/core/modules/collection';
import { DocsService } from '@affine/core/modules/doc';
import { DocDisplayMetaService } from '@affine/core/modules/doc-display-meta';
import { DocsSearchService } from '@affine/core/modules/docs-search';
import { MemberSearchService } from '@affine/core/modules/permissions';
import {
  type SearchCollectionMenuAction,
  type SearchDocMenuAction,
  SearchMenuService,
  type SearchTagMenuAction,
} from '@affine/core/modules/search-menu/services';
import { TagService } from '@affine/core/modules/tag';
import { WorkspaceService } from '@affine/core/modules/workspace';
import { createSignalFromObservable } from '@blocksuite/affine/shared/utils';
import { MemberIcon } from '@blocksuite/icons/lit';
import { signal } from '@preact/signals-core';
import { useFramework } from '@toeverything/infra';
import { html } from 'lit';

import type {
  MentionMember,
  SearchMemberMenuAction,
} from '../../../blocksuite/ai/components/ai-chat-add-context/type';

export function useAIChatConfig() {
  const framework = useFramework();

  const reasoningService = framework.get(AIReasoningService);
  const playgroundService = framework.get(AIPlaygroundService);
  const docDisplayMetaService = framework.get(DocDisplayMetaService);
  const workspaceService = framework.get(WorkspaceService);
  const searchMenuService = framework.get(SearchMenuService);
  const docsSearchService = framework.get(DocsSearchService);
  const tagService = framework.get(TagService);
  const collectionService = framework.get(CollectionService);
  const docsService = framework.get(DocsService);
  const memberSearchService = framework.get(MemberSearchService);

  const reasoningConfig = {
    enabled: reasoningService.enabled,
    setEnabled: reasoningService.setEnabled,
  };

  const playgroundConfig = {
    visible: playgroundService.visible,
  };

  const docDisplayConfig = {
    getIcon: (docId: string) => {
      return docDisplayMetaService.icon$(docId, { type: 'lit' }).value;
    },
    getTitle: (docId: string) => {
      return docDisplayMetaService.title$(docId).value;
    },
    getTitleSignal: (docId: string) => {
      const title$ = docDisplayMetaService.title$(docId);
      return createSignalFromObservable(title$, '');
    },
    getDocMeta: (docId: string) => {
      const docRecord = docsService.list.doc$(docId).value;
      return docRecord?.meta$.value ?? null;
    },
    getDocPrimaryMode: (docId: string) => {
      const docRecord = docsService.list.doc$(docId).value;
      return docRecord?.primaryMode$.value ?? 'page';
    },
    getDoc: (docId: string) => {
      const doc = workspaceService.workspace.docCollection.getDoc(docId);
      return doc?.getStore() ?? null;
    },
    getReferenceDocs: (docIds: string[]) => {
      const docs$ = docsSearchService.watchRefsFrom(docIds);
      return createSignalFromObservable(docs$, []);
    },
    getTags: () => {
      const tagMetas$ = tagService.tagList.tagMetas$;
      return createSignalFromObservable(tagMetas$, []);
    },
    getTagTitle: (tagId: string) => {
      const tag$ = tagService.tagList.tagByTagId$(tagId);
      return tag$.value?.value$.value ?? '';
    },
    getTagPageIds: (tagId: string) => {
      const tag$ = tagService.tagList.tagByTagId$(tagId);
      if (!tag$) return [];
      return tag$.value?.pageIds$.value ?? [];
    },
    getCollections: () => {
      const collectionMetas$ = collectionService.collectionMetas$;
      return createSignalFromObservable(collectionMetas$, []);
    },
    getCollectionPageIds: (collectionId: string) => {
      const collection$ = collectionService.collection$(collectionId);
      // TODO: lack of documents that meet the collection rules
      return collection$?.value?.info$.value.allowList ?? [];
    },
  };

  const searchMenuConfig = {
    getDocMenuGroup: (
      query: string,
      action: SearchDocMenuAction,
      abortSignal: AbortSignal
    ) => {
      return searchMenuService.getDocMenuGroup(query, action, abortSignal);
    },
    getTagMenuGroup: (
      query: string,
      action: SearchTagMenuAction,
      abortSignal: AbortSignal
    ) => {
      return searchMenuService.getTagMenuGroup(query, action, abortSignal);
    },
    getCollectionMenuGroup: (
      query: string,
      action: SearchCollectionMenuAction,
      abortSignal: AbortSignal
    ) => {
      return searchMenuService.getCollectionMenuGroup(
        query,
        action,
        abortSignal
      );
    },
    getMemberMenuGroup: (
      query: string,
      action: SearchMemberMenuAction,
      abortSignal: AbortSignal
    ) => {
      const itemsSignal = signal<
        Array<{
          key: string;
          name: ReturnType<typeof html> | string;
          icon: ReturnType<typeof html>;
          action: () => Promise<void> | void;
        }>
      >([]);
      const loadingSignal = signal(true);

      const sub = memberSearchService.result$.subscribe(members => {
        loadingSignal.value = memberSearchService.isLoading$.value;
        itemsSignal.value = members.map(m => {
          const member: MentionMember = {
            id: m.id,
            name: m.name ?? m.email ?? 'Unknown',
            email: m.email,
            avatarUrl: m.avatarUrl,
          };
          return {
            key: m.id,
            name: member.name,
            icon: MemberIcon(),
            action: async () => {
              await action(member);
            },
          };
        });
      });

      const loadingSub = memberSearchService.isLoading$.subscribe(loading => {
        loadingSignal.value = loading;
      });

      memberSearchService.search(query);

      abortSignal.addEventListener('abort', () => {
        sub.unsubscribe();
        loadingSub.unsubscribe();
      });

      return {
        name: 'People',
        items: itemsSignal,
        loading: loadingSignal,
        maxDisplay: 5,
      };
    },
  };

  return {
    reasoningConfig,
    docDisplayConfig,
    searchMenuConfig,
    playgroundConfig,
  };
}
