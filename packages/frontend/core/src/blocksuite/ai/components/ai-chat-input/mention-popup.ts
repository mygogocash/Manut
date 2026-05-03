import { SignalWatcher, WithDisposable } from '@blocksuite/affine/global/lit';
import { scrollbarStyle } from '@blocksuite/affine/shared/styles';
import { unsafeCSSVar, unsafeCSSVarV2 } from '@blocksuite/affine/shared/theme';
import { ShadowlessElement } from '@blocksuite/affine/std';
import type {
  LinkedMenuGroup,
  LinkedMenuItem,
} from '@blocksuite/affine/widgets/linked-doc';
import { Signal } from '@preact/signals-core';
import { css, html, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';

import type {
  MentionMember,
  SearchMenuConfig,
} from '../ai-chat-add-context/type';

export type MentionPopupSelectDoc = (docId: string, title: string) => void;
export type MentionPopupSelectMember = (member: MentionMember) => void;

function resolveSignal<T>(value: T | Signal<T>): T {
  return value instanceof Signal ? value.value : value;
}

/**
 * Notion-style @-mention popup. Shows two sections — "Pages" and "People" —
 * filtered by the current query string. Selection invokes the appropriate
 * callback. Keyboard navigation supported.
 */
export class AIChatMentionPopup extends SignalWatcher(
  WithDisposable(ShadowlessElement)
) {
  static override styles = css`
    .ai-mention-popup {
      width: 280px;
      max-height: 360px;
      overflow-y: auto;
      border: 0.5px solid ${unsafeCSSVarV2('layer/insideBorder/border')};
      border-radius: 8px;
      background: ${unsafeCSSVarV2('layer/background/overlayPanel')};
      box-shadow: ${unsafeCSSVar('overlayPanelShadow')};
      padding: 6px;
      box-sizing: border-box;
    }
    .ai-mention-popup .group-name {
      padding: 4px 8px;
      font-size: 12px;
      font-weight: 500;
      color: ${unsafeCSSVarV2('text/secondary')};
    }
    .ai-mention-popup .menu-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 8px;
      border-radius: 4px;
      cursor: pointer;
      font-size: var(--affine-font-sm);
      color: ${unsafeCSSVarV2('text/primary')};
      line-height: 20px;
    }
    .ai-mention-popup .menu-item svg {
      width: 18px;
      height: 18px;
      flex-shrink: 0;
      color: ${unsafeCSSVarV2('icon/primary')};
    }
    .ai-mention-popup .menu-item .label {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .ai-mention-popup .menu-item[data-active='true'] {
      background-color: ${unsafeCSSVarV2('layer/background/hoverOverlay')};
    }
    .ai-mention-popup .menu-item:hover {
      background-color: ${unsafeCSSVarV2('layer/background/hoverOverlay')};
    }
    .ai-mention-popup .divider {
      border-top: 0.5px solid ${unsafeCSSVarV2('layer/insideBorder/border')};
      margin: 6px 0;
    }
    .ai-mention-popup .no-result {
      padding: 8px;
      font-size: var(--affine-font-sm);
      color: ${unsafeCSSVarV2('text/secondary')};
    }
    .ai-mention-popup .loading {
      padding: 8px;
      font-size: var(--affine-font-sm);
      color: ${unsafeCSSVarV2('text/secondary')};
    }

    ${scrollbarStyle('.ai-mention-popup')}
  `;

  @property({ attribute: false })
  accessor query = '';

  @property({ attribute: false })
  accessor searchMenuConfig!: SearchMenuConfig;

  @property({ attribute: false })
  accessor abortController!: AbortController;

  @property({ attribute: false })
  accessor onSelectDoc!: MentionPopupSelectDoc;

  @property({ attribute: false })
  accessor onSelectMember!: MentionPopupSelectMember;

  @property({ attribute: false })
  accessor onCancel: (() => void) | undefined;

  @state()
  private accessor _docGroup: LinkedMenuGroup | null = null;

  @state()
  private accessor _memberGroup: LinkedMenuGroup | null = null;

  @state()
  private accessor _activatedIndex = 0;

  @query('.ai-mention-popup')
  accessor popupEl!: HTMLDivElement;

  private _innerAbort = new AbortController();

  private get _flatItems(): LinkedMenuItem[] {
    const items: LinkedMenuItem[] = [];
    if (this._docGroup) {
      items.push(...resolveSignal(this._docGroup.items));
    }
    if (this._memberGroup) {
      items.push(...resolveSignal(this._memberGroup.items));
    }
    return items;
  }

  override connectedCallback() {
    super.connectedCallback();
    this._refresh();
    document.addEventListener('keydown', this._handleKeyDown, true);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this._innerAbort.abort();
    document.removeEventListener('keydown', this._handleKeyDown, true);
  }

  override updated(changed: Map<string, unknown>) {
    if (changed.has('query')) {
      this._refresh();
    }
  }

  private _refresh() {
    this._innerAbort.abort();
    this._innerAbort = new AbortController();
    this._activatedIndex = 0;

    // Wrap doc menu action so we can pull title for the chip name.
    this._docGroup = this.searchMenuConfig.getDocMenuGroup(
      this.query,
      meta => {
        const title =
          typeof meta?.title === 'string' && meta.title.length > 0
            ? meta.title
            : 'Untitled';
        this.onSelectDoc(meta.id, title);
      },
      this._innerAbort.signal
    );

    if (this.searchMenuConfig.getMemberMenuGroup) {
      this._memberGroup = this.searchMenuConfig.getMemberMenuGroup(
        this.query,
        member => {
          this.onSelectMember(member);
        },
        this._innerAbort.signal
      );
    } else {
      this._memberGroup = null;
    }
  }

  private readonly _handleKeyDown = (evt: KeyboardEvent) => {
    if (evt.isComposing) return;
    const { key } = evt;
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      const total = this._flatItems.length;
      if (total === 0) return;
      evt.preventDefault();
      evt.stopPropagation();
      if (key === 'ArrowDown') {
        this._activatedIndex = (this._activatedIndex + 1) % total;
      } else {
        this._activatedIndex =
          (this._activatedIndex - 1 + total) % total;
      }
    } else if (key === 'Enter') {
      const items = this._flatItems;
      if (items.length === 0) return;
      evt.preventDefault();
      evt.stopPropagation();
      const item = items[this._activatedIndex];
      Promise.resolve(item.action()).catch(console.error);
    } else if (key === 'Escape') {
      evt.preventDefault();
      evt.stopPropagation();
      this.onCancel?.();
      this.abortController.abort();
    }
  };

  private _renderItem(item: LinkedMenuItem, index: number) {
    return html`<div
      class="menu-item"
      data-index=${index}
      data-active=${this._activatedIndex === index}
      @mousemove=${() => (this._activatedIndex = index)}
      @click=${() => Promise.resolve(item.action()).catch(console.error)}
    >
      ${item.icon}
      <span class="label">${item.name}</span>
    </div>`;
  }

  private _renderGroup(
    group: LinkedMenuGroup | null,
    startIndex: number,
    fallbackName: string
  ): { template: TemplateResult; consumed: number } {
    if (!group) return { template: html``, consumed: 0 };
    const items = resolveSignal(group.items);
    const isLoading = !!resolveSignal(group.loading ?? false);
    return {
      template: html`<div class="group">
        <div class="group-name">${fallbackName}</div>
        ${items.length === 0
          ? isLoading
            ? html`<div class="loading">Loading...</div>`
            : html`<div class="no-result">No results</div>`
          : repeat(
              items,
              item => item.key,
              (item, idx) => this._renderItem(item, startIndex + idx)
            )}
      </div>`,
      consumed: items.length,
    };
  }

  override render() {
    const docItems = this._docGroup
      ? resolveSignal(this._docGroup.items).length
      : 0;

    const docPart = this._renderGroup(this._docGroup, 0, 'Pages');
    const memberPart = this._renderGroup(this._memberGroup, docItems, 'People');

    const total = this._flatItems.length;

    return html`<div
      class="ai-mention-popup"
      data-testid="ai-chat-mention-popup"
    >
      ${total === 0 && !this._docGroup && !this._memberGroup
        ? html`<div class="no-result">No results</div>`
        : html`
            ${docPart.template}
            ${this._memberGroup
              ? html`<div class="divider"></div>${memberPart.template}`
              : ''}
          `}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ai-chat-mention-popup': AIChatMentionPopup;
  }
}
