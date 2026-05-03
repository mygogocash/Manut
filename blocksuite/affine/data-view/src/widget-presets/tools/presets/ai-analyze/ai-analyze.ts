import { unsafeCSSVarV2 } from '@blocksuite/affine-shared/theme';
import type { EditorHost } from '@blocksuite/std';
import { css, html, svg } from 'lit';

import { WidgetBase } from '../../../../core/widget/widget-base.js';

// Inline sparkle/star icon used for "Analyze with AI" — avoids a hard
// dependency on @blocksuite/affine/components/icons from within data-view.
const SparkleIcon = svg`
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M10 2.5L11.55 7.45L16.5 9L11.55 10.55L10 15.5L8.45 10.55L3.5 9L8.45 7.45L10 2.5Z" />
    <path d="M15.5 14L16.25 16.25L18.5 17L16.25 17.75L15.5 20L14.75 17.75L12.5 17L14.75 16.25L15.5 14Z" />
    <path d="M4.5 1L5.25 3.25L7.5 4L5.25 4.75L4.5 7L3.75 4.75L1.5 4L3.75 3.25L4.5 1Z" />
  </svg>
`;

const styles = css`
  .affine-database-toolbar-item.ai-analyze {
    padding: 2px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    cursor: pointer;
    color: ${unsafeCSSVarV2('icon/primary')};
  }

  .affine-database-toolbar-item.ai-analyze:hover {
    background: var(--affine-hover-color);
  }
`;

export class DataViewHeaderToolsAIAnalyze extends WidgetBase {
  static override styles = styles;

  private readonly _handleAnalyzeWithAI = () => {
    // Dynamically import AIProvider to avoid a hard compile-time dependency
    // from the blocksuite data-view package onto the AFFiNE core AI package.
    // The host is resolved at runtime by walking up the shadow DOM to the
    // nearest `editor-host` element. The cross-package import is intentional
    // (data-view ships inside @affine/core's bundle) so silence the
    // dependency-graph rule.
    // eslint-disable-next-line import-x/no-extraneous-dependencies
    import(
      /* webpackChunkName: "ai-provider" */
      '@affine/core/blocksuite/ai/provider'
    )
      .then(({ AIProvider }) => {
        const host = this.closest('editor-host') as EditorHost | null;

        if (!host) return;

        const viewName = this.view.name$.value ?? 'this database';

        AIProvider.slots.requestOpenWithChat.next({
          host,
          input: `Analyze this database and provide insights about the data: ${viewName}`,
        });
      })
      .catch(() => {
        // AIProvider not available in this environment (e.g. blocksuite standalone mode)
      });
  };

  override render() {
    if (this.view.readonly$.value) {
      return;
    }
    return html`
      <div
        class="affine-database-toolbar-item ai-analyze"
        title="Analyze with AI"
        @click="${this._handleAnalyzeWithAI}"
      >
        ${SparkleIcon}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'data-view-header-tools-ai-analyze': DataViewHeaderToolsAIAnalyze;
  }
}
