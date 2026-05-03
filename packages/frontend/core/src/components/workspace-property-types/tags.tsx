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
  // title (and the existing tag list, so it can reuse what's there).
  // The response is a JSON array; for each name we either reuse an
  // existing tag or create a new one.
  const tagColorsList = tagService.tagColors;
  const onAutoTag = useCallback(async () => {
    const doc = docService.doc;
    if (!doc || doc.id !== pageId) {
      throw new Error('Doc not loaded');
    }
    const title = doc.title$.value || 'Untitled';
    const allTagMetas = tagService.tagList.tagMetas$.value;
    const existingTags = allTagMetas.map(t => t.name).filter(Boolean);

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
        content: title,
        existingTags: existingTags.length ? existingTags.join(', ') : '(none)',
      },
      stream: false,
    });

    const text = typeof result === 'string' ? result : '';
    if (!text) {
      throw new Error('Empty AI response');
    }

    // Be liberal: pull the first JSON array literal out of the text.
    const match = /\[\s*"[\s\S]*?"\s*\]/.exec(text);
    let suggested: string[] = [];
    try {
      suggested = JSON.parse(match ? match[0] : text);
    } catch {
      suggested = text
        .split(/\r?\n|,/)
        .map(s => s.replace(/^[\s\-*•"]+|[\s"]+$/g, ''))
        .filter(Boolean);
    }
    if (!Array.isArray(suggested)) {
      throw new Error('AI returned non-array');
    }

    const cleaned = Array.from(
      new Set(
        suggested
          .map(s => String(s).trim().toLowerCase())
          .filter(s => s.length > 0 && s.length <= 40)
      )
    ).slice(0, 7);

    if (cleaned.length === 0) {
      notify.warning({
        title: 'AI Auto Tag',
        message: 'No tags suggested for this document.',
      });
      return;
    }

    let createdCount = 0;
    let appliedCount = 0;
    for (const name of cleaned) {
      const existing = allTagMetas.find(
        t => t.name.toLowerCase() === name
      );
      if (existing) {
        const tagInstance = tagService.tagList.tagByTagId$(existing.id).value;
        if (tagInstance && !tagIds$.value.includes(existing.id)) {
          tagInstance.tag(pageId);
          appliedCount++;
        }
      } else {
        const color =
          tagColorsList[Math.floor(Math.random() * tagColorsList.length)][1];
        const newTag = tagService.tagList.createTag(name, color);
        newTag.tag(pageId);
        createdCount++;
        appliedCount++;
      }
    }

    notify.success({
      title: 'AI Auto Tag',
      message:
        createdCount > 0
          ? `Applied ${appliedCount} tag${appliedCount === 1 ? '' : 's'} (${createdCount} new).`
          : `Applied ${appliedCount} tag${appliedCount === 1 ? '' : 's'}.`,
    });
    onChange?.(tagIds$.value);
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
