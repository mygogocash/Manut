import type { FeatureFlagService } from '@affine/core/modules/feature-flag';
import type { PeekViewService } from '@affine/core/modules/peek-view';
import { WithDisposable } from '@blocksuite/affine/global/lit';
import type { ColorScheme } from '@blocksuite/affine/model';
import {
  type BlockStdScope,
  type EditorHost,
  ShadowlessElement,
} from '@blocksuite/affine/std';
import type { ExtensionType } from '@blocksuite/affine/store';
import type { NotificationService } from '@blocksuite/affine-shared/services';
import type { Signal } from '@preact/signals-core';
import { css, html, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';

import type { AffineAIPanelState } from '../../widgets/ai-panel/type';
import type { DocDisplayConfig } from '../ai-chat-chips';
import type { StreamObject } from '../ai-chat-messages';

export class ChatContentStreamObjects extends WithDisposable(
  ShadowlessElement
) {
  static override styles = css`
    /* ChatGPT/Claude-style "Thinking" card.
       - Subtle, contained, slightly muted.
       - While streaming: animated gradient sheen on the header.
       - When finished: collapsed by default; click header to expand.
       The container groups multiple consecutive 'reasoning' deltas so the
       user sees ONE coherent thinking block per message, not a stack of
       separate cards. */
    .ai-thinking-card {
      margin: 8px 0;
      border: 1px solid var(--affine-border-color, rgba(0, 0, 0, 0.08));
      border-radius: 8px;
      background-color: var(
        --affine-background-secondary-color,
        rgba(0, 0, 0, 0.02)
      );
      overflow: hidden;
      transition: background-color 0.2s ease;
    }
    .ai-thinking-card[data-streaming='true'] {
      background: linear-gradient(
        90deg,
        rgba(120, 120, 200, 0.04) 0%,
        rgba(120, 120, 200, 0.1) 50%,
        rgba(120, 120, 200, 0.04) 100%
      );
      background-size: 200% 100%;
      animation: ai-thinking-pulse 2.4s linear infinite;
    }
    @keyframes ai-thinking-pulse {
      0% {
        background-position: 200% 0;
      }
      100% {
        background-position: -200% 0;
      }
    }
    .ai-thinking-header {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      cursor: pointer;
      user-select: none;
      font-size: 12px;
      font-weight: 500;
      color: var(--affine-text-secondary-color);
    }
    .ai-thinking-header[data-disabled='true'] {
      cursor: default;
    }
    .ai-thinking-chevron {
      width: 12px;
      height: 12px;
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.18s ease;
    }
    .ai-thinking-card[data-expanded='true'] .ai-thinking-chevron {
      transform: rotate(90deg);
    }
    .ai-thinking-label {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .ai-thinking-body {
      padding: 0 14px 12px 28px;
      font-style: italic;
      color: var(--affine-text-secondary-color);
      font-size: 13px;
      line-height: 1.55;
    }
    .ai-thinking-body[data-hidden='true'] {
      display: none;
    }
  `;

  /** Per-card expansion state, keyed by the index of the FIRST reasoning
   *  delta in the answer array. While the card is still streaming we force
   *  it open regardless of this map. Once finished, the entry decides. */
  @state()
  private accessor _thinkingExpanded: Record<number, boolean> = {};

  @property({ attribute: false })
  accessor answer!: StreamObject[];

  @property({ attribute: false })
  accessor host: EditorHost | null | undefined;

  @property({ attribute: false })
  accessor std: BlockStdScope | null | undefined;

  @property({ attribute: false })
  accessor state: AffineAIPanelState = 'finished';

  @property({ attribute: false })
  accessor width: Signal<number | undefined> | undefined;

  @property({ attribute: false })
  accessor extensions!: ExtensionType[];

  @property({ attribute: false })
  accessor affineFeatureFlagService!: FeatureFlagService;

  @property({ attribute: false })
  accessor theme!: Signal<ColorScheme>;

  @property({ attribute: false })
  accessor independentMode: boolean | undefined;

  @property({ attribute: false })
  accessor notificationService!: NotificationService;

  @property({ attribute: false })
  accessor docDisplayService!: DocDisplayConfig;

  @property({ attribute: false })
  accessor peekViewService!: PeekViewService;

  @property({ attribute: false })
  accessor onOpenDoc!: (docId: string, sessionId?: string) => void;

  private renderToolCall(streamObject: StreamObject) {
    if (streamObject.type !== 'tool-call') {
      return nothing;
    }

    switch (streamObject.toolName) {
      case 'web_crawl_exa':
        return html`
          <web-crawl-tool
            .data=${streamObject}
            .width=${this.width}
          ></web-crawl-tool>
        `;
      case 'web_search_exa':
        return html`
          <web-search-tool
            .data=${streamObject}
            .width=${this.width}
          ></web-search-tool>
        `;
      case 'doc_compose':
        return html`
          <doc-compose-tool
            .std=${this.std || this.host?.std}
            .data=${streamObject}
            .width=${this.width}
            .theme=${this.theme}
            .notificationService=${this.notificationService}
          ></doc-compose-tool>
        `;
      case 'code_artifact':
        return html`
          <code-artifact-tool
            .std=${this.std || this.host?.std}
            .data=${streamObject}
            .width=${this.width}
            .theme=${this.theme}
          ></code-artifact-tool>
        `;
      case 'doc_edit':
        return html`
          <doc-edit-tool
            .data=${streamObject}
            .doc=${this.host?.store}
            .notificationService=${this.notificationService}
          ></doc-edit-tool>
        `;
      case 'doc_hybrid_search':
        return html`<doc-hybrid-search-result
          .data=${streamObject}
          .width=${this.width}
          .peekViewService=${this.peekViewService}
        ></doc-hybrid-search-result>`;
      case 'doc_semantic_search':
        return html`<doc-semantic-search-result
          .data=${streamObject}
          .width=${this.width}
          .peekViewService=${this.peekViewService}
        ></doc-semantic-search-result>`;
      case 'doc_keyword_search':
        return html`<doc-keyword-search-result
          .data=${streamObject}
          .width=${this.width}
        ></doc-keyword-search-result>`;
      case 'doc_read':
        return html`<doc-read-result
          .data=${streamObject}
          .width=${this.width}
        ></doc-read-result>`;
      case 'doc_create':
      case 'doc_update':
      case 'doc_update_meta':
        return html`<doc-write-tool
          .data=${streamObject}
          .width=${this.width}
          .peekViewService=${this.peekViewService}
          .docDisplayService=${this.docDisplayService}
          .onOpenDoc=${this.onOpenDoc}
        ></doc-write-tool>`;
      case 'section_edit':
        return html`
          <section-edit-tool
            .data=${streamObject}
            .extensions=${this.extensions}
            .affineFeatureFlagService=${this.affineFeatureFlagService}
            .notificationService=${this.notificationService}
            .theme=${this.theme}
            .host=${this.host}
            .independentMode=${this.independentMode}
          ></section-edit-tool>
        `;
      default: {
        const name = streamObject.toolName + ' tool calling';
        return html`
          <tool-call-card .name=${name} .width=${this.width}></tool-call-card>
        `;
      }
    }
  }

  private renderToolResult(streamObject: StreamObject) {
    if (streamObject.type !== 'tool-result') {
      return nothing;
    }

    switch (streamObject.toolName) {
      case 'web_crawl_exa':
        return html`
          <web-crawl-tool
            .data=${streamObject}
            .width=${this.width}
          ></web-crawl-tool>
        `;
      case 'web_search_exa':
        return html`
          <web-search-tool
            .data=${streamObject}
            .width=${this.width}
          ></web-search-tool>
        `;
      case 'doc_compose':
        return html`
          <doc-compose-tool
            .std=${this.std || this.host?.std}
            .data=${streamObject}
            .width=${this.width}
            .theme=${this.theme}
            .notificationService=${this.notificationService}
          ></doc-compose-tool>
        `;
      case 'code_artifact':
        return html`
          <code-artifact-tool
            .std=${this.std || this.host?.std}
            .data=${streamObject}
            .width=${this.width}
            .theme=${this.theme}
            .notificationService=${this.notificationService}
          ></code-artifact-tool>
        `;
      case 'doc_edit':
        return html`
          <doc-edit-tool
            .data=${streamObject}
            .host=${this.host}
            .renderRichText=${this.renderRichText.bind(this)}
            .notificationService=${this.notificationService}
          ></doc-edit-tool>
        `;
      case 'doc_hybrid_search':
        return html`<doc-hybrid-search-result
          .data=${streamObject}
          .width=${this.width}
          .peekViewService=${this.peekViewService}
        ></doc-hybrid-search-result>`;
      case 'doc_semantic_search':
        return html`<doc-semantic-search-result
          .data=${streamObject}
          .width=${this.width}
          .docDisplayService=${this.docDisplayService}
          .peekViewService=${this.peekViewService}
          .onOpenDoc=${this.onOpenDoc}
        ></doc-semantic-search-result>`;
      case 'doc_keyword_search':
        return html`<doc-keyword-search-result
          .data=${streamObject}
          .width=${this.width}
          .peekViewService=${this.peekViewService}
          .onOpenDoc=${this.onOpenDoc}
        ></doc-keyword-search-result>`;
      case 'doc_read':
        return html`<doc-read-result
          .data=${streamObject}
          .width=${this.width}
          .peekViewService=${this.peekViewService}
          .onOpenDoc=${this.onOpenDoc}
        ></doc-read-result>`;
      case 'doc_create':
      case 'doc_update':
      case 'doc_update_meta':
        return html`<doc-write-tool
          .data=${streamObject}
          .width=${this.width}
          .peekViewService=${this.peekViewService}
          .docDisplayService=${this.docDisplayService}
          .onOpenDoc=${this.onOpenDoc}
        ></doc-write-tool>`;
      case 'section_edit':
        return html`
          <section-edit-tool
            .data=${streamObject}
            .extensions=${this.extensions}
            .affineFeatureFlagService=${this.affineFeatureFlagService}
            .notificationService=${this.notificationService}
            .theme=${this.theme}
            .host=${this.host}
            .independentMode=${this.independentMode}
          ></section-edit-tool>
        `;
      default: {
        const name = streamObject.toolName + ' tool result';
        return html`
          <tool-result-card
            .name=${name}
            .width=${this.width}
          ></tool-result-card>
        `;
      }
    }
  }

  private renderRichText(text: string) {
    return html`<chat-content-rich-text
      .text=${text}
      .state=${this.state}
      .extensions=${this.extensions}
      .affineFeatureFlagService=${this.affineFeatureFlagService}
      .theme=${this.theme}
    ></chat-content-rich-text>`;
  }

  /**
   * Group consecutive 'reasoning' deltas into a single "Thinking" card.
   * Anything else (text-delta / tool-call / tool-result) ends the run.
   * Returns an array of either:
   *   - { kind: 'thinking', startIndex, parts }  -> render as ONE card
   *   - { kind: 'other', data }                  -> render normally
   *
   * `startIndex` is the index in `answer` of the FIRST reasoning delta in
   * that run. We use it as a stable key for the _thinkingExpanded map so
   * the user's collapse choice survives re-renders during streaming.
   */
  private _groupedItems() {
    type ReasoningRun = {
      kind: 'thinking';
      startIndex: number;
      endIndex: number;
      parts: string[];
    };
    type Other = { kind: 'other'; data: StreamObject };
    const out: (ReasoningRun | Other)[] = [];
    let run: ReasoningRun | null = null;
    this.answer.forEach((data, i) => {
      if (data.type === 'reasoning') {
        if (run) {
          run.parts.push(data.textDelta);
          run.endIndex = i;
        } else {
          run = {
            kind: 'thinking',
            startIndex: i,
            endIndex: i,
            parts: [data.textDelta],
          };
          out.push(run);
        }
      } else {
        run = null;
        out.push({ kind: 'other', data });
      }
    });
    return out;
  }

  private _toggleThinking(startIndex: number) {
    this._thinkingExpanded = {
      ...this._thinkingExpanded,
      [startIndex]: !this._thinkingExpanded[startIndex],
    };
  }

  /**
   * A reasoning run is "still streaming" if it ends at the very last item
   * AND the overall answer state is 'generating'. In that case we keep the
   * card expanded and animate the gradient. Once any non-reasoning chunk
   * arrives, the run is closed.
   */
  private _isReasoningRunActive(endIndex: number) {
    return this.state === 'generating' && endIndex === this.answer.length - 1;
  }

  private renderThinkingCard(
    startIndex: number,
    endIndex: number,
    parts: string[]
  ) {
    const streaming = this._isReasoningRunActive(endIndex);
    // While streaming: always show body. After: collapsed unless the user
    // has explicitly expanded.
    const userExpanded = !!this._thinkingExpanded[startIndex];
    const expanded = streaming || userExpanded;
    const merged = parts.join('');
    const label = streaming ? 'Thinking…' : 'Show thinking';

    return html`<div
      class="ai-thinking-card"
      data-streaming=${streaming ? 'true' : 'false'}
      data-expanded=${expanded ? 'true' : 'false'}
      data-testid="ai-thinking-card"
    >
      <div
        class="ai-thinking-header"
        data-disabled=${streaming ? 'true' : 'false'}
        @click=${() => {
          if (streaming) return;
          this._toggleThinking(startIndex);
        }}
      >
        <span class="ai-thinking-chevron">
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M3 1.5L6.5 5L3 8.5"
              stroke="currentColor"
              stroke-width="1.4"
              stroke-linecap="round"
              stroke-linejoin="round"
            ></path>
          </svg>
        </span>
        <span class="ai-thinking-label">${label}</span>
      </div>
      <div class="ai-thinking-body" data-hidden=${expanded ? 'false' : 'true'}>
        ${this.renderRichText(merged)}
      </div>
    </div>`;
  }

  protected override render() {
    return html`<div>
      ${this._groupedItems().map(item => {
        if (item.kind === 'thinking') {
          return this.renderThinkingCard(
            item.startIndex,
            item.endIndex,
            item.parts
          );
        }
        const data = item.data;
        switch (data.type) {
          case 'text-delta':
            return this.renderRichText(data.textDelta);
          case 'tool-call':
            return this.renderToolCall(data);
          case 'tool-result':
            return this.renderToolResult(data);
          default:
            return nothing;
        }
      })}
    </div>`;
  }
}
