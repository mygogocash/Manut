import type { InsertToPosition } from '@blocksuite/affine-shared/utils';
import { css } from '@emotion/css';
import { signal } from '@preact/signals-core';
import { type TemplateResult } from 'lit';
import { html } from 'lit/static-html.js';

import {
  createUniComponentFromWebComponent,
  renderUniLit,
} from '../../../core/index.js';
import {
  DataViewUIBase,
  DataViewUILogicBase,
} from '../../../core/view/data-view-base.js';
import type { GallerySingleView } from '../gallery-view-manager.js';
import type { GalleryViewSelectionWithType } from '../selection.js';

// ─── Card size map ─────────────────────────────────────────────────────────────

const CARD_SIZE_PX: Record<'sm' | 'md' | 'lg', number> = {
  sm: 160,
  md: 240,
  lg: 360,
};

// ─── Styles ────────────────────────────────────────────────────────────────────

const galleryViewStyle = css`
  display: flex;
  flex-direction: column;
  width: 100%;
  font-size: 14px;
`;

const galleryHeaderStyle = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  margin-bottom: 8px;
`;

const sizeToggleStyle = css`
  display: flex;
  border: 1px solid var(--affine-border-color, #e3e3e3);
  border-radius: 6px;
  overflow: hidden;

  button {
    appearance: none;
    border: none;
    border-right: 1px solid var(--affine-border-color, #e3e3e3);
    background: transparent;
    color: inherit;
    padding: 4px 10px;
    cursor: pointer;
    font-size: 12px;
    border-radius: 0;
  }
  button:last-child {
    border-right: none;
  }
  button:hover {
    background: var(--affine-hover-color, rgba(0, 0, 0, 0.04));
  }
  button.active {
    background: var(--affine-hover-color, rgba(0, 0, 0, 0.08));
    font-weight: 600;
  }
`;

const galleryGridStyle = (minPx: number) => css`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(${minPx}px, 1fr));
  gap: 12px;
  padding: 4px 0;
`;

const cardStyle = css`
  border: 1px solid var(--affine-border-color, #e3e3e3);
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  transition:
    box-shadow 0.15s ease,
    border-color 0.15s ease;

  &:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }
`;

const cardSelectedStyle = css`
  border-color: var(--affine-primary-color, #1e90ff);
  box-shadow: 0 0 0 2px var(--affine-primary-color, #1e90ff);
`;

const cardCoverStyle = css`
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  background: var(--affine-hover-color, rgba(0, 0, 0, 0.04));
`;

const cardCoverPlaceholderStyle = css`
  width: 100%;
  aspect-ratio: 16 / 9;
  background: var(--affine-hover-color, rgba(0, 0, 0, 0.04));
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--affine-text-secondary-color, #888);
  font-size: 24px;
`;

const cardBodyStyle = css`
  padding: 8px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
`;

const cardTitleStyle = css`
  font-weight: 600;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const cardPropertyStyle = css`
  font-size: 12px;
  color: var(--affine-text-secondary-color, #888);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const bulkActionBarStyle = css`
  position: sticky;
  bottom: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: var(--affine-background-primary-color, #fff);
  border-top: 1px solid var(--affine-border-color, #e3e3e3);
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.06);
  z-index: 10;
`;

const bulkCountStyle = css`
  font-size: 13px;
  color: var(--affine-text-secondary-color, #888);
  flex: 1;
`;

const bulkButtonStyle = css`
  appearance: none;
  border: 1px solid var(--affine-border-color, #e3e3e3);
  background: transparent;
  color: inherit;
  border-radius: 6px;
  padding: 4px 12px;
  cursor: pointer;
  font-size: 13px;

  &:hover {
    background: var(--affine-hover-color, rgba(0, 0, 0, 0.04));
  }
`;

const bulkDeleteButtonStyle = css`
  appearance: none;
  border: 1px solid var(--affine-error-color, #e54);
  background: transparent;
  color: var(--affine-error-color, #e54);
  border-radius: 6px;
  padding: 4px 12px;
  cursor: pointer;
  font-size: 13px;

  &:hover {
    background: rgba(238, 85, 68, 0.06);
  }
`;

// ─── UI Logic ─────────────────────────────────────────────────────────────────

export class GalleryViewUILogic extends DataViewUILogicBase<
  GallerySingleView,
  GalleryViewSelectionWithType
> {
  ui$ = signal<GalleryViewUI | undefined>();

  /** Currently multi-selected row IDs (α-GAL-3). */
  selectedRowIds$ = signal<Set<string>>(new Set());

  // ─── Abstract members required by DataViewUILogicBase ───────────────────

  clearSelection = () => {
    this.selectedRowIds$.value = new Set();
    this.setSelection(undefined);
  };

  addRow = (_position: InsertToPosition) => {
    if (this.view.readonly$.value) return undefined;
    const rowId = this.view.addRowWithDefaults('end');
    if (rowId) {
      this.openRow(rowId);
    }
    return rowId;
  };

  focusFirstCell = () => {
    // No keyboard-focused cell concept in gallery MVP.
  };

  showIndicator = (_evt: MouseEvent) => {
    return false;
  };

  hideIndicator = () => {
    // No drag indicator in gallery MVP.
  };

  moveTo = (_id: string, _evt: MouseEvent) => {
    // Drag-to-reorder not implemented in gallery MVP.
  };

  renderer = createUniComponentFromWebComponent(GalleryViewUI);

  // ─── Gallery-specific actions ────────────────────────────────────────────

  openRow = (rowId: string) => {
    this.root.openDetailPanel({
      view: this.view,
      rowId,
    });
  };

  /**
   * Toggle a card's selection state (α-GAL-3).
   * Cmd/Ctrl+click adds to multi-selection; plain click opens the detail panel.
   */
  handleCardClick = (rowId: string, evt: MouseEvent) => {
    const isMultiSelect = evt.metaKey || evt.ctrlKey;

    if (isMultiSelect) {
      const next = new Set(this.selectedRowIds$.value);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      this.selectedRowIds$.value = next;

      if (next.size > 0) {
        this.setSelection({
          viewId: this.view.id,
          type: 'gallery',
          selectionType: 'multi',
          rowIds: [...next],
        });
      } else {
        this.setSelection(undefined);
      }
      return;
    }

    // Plain click: clear multi-selection and open detail panel.
    if (this.selectedRowIds$.value.size > 0) {
      this.clearSelection();
    }
    this.openRow(rowId);
  };

  /** Delete the currently selected rows (α-GAL-3). */
  deleteSelected = () => {
    const ids = [...this.selectedRowIds$.value];
    if (ids.length === 0) return;
    this.view.rowsDelete(ids);
    this.clearSelection();
  };

  /** Duplicate the currently selected rows (α-GAL-3). */
  duplicateSelected = () => {
    const ids = [...this.selectedRowIds$.value];
    if (ids.length === 0) return;
    // Add a new row for each selected row and copy visible property values.
    for (const srcId of ids) {
      const newId = this.view.rowAdd('end');
      for (const prop of this.view.properties$.value) {
        const srcCell = prop.cellGetOrCreate(srcId);
        const dstCell = prop.cellGetOrCreate(newId);
        try {
          dstCell.valueSet(srcCell.value$.value);
        } catch {
          // Skip read-only properties gracefully.
        }
      }
    }
    this.clearSelection();
  };
}

// ─── Lit element ──────────────────────────────────────────────────────────────

export class GalleryViewUI extends DataViewUIBase<GalleryViewUILogic> {
  override connectedCallback(): void {
    super.connectedCallback();
    this.logic.ui$.value = this;
    this.classList.add(galleryViewStyle);
  }

  private renderHeader(): TemplateResult {
    const size = this.logic.view.cardSize$.value;

    return html`
      <div class=${galleryHeaderStyle}>
        <div></div>
        <div class=${sizeToggleStyle}>
          <button
            class=${size === 'sm' ? 'active' : ''}
            title="Small cards"
            @click=${() => this.logic.view.setCardSize('sm')}
          >
            S
          </button>
          <button
            class=${size === 'md' ? 'active' : ''}
            title="Medium cards"
            @click=${() => this.logic.view.setCardSize('md')}
          >
            M
          </button>
          <button
            class=${size === 'lg' ? 'active' : ''}
            title="Large cards"
            @click=${() => this.logic.view.setCardSize('lg')}
          >
            L
          </button>
        </div>
      </div>
    `;
  }

  private renderCard(rowId: string): TemplateResult {
    const coverUrl = this.logic.view.rowCoverUrl(rowId);
    const title = this.logic.view.rowTitle(rowId);
    const selected = this.logic.selectedRowIds$.value.has(rowId);

    const visibleProps = this.logic.view.properties$.value.filter(
      p =>
        p.type$.value !== 'title' &&
        p.id !== this.logic.view.coverImageColumnId$.value
    );

    const cardClasses = [cardStyle, selected ? cardSelectedStyle : '']
      .filter(Boolean)
      .join(' ');

    return html`
      <div
        class=${cardClasses}
        @click=${(e: MouseEvent) => this.logic.handleCardClick(rowId, e)}
      >
        ${coverUrl
          ? html`<img
              class=${cardCoverStyle}
              src=${coverUrl}
              alt=${title}
              loading="lazy"
            />`
          : html`<div class=${cardCoverPlaceholderStyle}>□</div>`}
        <div class=${cardBodyStyle}>
          <div class=${cardTitleStyle} title=${title}>
            ${title || 'Untitled'}
          </div>
          ${visibleProps.slice(0, 3).map(prop => {
            const cell = prop.cellGetOrCreate(rowId);
            const value = cell.stringValue$.value;
            if (!value) return html``;
            return html`
              <div class=${cardPropertyStyle} title=${value}>${value}</div>
            `;
          })}
        </div>
      </div>
    `;
  }

  private renderBulkActionBar(): TemplateResult {
    const count = this.logic.selectedRowIds$.value.size;
    if (count === 0) return html``;

    return html`
      <div class=${bulkActionBarStyle}>
        <span class=${bulkCountStyle}>${count} selected</span>
        <button
          class=${bulkButtonStyle}
          @click=${() => this.logic.duplicateSelected()}
        >
          Duplicate
        </button>
        <button
          class=${bulkDeleteButtonStyle}
          @click=${() => this.logic.deleteSelected()}
        >
          Delete
        </button>
        <button
          class=${bulkButtonStyle}
          @click=${() => this.logic.clearSelection()}
        >
          Clear
        </button>
      </div>
    `;
  }

  override render(): TemplateResult {
    const size = this.logic.view.cardSize$.value;
    const minPx = CARD_SIZE_PX[size];
    const rowIds = this.logic.view.rows$.value.map(r => r.rowId);

    return html`
      ${renderUniLit(this.logic.root.config.headerWidget, {
        dataViewLogic: this.logic,
      })}
      ${this.renderHeader()}
      <div class=${galleryGridStyle(minPx)}>
        ${rowIds.map(rowId => this.renderCard(rowId))}
      </div>
      ${this.renderBulkActionBar()}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'affine-data-view-gallery': GalleryViewUI;
  }
}
