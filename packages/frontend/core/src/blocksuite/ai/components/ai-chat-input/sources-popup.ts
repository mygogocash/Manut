import type { TagMeta } from '@affine/core/components/page-list';
import { SignalWatcher, WithDisposable } from '@blocksuite/affine/global/lit';
import { unsafeCSSVar, unsafeCSSVarV2 } from '@blocksuite/affine/shared/theme';
import { ShadowlessElement } from '@blocksuite/affine/std';
import {
  CloseIcon,
  CollectionsIcon,
  DeleteIcon,
  PlusIcon,
  TocIcon,
  UngroupIcon,
} from '@blocksuite/icons/lit';
import { type Signal, signal } from '@preact/signals-core';
import { css, html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';

import type {
  ChatChip,
  DocDisplayConfig,
} from '../ai-chat-chips/type';
import {
  getChipKey,
  isAttachmentChip,
  isCollectionChip,
  isDocChip,
  isFileChip,
  isSelectedContextChip,
  isTagChip,
} from '../ai-chat-chips/utils';

interface SourceRow {
  key: string;
  icon: TemplateResult<1>;
  name: string;
  typeLabel: string;
  chip: ChatChip;
}

/**
 * Sources popup — Notion-style "My sources" panel.
 *
 * Lists every chat context chip (docs, files, attachments, tags,
 * collections, selected snippets) in a vertical menu. Each row has a
 * remove button that delegates to the existing chip pipeline. A footer
 * "Add sources" CTA dispatches a `request-add-sources` event so the
 * caller can trigger the existing `chat-panel-add-popover`.
 */
export class AIChatSourcesPopup extends SignalWatcher(
  WithDisposable(ShadowlessElement)
) {
  static override styles = css`
    .ai-sources-popup {
      width: 280px;
      max-height: 360px;
      display: flex;
      flex-direction: column;
      border: 0.5px solid ${unsafeCSSVarV2('layer/insideBorder/border')};
      border-radius: 8px;
      background: ${unsafeCSSVarV2('layer/background/overlayPanel')};
      box-shadow: ${unsafeCSSVar('overlayPanelShadow')};
      overflow: hidden;
      box-sizing: border-box;
    }

    .ai-sources-popup-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      border-bottom: 0.5px solid
        ${unsafeCSSVarV2('layer/insideBorder/border')};
    }

    .ai-sources-popup-title {
      font-size: 13px;
      font-weight: 600;
      color: ${unsafeCSSVarV2('text/primary')};
    }

    .ai-sources-popup-close {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      border-radius: 4px;
      cursor: pointer;
      color: ${unsafeCSSVarV2('icon/secondary')};
    }

    .ai-sources-popup-close:hover {
      background-color: ${unsafeCSSVarV2('layer/background/hoverOverlay')};
    }

    .ai-sources-popup-list {
      flex: 1 1 auto;
      overflow-y: auto;
      padding: 4px 0;
      min-height: 0;
    }

    .ai-sources-popup-empty {
      padding: 16px 12px;
      font-size: 13px;
      color: ${unsafeCSSVarV2('text/secondary')};
      text-align: center;
    }

    .ai-sources-popup-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      cursor: default;
    }

    .ai-sources-popup-row:hover {
      background-color: ${unsafeCSSVarV2('layer/background/hoverOverlay')};
    }

    .ai-sources-popup-row .icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      flex-shrink: 0;
      color: ${unsafeCSSVarV2('icon/primary')};
    }

    .ai-sources-popup-row .icon svg {
      width: 16px;
      height: 16px;
    }

    .ai-sources-popup-row .meta {
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      min-width: 0;
    }

    .ai-sources-popup-row .name {
      font-size: 13px;
      font-weight: 500;
      color: ${unsafeCSSVarV2('text/primary')};
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .ai-sources-popup-row .type {
      font-size: 11px;
      color: ${unsafeCSSVarV2('text/secondary')};
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .ai-sources-popup-row .remove {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      border-radius: 4px;
      cursor: pointer;
      color: ${unsafeCSSVarV2('icon/secondary')};
      flex-shrink: 0;
      border: none;
      background: transparent;
      padding: 0;
    }

    .ai-sources-popup-row .remove:hover {
      background-color: ${unsafeCSSVarV2('layer/background/hoverOverlay')};
      color: ${unsafeCSSVarV2('icon/primary')};
    }

    .ai-sources-popup-row .remove svg {
      width: 14px;
      height: 14px;
    }

    .ai-sources-popup-footer {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-top: 0.5px solid
        ${unsafeCSSVarV2('layer/insideBorder/border')};
      cursor: pointer;
      color: ${unsafeCSSVarV2('text/primary')};
      font-size: 13px;
      font-weight: 500;
      background: transparent;
      border-left: none;
      border-right: none;
      border-bottom: none;
      width: 100%;
      text-align: left;
    }

    .ai-sources-popup-footer:hover {
      background-color: ${unsafeCSSVarV2('layer/background/hoverOverlay')};
    }

    .ai-sources-popup-footer svg {
      width: 16px;
      height: 16px;
      color: ${unsafeCSSVarV2('icon/primary')};
    }
  `;

  @property({ attribute: false })
  accessor chips: ChatChip[] = [];

  @property({ attribute: false })
  accessor removeChip!: (chip: ChatChip) => Promise<void> | void;

  @property({ attribute: false })
  accessor onAddSources: (() => void) | undefined;

  @property({ attribute: false })
  accessor onClose: (() => void) | undefined;

  @property({ attribute: false })
  accessor docDisplayConfig!: DocDisplayConfig;

  // Local caches for tag/collection display lookup. These are populated on
  // connect via the same DocDisplayConfig used by chat-panel-chips.
  private _tags: Signal<TagMeta[]> = signal([]);
  private _collections: Signal<{ id: string; name: string }[]> = signal([]);

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.docDisplayConfig) {
      const tags = this.docDisplayConfig.getTags();
      this._tags = tags.signal;
      this._disposables.add(tags.cleanup);

      const collections = this.docDisplayConfig.getCollections();
      this._collections = collections.signal;
      this._disposables.add(collections.cleanup);
    }
  }

  private _resolveRow(chip: ChatChip): SourceRow | null {
    const key = getChipKey(chip);
    if (!key) return null;

    if (isDocChip(chip)) {
      const title = this.docDisplayConfig.getTitle(chip.docId) || 'Untitled';
      return {
        key,
        icon: TocIcon(),
        name: title,
        typeLabel: 'Doc',
        chip,
      };
    }
    if (isFileChip(chip)) {
      return {
        key,
        icon: TocIcon(),
        name: chip.file.name,
        typeLabel: 'File',
        chip,
      };
    }
    if (isAttachmentChip(chip)) {
      return {
        key,
        icon: TocIcon(),
        name: chip.name,
        typeLabel: 'Attachment',
        chip,
      };
    }
    if (isTagChip(chip)) {
      const tag = this._tags.value.find(t => t.id === chip.tagId);
      if (!tag) return null;
      return {
        key,
        icon: TocIcon(),
        name: tag.name,
        typeLabel: 'Tag',
        chip,
      };
    }
    if (isCollectionChip(chip)) {
      const collection = this._collections.value.find(
        c => c.id === chip.collectionId
      );
      if (!collection) return null;
      return {
        key,
        icon: CollectionsIcon(),
        name: collection.name,
        typeLabel: 'Collection',
        chip,
      };
    }
    if (isSelectedContextChip(chip)) {
      return {
        key,
        icon: UngroupIcon(),
        name: 'Selected content',
        typeLabel: 'Selection',
        chip,
      };
    }
    return null;
  }

  private readonly _handleRemove = (chip: ChatChip) => {
    Promise.resolve(this.removeChip(chip)).catch(console.error);
  };

  private readonly _handleAddSources = () => {
    this.onAddSources?.();
  };

  private readonly _handleClose = () => {
    this.onClose?.();
  };

  override render() {
    const rows = this.chips
      .map(chip => this._resolveRow(chip))
      .filter((r): r is SourceRow => r !== null);

    return html`<div class="ai-sources-popup" data-testid="ai-chat-sources-popup">
      <div class="ai-sources-popup-header">
        <div class="ai-sources-popup-title">
          My sources (${rows.length})
        </div>
        <div
          class="ai-sources-popup-close"
          @click=${this._handleClose}
          data-testid="ai-chat-sources-popup-close"
        >
          ${CloseIcon()}
        </div>
      </div>
      <div class="ai-sources-popup-list">
        ${rows.length === 0
          ? html`<div class="ai-sources-popup-empty">
              No sources yet. Add docs, files or selections to give the AI
              context.
            </div>`
          : repeat(
              rows,
              row => row.key,
              row => html`<div class="ai-sources-popup-row">
                <span class="icon">${row.icon}</span>
                <div class="meta">
                  <div class="name" title=${row.name}>${row.name}</div>
                  <div class="type">${row.typeLabel}</div>
                </div>
                <button
                  class="remove"
                  type="button"
                  aria-label="Remove source"
                  @click=${() => this._handleRemove(row.chip)}
                >
                  ${DeleteIcon()}
                </button>
              </div>`
            )}
      </div>
      ${this.onAddSources
        ? html`<button
            class="ai-sources-popup-footer"
            type="button"
            @click=${this._handleAddSources}
            data-testid="ai-chat-sources-popup-add"
          >
            ${PlusIcon()}
            <span>Add sources</span>
          </button>`
        : nothing}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ai-chat-sources-popup': AIChatSourcesPopup;
  }
}
