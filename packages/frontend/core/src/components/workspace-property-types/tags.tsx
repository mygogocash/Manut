import { type MenuRef, notify, PropertyValue } from '@affine/component';
import { EventSourceService, GraphQLService } from '@affine/core/modules/cloud';
import type { FilterParams } from '@affine/core/modules/collection-rules';
import { type DocRecord, DocService } from '@affine/core/modules/doc';
import { type Tag, TagService } from '@affine/core/modules/tag';
import { WorkspaceService } from '@affine/core/modules/workspace';
import { useI18n } from '@affine/i18n';
import { TagsIcon } from '@blocksuite/icons/rc';
import { useLiveData, useService } from '@toeverything/infra';
import { cssVarV2 } from '@toeverything/theme/v2';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { CopilotClient } from '../../blocksuite/ai/provider/copilot-client';
import { textToText } from '../../blocksuite/ai/provider/request';
import { looksLikeSseFragment, parseTagCandidates } from '../auto-tag/parse';
import { PlainTextDocGroupHeader } from '../explorer/docs-view/group-header';
import { StackProperty } from '../explorer/docs-view/stack-property';
import type { GroupHeaderProps } from '../explorer/types';
import { useNavigateHelper } from '../hooks/use-navigate-helper';
import type { PropertyValueProps } from '../properties/types';
import {
  WorkspaceTagsInlineEditor as TagsInlineEditorComponent,
  WorkspaceTagsInlineEditor,
} from '../tags';
import * as styles from './tags.css';

// SSE-stream parser trap — see CLAUDE.md §6c.
// `parseTagCandidates` + `looksLikeSseFragment` now live in
// `../auto-tag/parse` so both this manual button path and the new
// auto-on-save flow share the same defense (and the same unit tests).

// Friendly preview list capped at 3 names + "and N more" overflow tail.
function formatTagListForDisplay(names: string[]): string {
  const max = 3;
  if (names.length <= max) return names.join(', ');
  const head = names.slice(0, max).join(', ');
  return `${head} and ${names.length - max} more`;
}

export const TagsValue = ({ readonly }: PropertyValueProps) => {
  const t = useI18n();

  const doc = useService(DocService).doc;

  const tagList = useService(TagService).tagList;
  const tagIds = useLiveData(tagList.tagIdsByPageId$(doc.id));
  const empty = !tagIds || tagIds.length === 0;

  return (
    <PropertyValue
      className={styles.container}
      isEmpty={empty}
      data-testid="property-tags-value"
      readonly={readonly}
    >
      <TagsInlineEditor
        className={styles.tagInlineEditor}
        placeholder={t[
          'com.affine.page-properties.property-value-placeholder'
        ]()}
        pageId={doc.id}
        onChange={() => {}}
        readonly={readonly}
      />
    </PropertyValue>
  );
};

export const TagsFilterValue = ({
  filter,
  isDraft,
  onDraftCompleted,
  onChange,
}: {
  filter: FilterParams;
  isDraft?: boolean;
  onDraftCompleted?: () => void;
  onChange: (filter: FilterParams) => void;
}) => {
  const t = useI18n();
  const tagService = useService(TagService);
  const allTagMetas = useLiveData(tagService.tagList.tagMetas$);
  const menuRef = useRef<MenuRef>(null);

  useEffect(() => {
    if (isDraft) {
      menuRef.current?.changeOpen(true);
    }
  }, [isDraft]);

  const selectedTags = useMemo(
    () =>
      filter.value
        ?.split(',')
        .filter(id => allTagMetas.some(tag => tag.id === id)) ?? [],
    [filter, allTagMetas]
  );

  const handleSelectTag = useCallback(
    (tagId: string) => {
      onChange({
        ...filter,
        value: [...selectedTags, tagId].join(','),
      });
    },
    [filter, onChange, selectedTags]
  );

  const handleDeselectTag = useCallback(
    (tagId: string) => {
      onChange({
        ...filter,
        value: selectedTags.filter(id => id !== tagId).join(','),
      });
    },
    [filter, onChange, selectedTags]
  );

  useEffect(() => {
    if (
      isDraft &&
      (filter.method === 'is-not-empty' || filter.method === 'is-empty')
    ) {
      onDraftCompleted?.();
    }
  }, [isDraft, filter.method, onDraftCompleted]);

  return filter.method !== 'is-not-empty' && filter.method !== 'is-empty' ? (
    <WorkspaceTagsInlineEditor
      placeholder={
        <span style={{ color: cssVarV2('text/placeholder') }}>
          {t['com.affine.filter.empty']()}
        </span>
      }
      selectedTags={selectedTags}
      onSelectTag={handleSelectTag}
      onDeselectTag={handleDeselectTag}
      menuClassName={styles.filterValueMenu}
      tagMode="inline-tag"
      ref={menuRef}
      onEditorClose={onDraftCompleted}
    />
  ) : undefined;
};

const TagsInlineEditor = ({
  pageId,
  readonly,
  placeholder,
  className,
  onChange,
}: {
  placeholder?: string;
  className?: string;
  onChange?: (value: unknown) => void;
  pageId: string;
  readonly?: boolean;
  focusedIndex?: number;
}) => {
  const workspace = useService(WorkspaceService);
  const tagService = useService(TagService);
  const docService = useService(DocService);
  const graphqlService = useService(GraphQLService);
  const eventSourceService = useService(EventSourceService);
  const tagIds$ = tagService.tagList.tagIdsByPageId$(pageId);
  const tagIds = useLiveData(tagIds$);

  const onSelectTag = useCallback(
    (tagId: string) => {
      tagService.tagList.tagByTagId$(tagId).value?.tag(pageId);
      onChange?.(tagIds$.value);
    },
    [onChange, pageId, tagIds$, tagService.tagList]
  );

  const onDeselectTag = useCallback(
    (tagId: string) => {
      tagService.tagList.tagByTagId$(tagId).value?.untag(pageId);
      onChange?.(tagIds$.value);
    },
    [onChange, pageId, tagIds$, tagService.tagList]
  );

  // AI Auto Tag — asks copilot for 3-7 tag suggestions based on the doc's
  // title and body content (and the existing tag list, so it can reuse
  // what's there). The response is a JSON array; for each name we either
  // reuse an existing tag or create a new one.
  //
  // SSE-stream parser trap: the copilot stream-object endpoint emits
  // {"type":"text-delta","textDelta":"..."} JSON chunks per SSE event.
  // textToText({stream: false}) joins those into a single text string,
  // but if a chunk slips through unparsed (or the model interleaves
  // commentary with the array), the candidate text can still contain
  // SSE wrappers. parseTagCandidates below defensively rejects any
  // candidate that smells like an SSE chunk fragment.
  const tagColorsList = tagService.tagColors;
  const onAutoTag = useCallback(async () => {
    const doc = docService.doc;
    if (!doc || doc.id !== pageId) {
      throw new Error('Doc not loaded');
    }
    const title = doc.title$.value || 'Untitled';
    const allTagMetas = tagService.tagList.tagMetas$.value;
    const existingTags = allTagMetas.map(t => t.name).filter(Boolean);

    // Extract markdown body for richer context. Fall back to title-only
    // if the BlockSuite store/adapter is unavailable for any reason —
    // we never want a missing-content path to break Auto Tag.
    let bodyMarkdown = '';
    try {
      const store = doc.blockSuiteDoc.getStore();
      if (store) {
        const transformer = store.getTransformer();
        const { MarkdownAdapter } =
          await import('@blocksuite/affine/shared/adapters');
        const adapter = new MarkdownAdapter(transformer, store.provider);
        const extracted = await adapter.fromDoc(store);
        bodyMarkdown = extracted?.file ?? '';
      }
    } catch (err) {
      console.warn(
        'Auto Tag: markdown extraction failed, falling back to title only',
        err
      );
    }
    // Cap at 3000 chars to keep the prompt under a reasonable token budget.
    const content = (bodyMarkdown || title).slice(0, 3000);

    // Show a loading toast while the AI generates tags. Dismiss before
    // showing the result toast so the user sees a clean transition.
    const loadingToastId = notify({
      title: 'AI Auto Tag',
      message: 'Generating tags…',
    });

    try {
      const client = new CopilotClient(
        graphqlService.gql,
        eventSourceService.eventSource
      );
      const sessionId = await client.createSession({
        workspaceId: workspace.workspace.id,
        docId: pageId,
        promptName: 'Auto Tag',
      });
      if (!sessionId) {
        throw new Error('Failed to create copilot session');
      }

      const result = await textToText({
        client,
        sessionId,
        content: 'Generate tags now.',
        params: {
          title,
          content,
          existingTags: existingTags.length
            ? existingTags.join(', ')
            : '(none)',
        },
        stream: false,
      });

      const text = typeof result === 'string' ? result : '';
      if (!text) {
        throw new Error('Empty AI response');
      }

      const suggested = parseTagCandidates(text);
      const cleaned = Array.from(
        new Set(
          suggested
            .map(s => String(s).trim().toLowerCase())
            .filter(s => s.length >= 2 && s.length <= 40)
            .filter(s => !looksLikeSseFragment(s))
        )
      ).slice(0, 7);

      notify.dismiss(loadingToastId);

      if (cleaned.length === 0) {
        notify.warning({
          title: 'AI Auto Tag',
          message: 'No new tags suggested — your doc is already well-tagged.',
        });
        return;
      }

      const createdNames: string[] = [];
      const appliedNames: string[] = [];
      const alreadyOnDoc: string[] = [];
      for (const name of cleaned) {
        const existing = allTagMetas.find(t => t.name.toLowerCase() === name);
        if (existing) {
          if (tagIds$.value.includes(existing.id)) {
            alreadyOnDoc.push(existing.name);
            continue;
          }
          const tagInstance = tagService.tagList.tagByTagId$(existing.id).value;
          if (tagInstance) {
            tagInstance.tag(pageId);
            appliedNames.push(existing.name);
          }
        } else {
          // Defensive index access — tagColorsList items are [name, value]
          // tuples; if upstream changes the shape, fall back to the first
          // entry's value rather than crashing the whole auto-tag run.
          const tuple =
            tagColorsList[Math.floor(Math.random() * tagColorsList.length)] ??
            tagColorsList[0];
          const color = tuple?.[1] ?? '#888';
          const newTag = tagService.tagList.createTag(name, color);
          newTag.tag(pageId);
          createdNames.push(name);
          appliedNames.push(name);
        }
      }

      if (appliedNames.length === 0 && alreadyOnDoc.length === 0) {
        notify.warning({
          title: 'AI Auto Tag',
          message: 'No new tags suggested — your doc is already well-tagged.',
        });
        return;
      }

      // Build a friendly toast showing actual tag names. Cap display at
      // first 3 names + "and N more" so the toast stays scannable.
      const namesPreview = formatTagListForDisplay(appliedNames);
      const parts: string[] = [];
      if (appliedNames.length > 0) {
        const noun = appliedNames.length === 1 ? 'tag' : 'tags';
        const newSuffix =
          createdNames.length > 0 ? ` (${createdNames.length} new)` : '';
        parts.push(
          `Added ${appliedNames.length} ${noun}: ${namesPreview}${newSuffix}`
        );
      }
      if (alreadyOnDoc.length > 0) {
        parts.push(`(${alreadyOnDoc.length} already on doc)`);
      }
      notify.success({
        title: 'AI Auto Tag',
        message: parts.join(' '),
      });
      onChange?.(tagIds$.value);
    } catch (err) {
      notify.dismiss(loadingToastId);
      console.error('AI Auto Tag failed', err);
      notify.error({
        title: 'AI Auto Tag',
        message: "Couldn't generate tags right now. Try again.",
      });
    }
  }, [
    docService,
    pageId,
    tagService,
    graphqlService,
    eventSourceService,
    workspace.workspace.id,
    tagColorsList,
    tagIds$,
    onChange,
  ]);

  const navigator = useNavigateHelper();

  const jumpToTag = useCallback(
    (id: string) => {
      navigator.jumpToTag(workspace.workspace.id, id);
    },
    [navigator, workspace.workspace.id]
  );

  const t = useI18n();

  return (
    <TagsInlineEditorComponent
      tagMode="inline-tag"
      jumpToTag={jumpToTag}
      readonly={readonly}
      placeholder={placeholder}
      className={className}
      selectedTags={tagIds}
      onSelectTag={onSelectTag}
      onDeselectTag={onDeselectTag}
      onAutoTag={readonly ? undefined : onAutoTag}
      title={
        <>
          <TagsIcon />
          {t['Tags']()}
        </>
      }
    />
  );
};

const TagName = ({ tag }: { tag: Tag }) => {
  const name = useLiveData(tag.value$);
  return name;
};
const TagIcon = ({ tag, size = 8 }: { tag: Tag; size?: number }) => {
  const color = useLiveData(tag.color$);
  return (
    <div
      style={{
        backgroundColor: color,
        width: size,
        height: size,
        borderRadius: '50%',
      }}
    />
  );
};

export const TagsDocListProperty = ({ doc }: { doc: DocRecord }) => {
  const max = 3;
  const t = useI18n();
  const tagList = useService(TagService).tagList;
  const tags = useLiveData(tagList.tagsByPageId$(doc.id));

  const showRest = tags.length > max + 1;
  const visibleTags = tags.length === max + 1 ? max + 1 : max;

  return (
    <>
      {tags.slice(0, visibleTags).map(tag => {
        return (
          <StackProperty icon={<TagIcon tag={tag} />} key={tag.id}>
            <TagName tag={tag} />
          </StackProperty>
        );
      })}
      {showRest ? (
        <StackProperty icon={null}>
          <span>+{tags.length - max}</span>
          <span className={styles.moreTagsLabel}>{t['Tags']()}</span>
        </StackProperty>
      ) : null}
    </>
  );
};

export const TagsGroupHeader = ({ groupId, docCount }: GroupHeaderProps) => {
  const t = useI18n();
  const tagService = useService(TagService);
  const tag = useLiveData(tagService.tagList.tagByTagId$(groupId));

  if (!tag) {
    return (
      <PlainTextDocGroupHeader
        groupId={groupId}
        docCount={docCount}
        icon={
          <div
            style={{
              backgroundColor: cssVarV2.icon.secondary,
              width: 8,
              height: 8,
              borderRadius: '50%',
            }}
          />
        }
      >
        {t['com.affine.page.display.grouping.group-by-tag.untagged']()}
      </PlainTextDocGroupHeader>
    );
  }
  return (
    <PlainTextDocGroupHeader
      groupId={groupId}
      docCount={docCount}
      icon={<TagIcon tag={tag} />}
    >
      <TagName tag={tag} />
    </PlainTextDocGroupHeader>
  );
};
