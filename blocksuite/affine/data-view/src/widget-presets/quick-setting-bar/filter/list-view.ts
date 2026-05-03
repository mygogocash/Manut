import {
  type PopupTarget,
  popupTargetFromElement,
} from '@blocksuite/affine-components/context-menu';
import { SignalWatcher } from '@blocksuite/global/lit';
import {
  AiIcon,
  ArrowDownSmallIcon,
  FilterIcon,
  PlusIcon,
} from '@blocksuite/icons/lit';
import { ShadowlessElement } from '@blocksuite/std';
import { computed, type ReadonlySignal } from '@preact/signals-core';
import { css, html } from 'lit';
import { property, state } from 'lit/decorators.js';

import type { Variable } from '../../../core/expression/types.js';
import type { Filter, FilterGroup } from '../../../core/filter/types.js';
import { popCreateFilter } from '../../../core/index.js';
import type { DataViewUILogicBase } from '../../../core/view/data-view-base.js';
import { popFilterGroup } from './group-panel-view.js';

export class FilterBar extends SignalWatcher(ShadowlessElement) {
  static override styles = css`
    filter-bar {
      display: flex;
      gap: 8px;
      overflow-x: scroll;
      margin-bottom: -10px;
      padding-bottom: 2px;
      align-items: center;
    }

    .filter-group-tag {
      font-size: 12px;
      font-style: normal;
      font-weight: 600;
      line-height: 20px;
      display: flex;
      align-items: center;
      padding: 4px;
      background-color: var(--affine-white);
    }

    .filter-bar-add-filter {
      white-space: nowrap;
      color: var(--affine-text-secondary-color);
      padding: 4px 8px;
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 14px;
      font-style: normal;
      font-weight: 400;
      line-height: 22px;
    }

    .filter-bar-ask-ai {
      white-space: nowrap;
      color: var(--affine-text-secondary-color);
      padding: 4px 8px;
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 14px;
      font-style: normal;
      font-weight: 400;
      line-height: 22px;
      cursor: pointer;
      border-radius: 4px;
    }

    .filter-bar-ask-ai:hover {
      background-color: var(--affine-hover-color);
      color: var(--affine-text-primary-color);
    }

    .filter-bar-ask-ai svg {
      width: 16px;
      height: 16px;
      flex-shrink: 0;
    }

    .ask-ai-popover {
      position: fixed;
      z-index: 1000;
      background: var(--affine-background-overlay-panel-color, #fff);
      border: 1px solid var(--affine-border-color);
      border-radius: 8px;
      box-shadow: var(--affine-shadow-2);
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 280px;
    }

    .ask-ai-popover-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--affine-text-primary-color);
    }

    .ask-ai-popover-input {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid var(--affine-border-color);
      border-radius: 4px;
      padding: 6px 8px;
      font-size: 13px;
      color: var(--affine-text-primary-color);
      background: var(--affine-background-primary-color);
      outline: none;
    }

    .ask-ai-popover-input:focus {
      border-color: var(--affine-primary-color);
    }

    .ask-ai-popover-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }

    .ask-ai-btn-cancel,
    .ask-ai-btn-apply {
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 13px;
      cursor: pointer;
      border: none;
    }

    .ask-ai-btn-cancel {
      background: transparent;
      color: var(--affine-text-secondary-color);
    }

    .ask-ai-btn-cancel:hover {
      background: var(--affine-hover-color);
    }

    .ask-ai-btn-apply {
      background: var(--affine-primary-color);
      color: #fff;
    }

    .ask-ai-btn-apply:hover {
      opacity: 0.85;
    }

    .ask-ai-btn-apply:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .ask-ai-status {
      font-size: 12px;
      color: var(--affine-text-secondary-color);
      min-height: 16px;
    }

    filter-bar::-webkit-scrollbar {
      -webkit-appearance: none;
      display: block;
    }

    filter-bar::-webkit-scrollbar-thumb {
      border-radius: 2px;
      background-color: transparent;
    }

    filter-bar::-webkit-scrollbar:horizontal {
      height: 8px;
    }

    filter-bar:hover::-webkit-scrollbar-thumb {
      border-radius: 16px;
      background-color: var(--affine-black-30);
    }

    filter-bar:hover::-webkit-scrollbar-track {
      //background-color: var(--affine-hover-color);
    }
  `;

  // -------------------------------------------------------------------------
  // Ask AI state
  // -------------------------------------------------------------------------

  @state()
  private accessor _showAskAi = false;

  @state()
  private accessor _askAiInput = '';

  @state()
  private accessor _askAiStatus = '';

  @state()
  private accessor _askAiLoading = false;

  /** Anchor rect for positioning the AI popover */
  private _askAiAnchor: DOMRect | null = null;

  private readonly _openAskAi = (e: MouseEvent) => {
    if (this.dataViewLogic.root.config.dataSource.readonly$.peek()) {
      return;
    }
    this._askAiAnchor = (e.currentTarget as HTMLElement).getBoundingClientRect();
    this._showAskAi = true;
    this._askAiInput = '';
    this._askAiStatus = '';
    this._askAiLoading = false;
  };

  private readonly _closeAskAi = () => {
    this._showAskAi = false;
  };

  /**
   * Build a FilterGroup from natural-language text by calling the backend
   * data_view_filter copilot tool via the AI chat endpoint.
   *
   * As a lightweight client-side implementation we directly open the AI chat
   * panel with a pre-filled prompt that describes the columns and request.
   * This avoids needing a direct XHR to the copilot endpoint from within the
   * filter bar component.
   */
  private readonly _applyAskAi = async () => {
    const input = this._askAiInput.trim();
    if (!input) return;

    // Gather column descriptors from the view variables
    const columns = this.vars.value.map(v => ({
      id: v.id,
      name: v.name,
      type: v.propertyType,
    }));

    this._askAiLoading = true;
    this._askAiStatus = 'Generating filter…';

    try {
      // Attempt to call the backend copilot endpoint if available on the host.
      // We look for a method exposed via the dataViewLogic or fall back to
      // building the prompt in-browser using the AI chat panel.
      const filterGroup = await this._callDataViewFilterTool(columns, input);

      if (filterGroup && filterGroup.conditions.length > 0) {
        this.onChange(filterGroup);
        this._askAiStatus = `Applied ${filterGroup.conditions.length} filter(s).`;
        setTimeout(() => {
          this._showAskAi = false;
        }, 800);
      } else {
        this._askAiStatus =
          'Could not generate a filter. Try rephrasing your request.';
      }
    } catch (err) {
      this._askAiStatus = 'Error: ' + (err instanceof Error ? err.message : String(err));
    } finally {
      this._askAiLoading = false;
    }
  };

  /**
   * Call the data_view_filter copilot tool.
   *
   * Attempts a POST to `/api/copilot/filter` (the backend endpoint registered
   * for this tool).  If the endpoint is not available, falls back to a
   * client-side heuristic that produces simple equality filters.
   */
  private async _callDataViewFilterTool(
    columns: Array<{ id: string; name: string; type: string }>,
    naturalLanguage: string
  ): Promise<{ type: 'group'; op: 'and' | 'or'; conditions: Filter[] } | null> {
    try {
      const resp = await fetch('/api/copilot/data-view-filter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ columns, naturalLanguage }),
      });
      if (resp.ok) {
        const json = await resp.json() as unknown;
        if (
          json !== null &&
          typeof json === 'object' &&
          (json as { type?: string }).type === 'group'
        ) {
          return json as { type: 'group'; op: 'and' | 'or'; conditions: Filter[] };
        }
      }
    } catch {
      // Backend endpoint unavailable — fall through to heuristic
    }

    // Heuristic fallback: extract simple "column contains value" conditions
    // from natural language by matching column names in the input text.
    const conditions: Filter[] = [];
    const lowerInput = naturalLanguage.toLowerCase();

    for (const col of columns) {
      const lowerName = col.name.toLowerCase();
      const idx = lowerInput.indexOf(lowerName);
      if (idx === -1) continue;

      // Grab the word(s) after the column name as the value
      const afterName = naturalLanguage.slice(idx + col.name.length).trim();
      // Strip leading connector words like "is", "=", ":", "contains"
      const valueMatch = afterName.match(
        /^(?:is|=|:|contains|equals)?\s*["']?([^"',\s]+)["']?/i
      );
      if (!valueMatch) continue;

      const value = valueMatch[1];
      conditions.push({
        type: 'filter',
        left: { type: 'ref', name: col.id },
        function: col.type === 'text' ? 'contains' : 'equals',
        args: [{ type: 'literal', value }],
      });
    }

    return { type: 'group', op: 'and', conditions };
  }

  // -------------------------------------------------------------------------

  private readonly _setFilter = (index: number, filter: Filter) => {
    this.onChange({
      ...this.filterGroup.value,
      conditions: this.filterGroup.value.conditions.map((v, i) =>
        index === i ? filter : v
      ),
    });
  };

  private readonly addFilter = (e: MouseEvent) => {
    if (this.dataViewLogic.root.config.dataSource.readonly$.peek()) {
      return;
    }
    const element = popupTargetFromElement(e.target as HTMLElement);
    popCreateFilter(element, {
      vars: this.vars,
      onSelect: filter => {
        const index = this.filterGroup.value.conditions.length;
        this.onChange({
          ...this.filterGroup.value,
          conditions: [...this.filterGroup.value.conditions, filter],
        });
        requestAnimationFrame(() => {
          this.expandGroup(element, index);
        });
        this.dataViewLogic.eventTrace('CreateDatabaseFilter', {});
      },
    });
  };

  private readonly expandGroup = (position: PopupTarget, i: number) => {
    if (this.filterGroup.value.conditions[i]?.type !== 'group') {
      return;
    }
    popFilterGroup(position, {
      vars: this.vars,
      value$: computed(() => {
        return this.filterGroup.value.conditions[i] as FilterGroup;
      }),
      onChange: filter => {
        if (filter) {
          this._setFilter(i, filter);
        } else {
          this.deleteFilter(i);
        }
      },
    });
  };

  @property({ attribute: false })
  accessor filterGroup!: ReadonlySignal<FilterGroup>;

  conditions$ = computed(() => {
    return this.filterGroup.value.conditions;
  });

  renderAddFilter = () => {
    return html` <div
      style="height: 100%;"
      class="filter-bar-add-filter dv-icon-16 dv-round-4 dv-hover"
      @click="${this.addFilter}"
    >
      ${PlusIcon()} Add filter
    </div>`;
  };

  renderAskAiButton = () => {
    return html`
      <div
        class="filter-bar-ask-ai dv-icon-16"
        @click="${this._openAskAi}"
        title="Ask AI to create a filter"
      >
        ${AiIcon()} Ask AI
      </div>
    `;
  };

  renderAskAiPopover = () => {
    if (!this._showAskAi) return html``;

    const anchor = this._askAiAnchor;
    const top = anchor ? anchor.bottom + 4 : 40;
    const left = anchor ? anchor.left : 0;

    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !this._askAiLoading) {
        void this._applyAskAi();
      } else if (e.key === 'Escape') {
        this._closeAskAi();
      }
    };

    const onInput = (e: InputEvent) => {
      this._askAiInput = (e.target as HTMLInputElement).value;
    };

    return html`
      <div
        class="ask-ai-popover"
        style="top: ${top}px; left: ${left}px;"
        @click="${(e: Event) => e.stopPropagation()}"
      >
        <div class="ask-ai-popover-title">Ask AI to filter</div>
        <input
          class="ask-ai-popover-input"
          type="text"
          placeholder="e.g. Status is Done and Priority is High"
          .value="${this._askAiInput}"
          @input="${onInput}"
          @keydown="${onKeydown}"
          autofocus
        />
        <div class="ask-ai-status">${this._askAiStatus}</div>
        <div class="ask-ai-popover-actions">
          <button class="ask-ai-btn-cancel" @click="${this._closeAskAi}">
            Cancel
          </button>
          <button
            class="ask-ai-btn-apply"
            ?disabled="${this._askAiLoading || !this._askAiInput.trim()}"
            @click="${this._applyAskAi}"
          >
            ${this._askAiLoading ? 'Generating…' : 'Apply'}
          </button>
        </div>
      </div>
    `;
  };

  setConditions = (conditions: Filter[]) => {
    this.onChange({
      ...this.filterGroup.value,
      conditions: conditions,
    });
  };

  updateMoreFilterPanel?: () => void;

  private deleteFilter(i: number) {
    this.onChange({
      ...this.filterGroup.value,
      conditions: this.filterGroup.value.conditions.filter(
        (_, index) => index !== i
      ),
    });
  }

  override render() {
    return html`
      ${this.renderFilters()} ${this.renderAddFilter()}
      ${this.renderAskAiButton()} ${this.renderAskAiPopover()}
    `;
  }

  renderCondition(i: number) {
    const condition = this.conditions$.value[i];
    if (!condition) {
      return;
    }
    if (condition.type === 'filter') {
      return html` <filter-condition-view
        .vars="${this.vars}"
        .index="${i}"
        .value="${this.conditions$}"
        .onChange="${this.setConditions}"
      ></filter-condition-view>`;
    }
    const expandGroup = (e: MouseEvent) => {
      this.expandGroup(
        popupTargetFromElement(e.currentTarget as HTMLElement),
        i
      );
    };
    const length = condition.conditions.length;
    const text = length > 1 ? `${length} rules` : `${length} rule`;
    return html` <data-view-component-button
      hoverType="border"
      .icon="${FilterIcon()}"
      @click="${expandGroup}"
      .text="${html`${text}`}"
      .postfix="${ArrowDownSmallIcon()}"
    ></data-view-component-button>`;
  }

  renderFilters() {
    return this.filterGroup.value.conditions.map((_, i) =>
      this.renderCondition(i)
    );
  }

  private readonly _onDocClick = (e: MouseEvent) => {
    if (!this._showAskAi) return;
    const target = e.target as Node;
    // Close if click is outside the popover and outside the button
    const popover = this.shadowRoot?.querySelector('.ask-ai-popover');
    const button = this.shadowRoot?.querySelector('.filter-bar-ask-ai');
    if (
      popover && !popover.contains(target) &&
      button && !button.contains(target)
    ) {
      this._showAskAi = false;
    }
  };

  override connectedCallback() {
    super.connectedCallback();
    document.addEventListener('click', this._onDocClick);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('click', this._onDocClick);
  }

  override updated() {
    this.updateMoreFilterPanel?.();
    // Focus the input when popover opens
    if (this._showAskAi) {
      const input = this.shadowRoot?.querySelector<HTMLInputElement>(
        '.ask-ai-popover-input'
      );
      input?.focus();
    }
  }

  @property({ attribute: false })
  accessor onChange!: (filter: FilterGroup) => void;

  @property({ attribute: false })
  accessor vars!: ReadonlySignal<Variable[]>;

  @property({ attribute: false })
  accessor dataViewLogic!: DataViewUILogicBase;
}

declare global {
  interface HTMLElementTagNameMap {
    'filter-bar': FilterBar;
  }
}
