import type { FeatureFlagService } from '@affine/core/modules/feature-flag';
import { WithDisposable } from '@blocksuite/affine/global/lit';
import type { ColorScheme } from '@blocksuite/affine/model';
import { ShadowlessElement } from '@blocksuite/affine/std';
import type { ExtensionType } from '@blocksuite/affine/store';
import type { Signal } from '@preact/signals-core';
import { css, html } from 'lit';
import { property } from 'lit/decorators.js';

import { createTextRenderer } from '../../components/text-renderer';

export class ChatContentRichText extends WithDisposable(ShadowlessElement) {
  /* Pure visual polish for the assistant's answer body.
     The renderer is BlockSuite (not plain `<pre><code>`), so we lean on
     the rendered DOM classes that AFFiNE exposes:
       - inline code → `affine-text` with `code` style flag (rendered as
         `<code>` inside `v-element`) — give it a subtle background.
       - tables → `affine-table-block` containers — borders + zebra rows.
     Styles are scoped to `chat-content-rich-text` to avoid bleeding into
     the document editor when we share the same renderer. */
  static override styles = css`
    chat-content-rich-text {
      /* Inline code (markdown backticks) — match Claude.ai's subtle pill. */
      .ai-answer-text-editor code {
        background: var(
          --affine-background-secondary-color,
          rgba(0, 0, 0, 0.04)
        );
        padding: 1px 5px;
        border-radius: 4px;
        font-family: var(
          --affine-font-code-family,
          'SFMono-Regular',
          Menlo,
          monospace
        );
        font-size: 0.92em;
        border: 0.5px solid var(--affine-border-color, rgba(0, 0, 0, 0.06));
      }
      /* Code blocks already use affine-code which has its own background.
         Don't double up: only style standalone <code> NOT inside affine-code. */
      .ai-answer-text-editor affine-code code,
      .ai-answer-text-editor pre code {
        background: transparent;
        padding: 0;
        border: none;
        border-radius: 0;
        font-size: inherit;
      }

      /* Tables — borders and zebra striping. AFFiNE's table renders as
         an affine-table-block element with a regular table inside in
         display mode. (Avoid backticks here — this comment lives inside
         a lit css template literal, so any backtick would close it and
         the rest would be parsed as JS expressions.) */
      .ai-answer-text-editor affine-table-block table,
      .ai-answer-text-editor table {
        border-collapse: collapse;
        margin: 8px 0;
        font-size: 13px;
        width: auto;
      }
      .ai-answer-text-editor affine-table-block th,
      .ai-answer-text-editor affine-table-block td,
      .ai-answer-text-editor table th,
      .ai-answer-text-editor table td {
        border: 1px solid var(--affine-border-color, rgba(0, 0, 0, 0.12));
        padding: 6px 10px;
        text-align: left;
      }
      .ai-answer-text-editor affine-table-block th,
      .ai-answer-text-editor table th {
        background: var(
          --affine-background-secondary-color,
          rgba(0, 0, 0, 0.04)
        );
        font-weight: 600;
      }
      .ai-answer-text-editor affine-table-block tbody tr:nth-child(even) td,
      .ai-answer-text-editor table tbody tr:nth-child(even) td {
        background: var(
          --affine-background-secondary-color,
          rgba(0, 0, 0, 0.02)
        );
      }
    }
  `;

  @property({ attribute: false })
  accessor text!: string;

  @property({ attribute: false })
  accessor state: 'finished' | 'generating' = 'finished';

  @property({ attribute: false })
  accessor extensions!: ExtensionType[];

  @property({ attribute: false })
  accessor affineFeatureFlagService!: FeatureFlagService;

  @property({ attribute: false })
  accessor theme!: Signal<ColorScheme>;

  protected override render() {
    const { text } = this;
    return html`${createTextRenderer({
      customHeading: true,
      extensions: this.extensions,
      affineFeatureFlagService: this.affineFeatureFlagService,
      theme: this.theme,
      scrollable: false,
    })(text, this.state)}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'chat-content-rich-text': ChatContentRichText;
  }
}
