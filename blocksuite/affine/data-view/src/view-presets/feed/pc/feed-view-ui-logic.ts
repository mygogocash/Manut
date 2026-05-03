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
import type { FeedSingleView } from '../feed-view-manager.js';
import type { FeedViewSelectionWithType } from '../selection.js';

// ─── Styles ───────────────────────────────────────────────────────────────

const feedViewStyle = css`
  display: flex;
  flex-direction: column;
  width: 100%;
  font-size: 14px;
`;

const feedHeaderStyle = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  margin-bottom: 8px;
  gap: 8px;
  flex-wrap: wrap;
`;

const dateRangeToggleStyle = css`
  display: flex;
  border: 1px solid var(--affine-border-color, #e3e3e3);
  border-radius: 6px;
  overflow: hidden;
`;

const dateRangeButtonStyle = css`
  appearance: none;
  border: none;
  border-right: 1px solid var(--affine-border-color, #e3e3e3);
  background: transparent;
  color: inherit;
  padding: 4px 10px;
  cursor: pointer;
  font-size: 12px;
  &:last-child {
    border-right: none;
  }
  &:hover {
    background: var(--affine-hover-color, rgba(0, 0, 0, 0.04));
  }
`;

const dateRangeButtonActiveStyle = css`
  background: var(--affine-hover-color, rgba(0, 0, 0, 0.08));
  font-weight: 600;
`;

const newRowButtonStyle = css`
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

const feedListStyle = css`
  display: flex;
  flex-direction: column;
  gap: 0;
`;

const feedCardStyle = css`
  padding: 12px 0;
  border-bottom: 1px solid var(--affine-border-color, #e3e3e3);
  cursor: pointer;
  &:hover {
    background: var(--affine-hover-color, rgba(0, 0, 0, 0.02));
  }
`;

const feedCardTitleStyle = css`
  font-size: 16px;
  font-weight: 600;
  color: var(--affine-text-primary-color, #111);
  margin-bottom: 6px;
`;

const feedCardChipsStyle = css`
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
`;

const feedCardChipStyle = css`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--affine-hover-color, rgba(0, 0, 0, 0.06));
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 12px;
  color: var(--affine-text-secondary-color, #666);
`;

const feedDateChipStyle = css`
  display: inline-flex;
  align-items: center;
  background: var(--affine-tag-blue, #cfe6ff);
  color: var(--affine-text-primary-color, #111);
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 12px;
`;

const feedCounterStyle = css`
  font-size: 12px;
  color: var(--affine-text-secondary-color, #888);
  padding: 8px 0;
  text-align: right;
`;

const sentinelStyle = css`
  height: 1px;
  width: 100%;
`;

// ─── UI logic ─────────────────────────────────────────────────────────────

export class FeedViewUILogic extends DataViewUILogicBase<
  FeedSingleView,
  FeedViewSelectionWithType
> {
  ui$ = signal<FeedViewUI | undefined>();

  // ─── Abstract members required by DataViewUILogicBase ─────────────────

  clearSelection = () => {
    this.setSelection(undefined);
  };

  addRow = (position: 'start' | 'end') => {
    if (this.view.readonly$.value) return undefined;
    const rowId = this.view.addRowWithDefaults(position);
    if (rowId) {
      this.openRow(rowId);
    }
    return rowId;
  };

  focusFirstCell = () => {
    // No keyboard-focused cell concept in feed MVP.
  };

  showIndicator = (_evt: MouseEvent) => {
    return false;
  };

  hideIndicator = () => {};

  moveTo = (_id: string, _evt: MouseEvent) => {};

  openRow = (rowId: string) => {
    this.root.openDetailPanel({
      view: this.view,
      rowId,
    });
  };

  renderer = createUniComponentFromWebComponent(FeedViewUI);
}

// ─── Lit element ──────────────────────────────────────────────────────────

export class FeedViewUI extends DataViewUIBase<FeedViewUILogic> {
  // α-FEED-1: how many rows are currently visible
  private _visibleCount = 0;

  private _intersectionObserver: IntersectionObserver | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    this.logic.ui$.value = this;
    this.classList.add(feedViewStyle);
    // Initialise visible count from the view's configured page size
    this._visibleCount = this.logic.view.pageSize$.value;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._intersectionObserver?.disconnect();
    this._intersectionObserver = null;
  }

  private _attachSentinelObserver(sentinel: HTMLElement | null) {
    if (!sentinel) return;
    this._intersectionObserver?.disconnect();
    this._intersectionObserver = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const pageSize = this.logic.view.pageSize$.value;
            const total = this.logic.view.filteredRows$.value.length;
            if (this._visibleCount < total) {
              this._visibleCount += pageSize;
              this.requestUpdate();
            }
          }
        }
      },
      { threshold: 0.1 }
    );
    this._intersectionObserver.observe(sentinel);
  }

  private renderDateRangeToggle(): TemplateResult {
    const current = this.logic.view.dateRangeFilter$.value;

    const btn = (
      label: string,
      value: 'last7days' | 'last30days' | 'alltime'
    ) => {
      const isActive = current === value;
      return html`
        <button
          class=${isActive
            ? `${dateRangeButtonStyle} ${dateRangeButtonActiveStyle}`
            : dateRangeButtonStyle}
          @click=${() => this.logic.view.setDateRangeFilter(value)}
        >
          ${label}
        </button>
      `;
    };

    return html`
      <div class=${dateRangeToggleStyle}>
        ${btn('Last 7 days', 'last7days')} ${btn('Last 30 days', 'last30days')}
        ${btn('All time', 'alltime')}
      </div>
    `;
  }

  private renderHeader(): TemplateResult {
    const readonly = this.logic.view.readonly$.value;
    return html`
      <div class=${feedHeaderStyle}>
        ${this.renderDateRangeToggle()}
        ${!readonly
          ? html`
              <button
                class=${newRowButtonStyle}
                @click=${() => this.logic.addRow('end')}
              >
                + New row
              </button>
            `
          : ''}
      </div>
    `;
  }

  private renderCard(rowId: string): TemplateResult {
    const view = this.logic.view;
    const title = view.rowTitle(rowId);

    // Find date-typed property for the date chip
    const dateProp = view.propertiesRaw$.value.find(
      p => p.type$.value === 'date'
    );
    let dateLabel: string | null = null;
    if (dateProp) {
      const raw = dateProp.cellGetOrCreate(rowId).jsonValue$.value;
      if (raw != null) {
        const ms = typeof raw === 'number' ? raw : Date.parse(String(raw));
        if (!Number.isNaN(ms)) {
          dateLabel = new Date(ms).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          });
        }
      }
    }

    // Other visible properties (non-title, non-date)
    const otherProps = view.properties$.value.filter(p => {
      if (p.type$.value === 'title') return false;
      if (p.id === dateProp?.id) return false;
      return true;
    });

    return html`
      <div
        class=${feedCardStyle}
        @click=${() => this.logic.openRow(rowId)}
      >
        <div class=${feedCardTitleStyle}>${title || 'Untitled'}</div>
        <div class=${feedCardChipsStyle}>
          ${dateLabel
            ? html`<span class=${feedDateChipStyle}>${dateLabel}</span>`
            : ''}
          ${otherProps.map(p => {
            const cellStr = p.cellGetOrCreate(rowId).stringValue$.value;
            if (!cellStr) return '';
            return html`
              <span class=${feedCardChipStyle}
                ><span style="opacity:0.6">${p.name$.value}:</span>
                ${cellStr}</span
              >
            `;
          })}
        </div>
      </div>
    `;
  }

  override updated(): void {
    // Re-attach IntersectionObserver to sentinel after each render
    const sentinel = this.renderRoot?.querySelector(
      `.${sentinelStyle}`
    ) as HTMLElement | null;
    if (sentinel) {
      this._attachSentinelObserver(sentinel);
    }
  }

  override render(): TemplateResult {
    const filteredRows = this.logic.view.filteredRows$.value;
    const total = filteredRows.length;
    const visible = filteredRows.slice(0, this._visibleCount);

    return html`
      ${renderUniLit(this.logic.root.config.headerWidget, {
        dataViewLogic: this.logic,
      })}
      ${this.renderHeader()}
      <div class=${feedListStyle}>
        ${visible.map(row => this.renderCard(row.rowId))}
      </div>
      <div
        class=${feedCounterStyle}
      >
        Showing ${Math.min(this._visibleCount, total)} of ${total} rows
      </div>
      <div
        class=${sentinelStyle}
        data-feed-sentinel="true"
      ></div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'affine-data-view-feed': FeedViewUI;
  }
}
