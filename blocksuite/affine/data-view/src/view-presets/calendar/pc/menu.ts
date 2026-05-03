import { css } from '@emotion/css';
import { html, LitElement, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import type { CalendarSingleView } from '../calendar-view-manager.js';

// ─── styles ───────────────────────────────────────────────────────────────

const menuPanelStyle = css`
  position: absolute;
  top: 100%;
  right: 0;
  z-index: 100;
  background: var(--affine-background-overlay-panel-color, #fff);
  border: 1px solid var(--affine-border-color, #e3e3e3);
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  padding: 12px;
  min-width: 220px;
`;

const menuSectionLabelStyle = css`
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--affine-text-secondary-color, #888);
  margin-bottom: 6px;
  margin-top: 0;
`;

const menuSectionStyle = css`
  &:not(:first-child) {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--affine-border-color, #e3e3e3);
  }
`;

const menuItemStyle = css`
  display: block;
  width: 100%;
  text-align: left;
  appearance: none;
  border: 1px solid transparent;
  background: transparent;
  color: inherit;
  border-radius: 6px;
  padding: 5px 8px;
  cursor: pointer;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  &:hover {
    background: var(--affine-hover-color, rgba(0, 0, 0, 0.04));
  }
`;

const menuItemActiveStyle = css`
  background: var(--affine-hover-color, rgba(0, 0, 0, 0.06));
  font-weight: 600;
  border-color: var(--affine-border-color, #e3e3e3);
`;

const modeButtonGroupStyle = css`
  display: flex;
  gap: 4px;
`;

const modeButtonStyle = css`
  flex: 1;
  appearance: none;
  border: 1px solid var(--affine-border-color, #e3e3e3);
  background: transparent;
  color: inherit;
  border-radius: 6px;
  padding: 5px 4px;
  cursor: pointer;
  font-size: 12px;
  text-align: center;
  &:hover {
    background: var(--affine-hover-color, rgba(0, 0, 0, 0.04));
  }
`;

const modeButtonActiveStyle = css`
  background: var(--affine-primary-color, #1e90ff);
  color: #fff;
  border-color: var(--affine-primary-color, #1e90ff);
  &:hover {
    background: var(--affine-primary-color, #1e90ff);
  }
`;

// ─── Component ────────────────────────────────────────────────────────────

@customElement('affine-data-view-calendar-settings-menu')
export class CalendarViewSettingsMenu extends LitElement {
  // Disable Shadow DOM so Emotion CSS classes apply correctly (same approach
  // as other components in this package that use @emotion/css).
  override createRenderRoot() {
    return this;
  }

  @property({ attribute: false })
  accessor view!: CalendarSingleView;

  // ─── outside-click close ──────────────────────────────────────────────

  private readonly _outsideClickHandler = (e: MouseEvent) => {
    if (!this.contains(e.target as Node)) {
      this.dispatchEvent(new CustomEvent('close', { bubbles: true }));
    }
  };

  override connectedCallback(): void {
    super.connectedCallback();
    // Defer so the click that opened the menu doesn't immediately close it.
    setTimeout(() => {
      document.addEventListener('click', this._outsideClickHandler);
    }, 0);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('click', this._outsideClickHandler);
  }

  // ─── handlers ─────────────────────────────────────────────────────────

  private _selectDateColumn(id: string | undefined) {
    this.view.setDateColumnId(id);
    this.requestUpdate();
  }

  private _selectEndDateColumn(id: string | undefined) {
    this.view.setEndDateColumnId(id);
    this.requestUpdate();
  }

  private _selectMode(mode: 'month' | 'week' | 'day') {
    this.view.setDisplayMode(mode);
    this.requestUpdate();
  }

  // ─── render ───────────────────────────────────────────────────────────

  override render(): TemplateResult {
    const dateProps = this.view.propertiesRaw$.value.filter(
      p => p.type$.value === 'date'
    );
    const currentDateColId = this.view.dateColumnId$.value;
    const currentEndDateColId = this.view.endDateColumnId$.value;
    const currentMode = this.view.displayMode$.value;

    const modes: { key: 'month' | 'week' | 'day'; label: string }[] = [
      { key: 'month', label: 'Month' },
      { key: 'week', label: 'Week' },
      { key: 'day', label: 'Day' },
    ];

    return html`
      <div class=${menuPanelStyle}>
        <!-- Date column section -->
        <div class=${menuSectionStyle}>
          <div class=${menuSectionLabelStyle}>Date column</div>
          <button
            class=${[
              menuItemStyle,
              currentDateColId == null ? menuItemActiveStyle : '',
            ].join(' ')}
            @click=${() => this._selectDateColumn(undefined)}
          >
            None
          </button>
          ${dateProps.map(p => {
            const isActive = p.id === currentDateColId;
            return html`
              <button
                class=${[
                  menuItemStyle,
                  isActive ? menuItemActiveStyle : '',
                ].join(' ')}
                title=${p.name$.value}
                @click=${() => this._selectDateColumn(p.id)}
              >
                ${p.name$.value}
              </button>
            `;
          })}
          ${dateProps.length === 0
            ? html`<div
                style="font-size:12px;color:var(--affine-text-secondary-color,#888);padding:4px 8px;"
              >
                No date properties
              </div>`
            : ''}
        </div>

        <!-- End date column section -->
        <div class=${menuSectionStyle}>
          <div class=${menuSectionLabelStyle}>End date column</div>
          <button
            class=${[
              menuItemStyle,
              currentEndDateColId == null ? menuItemActiveStyle : '',
            ].join(' ')}
            @click=${() => this._selectEndDateColumn(undefined)}
          >
            (none)
          </button>
          ${dateProps.map(p => {
            const isActive = p.id === currentEndDateColId;
            return html`
              <button
                class=${[
                  menuItemStyle,
                  isActive ? menuItemActiveStyle : '',
                ].join(' ')}
                title=${p.name$.value}
                @click=${() => this._selectEndDateColumn(p.id)}
              >
                ${p.name$.value}
              </button>
            `;
          })}
          ${dateProps.length === 0
            ? html`<div
                style="font-size:12px;color:var(--affine-text-secondary-color,#888);padding:4px 8px;"
              >
                No date properties
              </div>`
            : ''}
        </div>

        <!-- Display mode section -->
        <div class=${menuSectionStyle}>
          <div class=${menuSectionLabelStyle}>Display mode</div>
          <div class=${modeButtonGroupStyle}>
            ${modes.map(
              m => html`
                <button
                  class=${[
                    modeButtonStyle,
                    m.key === currentMode ? modeButtonActiveStyle : '',
                  ].join(' ')}
                  @click=${() => this._selectMode(m.key)}
                >
                  ${m.label}
                </button>
              `
            )}
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'affine-data-view-calendar-settings-menu': CalendarViewSettingsMenu;
  }
}
