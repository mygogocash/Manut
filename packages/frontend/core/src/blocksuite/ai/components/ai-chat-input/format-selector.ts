// Output-format chip dropdown that sits alongside the chat input
// preference picker. The chip surfaces the active format (Auto by
// default) and opens a popMenu with five options — Auto / List /
// Table / Code / Image. All five are live as of M3 E3.2: the Image
// option flips a flag that biases the backend tool dispatch toward
// `image_gen` (Vertex Imagen 3) for the next reply.
//
// Epic E1.10 — T-1.10.2. The selector is a Lit element so it can mount
// inside the existing AIChatInput render tree (which is already Lit).
// Following the CLAUDE.md scar: no backticks inside css`...` or
// html`...` template literals (silent build break in v1.9.0).

import {
  menu,
  popMenu,
  popupTargetFromElement,
} from '@blocksuite/affine/components/context-menu';
import { SignalWatcher, WithDisposable } from '@blocksuite/affine/global/lit';
import { unsafeCSSVarV2 } from '@blocksuite/affine/shared/theme';
import { ShadowlessElement } from '@blocksuite/std';
import { autoPlacement, offset, shift } from '@floating-ui/dom';
import { css, html } from 'lit';
import { property } from 'lit/decorators.js';

import {
  DEFAULT_FORMAT,
  isFormatEnabled,
  OUTPUT_FORMAT_OPTIONS,
  type OutputFormat,
} from '../../utils/format-prompt';

// Same submenu placement middleware used by preference-popup so the
// popover lands in a predictable spot relative to the trigger.
const formatMenuMiddleware = [
  autoPlacement({ allowedPlacements: ['top-start', 'bottom-start'] }),
  offset({ mainAxis: 6, crossAxis: 0 }),
  shift({ crossAxis: true, padding: 8 }),
];

export class FormatSelector extends SignalWatcher(
  WithDisposable(ShadowlessElement)
) {
  static override styles = css`
    .format-selector-trigger {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 6px;
      border-radius: 4px;
      background: transparent;
      border: none;
      color: var(--affine-v2-icon-primary);
      cursor: pointer;
      transition: background-color 0.16s ease;
      font-size: 13px;
      line-height: 20px;
      font-weight: 500;
    }
    .format-selector-trigger:hover {
      background-color: var(--affine-v2-layer-background-hoverOverlay);
    }
    .format-selector-trigger[data-active='true'] {
      color: ${unsafeCSSVarV2('icon/activated')};
    }
    .format-selector-trigger-label {
      font-size: 13px;
      line-height: 20px;
      font-weight: 500;
    }
    .format-selector-trigger-caret {
      font-size: 0;
      line-height: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 12px;
      height: 12px;
    }
    .format-option-sublabel {
      display: block;
      font-size: 12px;
      line-height: 16px;
      color: ${unsafeCSSVarV2('text/tertiary')};
      white-space: normal;
      max-width: 240px;
    }
    .format-option-disabled-badge {
      display: inline-block;
      font-size: 10px;
      line-height: 14px;
      text-transform: uppercase;
      color: ${unsafeCSSVarV2('button/secondary')};
      background: ${unsafeCSSVarV2('layer/insideBorder/border')};
      padding: 1px 4px;
      border-radius: 3px;
      margin-left: 6px;
    }
  `;

  // Selected format. Caller-controlled so the AIChatInput owns
  // persistence and request-time wiring. We render the trigger label
  // off this value and emit `onChange` when the user picks a new one.
  @property({ attribute: false })
  accessor format: OutputFormat = DEFAULT_FORMAT;

  @property({ attribute: false })
  accessor onChange: ((format: OutputFormat) => void) | undefined;

  // Optional aria-label override for screen readers — defaults to a
  // descriptive English string.
  @property({ attribute: 'aria-label', reflect: true })
  accessor ariaLabel = 'Output format';

  private get _activeLabel(): string {
    const option = OUTPUT_FORMAT_OPTIONS.find(o => o.format === this.format);
    return option?.label ?? 'Auto';
  }

  private readonly _openMenu = (event: Event) => {
    const trigger = event.currentTarget;
    if (!(trigger instanceof HTMLElement)) return;

    popMenu(popupTargetFromElement(trigger), {
      options: {
        items: OUTPUT_FORMAT_OPTIONS.map(option => {
          const enabled = isFormatEnabled(option.format);
          const isSelected = option.format === this.format;
          return menu.action({
            name: option.label,
            isSelected,
            info: html`
              <span class="format-option-sublabel">${option.description}</span>
              ${enabled
                ? ''
                : html`<span class="format-option-disabled-badge">Soon</span>`}
            `,
            select: () => {
              if (!enabled) {
                // Surface a no-op so the menu closes but no state changes.
                // The chip stays on whatever the previous selection was.
                return;
              }
              this.format = option.format;
              this.onChange?.(option.format);
            },
            // The Affine context-menu builder doesn't expose a native
            // disabled flag on action items, so we lean on the early
            // return in select() above. The badge tells users why
            // they can't actually pick the row.
            class: {
              'format-option-row': true,
              'format-option-disabled': !enabled,
            },
          });
        }),
        testId: 'chat-input-format-selector',
      },
      middleware: formatMenuMiddleware,
    });
  };

  override render() {
    const isActive = this.format !== DEFAULT_FORMAT;
    return html`<button
      class="format-selector-trigger"
      data-active=${isActive}
      data-testid="chat-input-format-selector-trigger"
      @click=${this._openMenu}
    >
      <span class="format-selector-trigger-label">${this._activeLabel}</span>
      <span class="format-selector-trigger-caret" aria-hidden="true">
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M2 4l3 3 3-3"
            stroke="currentColor"
            stroke-width="1.4"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </span>
    </button>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'chat-input-format-selector': FormatSelector;
  }
}
