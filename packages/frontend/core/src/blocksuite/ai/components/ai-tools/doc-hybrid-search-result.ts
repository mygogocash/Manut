import type { PeekViewService } from '@affine/core/modules/peek-view';
import { WithDisposable } from '@blocksuite/global/lit';
import { AttachmentIcon, PageIcon, SearchIcon } from '@blocksuite/icons/lit';
import { ShadowlessElement } from '@blocksuite/std';
import type { Signal } from '@preact/signals-core';
import { html, nothing } from 'lit';
import { property } from 'lit/decorators.js';

import type { ToolResult } from './tool-result-card';
import { getToolErrorDisplayName, isToolError } from './tool-result-utils';
import type { ToolError } from './type';

interface DocHybridSearchToolCall {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  args: { query: string };
}

interface DocHybridSearchSource {
  sourceType: 'doc' | 'file' | 'blob';
  sourceId: string;
  docId?: string;
  title?: string;
  name?: string;
  content?: string;
  snippet?: string;
}

interface DocHybridSearchToolResult {
  type: 'tool-result';
  toolCallId: string;
  toolName: string;
  args: { query: string };
  result: DocHybridSearchSource[] | ToolError | null;
}

function resultTitle(source: DocHybridSearchSource) {
  return source.title || source.name || source.docId || source.sourceId;
}

function resultIcon(source: DocHybridSearchSource) {
  return source.sourceType === 'doc' ? PageIcon() : AttachmentIcon();
}

export class DocHybridSearchResult extends WithDisposable(ShadowlessElement) {
  @property({ attribute: false })
  accessor data!: DocHybridSearchToolCall | DocHybridSearchToolResult;

  @property({ attribute: false })
  accessor width: Signal<number | undefined> | undefined;

  @property({ attribute: false })
  accessor peekViewService!: PeekViewService;

  renderToolCall() {
    return html`<tool-call-card
      .name=${`Searching workspace sources for "${this.data.args.query}"`}
      .icon=${SearchIcon()}
      .width=${this.width}
    ></tool-call-card>`;
  }

  renderToolResult() {
    if (this.data.type !== 'tool-result') {
      return nothing;
    }
    const result = this.data.result;
    if (!result || isToolError(result)) {
      return html`<tool-call-failed
        .name=${getToolErrorDisplayName(
          isToolError(result) ? result : null,
          'Workspace search failed',
          {
            'Workspace Sync Required':
              'Enable workspace sync to search documents',
          }
        )}
        .icon=${SearchIcon()}
      ></tool-call-failed>`;
    }

    const results: ToolResult[] = result.map(source => ({
      title: resultTitle(source),
      icon: resultIcon(source),
      content: source.snippet || source.content,
      onClick: source.docId
        ? () => {
            this.peekViewService.peekView
              .open({
                type: 'doc',
                docRef: { docId: source.docId as string },
              })
              .catch(console.error);
          }
        : undefined,
    }));

    return html`<tool-result-card
      .name=${`Found ${result.length} workspace source${
        result.length === 1 ? '' : 's'
      } for "${this.data.args.query}"`}
      .icon=${SearchIcon()}
      .width=${this.width}
      .results=${results}
    ></tool-result-card>`;
  }

  protected override render() {
    if (this.data.type === 'tool-call') {
      return this.renderToolCall();
    }
    return this.renderToolResult();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'doc-hybrid-search-result': DocHybridSearchResult;
  }
}
