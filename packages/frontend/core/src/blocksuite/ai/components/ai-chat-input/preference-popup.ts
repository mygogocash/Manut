import type { AIToolsConfigService } from '@affine/core/modules/ai-button';
import type { AIModelService } from '@affine/core/modules/ai-button/services/models';
import type {
  ServerService,
  SubscriptionService,
} from '@affine/core/modules/cloud';
import {
  type CopilotChatHistoryFragment,
  ServerDeploymentType,
  SubscriptionStatus,
} from '@affine/graphql';
import {
  menu,
  popMenu,
  popupTargetFromElement,
} from '@blocksuite/affine/components/context-menu';
import { SignalWatcher, WithDisposable } from '@blocksuite/affine/global/lit';
import { unsafeCSSVarV2 } from '@blocksuite/affine/shared/theme';
import type { NotificationService } from '@blocksuite/affine-shared/services';
import {
  AiOutlineIcon,
  ArrowDownSmallIcon,
  CloudWorkspaceIcon,
  DoneIcon,
  LockIcon,
  ThinkingIcon,
} from '@blocksuite/icons/lit';
import { ShadowlessElement } from '@blocksuite/std';
import { autoPlacement, offset, shift } from '@floating-ui/dom';
import { computed } from '@preact/signals-core';
import { css, html } from 'lit';
import { property } from 'lit/decorators.js';

const modelSubMenuMiddleware = [
  autoPlacement({ allowedPlacements: ['right-start', 'left-start'] }),
  offset({ mainAxis: 4, crossAxis: 0 }),
  shift({ crossAxis: true, padding: 8 }),
];

// Hardcoded set of model IDs that should display a "Beta" badge in the
// model picker. Kept here (rather than as a field on AIModel) so this file
// can ship independently of any backend / models.ts change. When upstream
// adds an `isBeta` field on the GraphQL CopilotModelType, switch to that.
const BETA_MODEL_IDS = new Set<string>([
  'claude-opus-4',
  'claude-opus-4-7',
  'claude-sonnet-4-5',
  'claude-sonnet-4-5-20250929',
  'gemini-3.1-pro-preview',
  'gpt-5',
  'gpt-5-mini',
  'gpt-5-nano',
]);

/**
 * Family inference from model id/name. Defensive — falls back to 'Other'
 * for anything we don't recognise. The new providers Agent A is wiring
 * (Llama, Mistral, DeepSeek) will surface here automatically as long as
 * their id contains the family slug. When the backend exposes a `family`
 * field directly, we should prefer that and treat this as a fallback.
 */
type ModelFamily =
  | 'Auto'
  | 'Gemini'
  | 'Claude'
  | 'GPT'
  | 'Llama'
  | 'Mistral'
  | 'DeepSeek'
  | 'Other';

const FAMILY_ORDER: ModelFamily[] = [
  'Auto',
  'Gemini',
  'Claude',
  'GPT',
  'Llama',
  'Mistral',
  'DeepSeek',
  'Other',
];

function inferFamily(model: {
  id: string;
  name?: string;
  category?: string;
  family?: ModelFamily;
}): ModelFamily {
  // Prefer explicit field if present (defensive — Agent A may add this).
  if (model.family && FAMILY_ORDER.includes(model.family)) return model.family;
  if (model.id === 'auto') return 'Auto';
  const idLower = (model.id || '').toLowerCase();
  const nameLower = (
    (model.name || '') +
    ' ' +
    (model.category || '')
  ).toLowerCase();
  const haystack = `${idLower} ${nameLower}`;
  if (haystack.includes('gemini')) return 'Gemini';
  if (haystack.includes('claude')) return 'Claude';
  if (haystack.includes('gpt') || haystack.includes('openai')) return 'GPT';
  if (haystack.includes('llama') || haystack.includes('meta-')) return 'Llama';
  if (haystack.includes('mistral') || haystack.includes('mixtral'))
    return 'Mistral';
  if (haystack.includes('deepseek')) return 'DeepSeek';
  return 'Other';
}

/**
 * A small colored dot per family — simpler and theme-friendlier than
 * shipping per-vendor SVG logos (and avoids any logo licensing concerns).
 * The hex values are picked to be roughly recognisable but neutral.
 */
const FAMILY_DOT: Record<ModelFamily, string> = {
  Auto: '#888888',
  Gemini: '#4285f4',
  Claude: '#cc7c5e',
  GPT: '#10a37f',
  Llama: '#1877f2',
  Mistral: '#ff7000',
  DeepSeek: '#1e88e5',
  Other: '#999999',
};

/**
 * Tier inference. The new model shape will eventually surface a `tier`
 * field directly; until then we can guess from name/id. Returns null
 * when we can't tell — caller hides the badge in that case.
 */
function inferTier(model: {
  id: string;
  name?: string;
  tier?: 'Fast' | 'Balanced' | 'Max';
}): 'Fast' | 'Balanced' | 'Max' | null {
  if (model.tier) return model.tier;
  const haystack = `${model.id} ${model.name ?? ''}`.toLowerCase();
  if (
    haystack.includes('opus') ||
    haystack.includes('ultra') ||
    haystack.includes('max') ||
    haystack.includes('-pro')
  ) {
    return 'Max';
  }
  if (
    haystack.includes('haiku') ||
    haystack.includes('flash') ||
    haystack.includes('mini') ||
    haystack.includes('nano') ||
    haystack.includes('lite')
  ) {
    return 'Fast';
  }
  if (
    haystack.includes('sonnet') ||
    haystack.includes('balanced') ||
    haystack.includes('medium')
  ) {
    return 'Balanced';
  }
  return null;
}

export class ChatInputPreference extends SignalWatcher(
  WithDisposable(ShadowlessElement)
) {
  static override styles = css`
    .chat-input-preference-trigger {
      display: flex;
      align-items: center;
      padding: 0px 4px;
      color: var(--affine-v2-icon-primary);
      transition: all 0.23s ease;
      border-radius: 4px;
      background: transparent;
      border: none;
      cursor: pointer;
    }
    .chat-input-preference-trigger:hover {
      background-color: var(--affine-v2-layer-background-hoverOverlay);
    }
    .chat-input-preference-trigger-label {
      font-size: 14px;
      line-height: 22px;
      font-weight: 500;
      padding: 0px 4px;
    }
    .chat-input-preference-trigger-icon {
      font-size: 20px;
      line-height: 0;
    }
    .preference-action {
      white-space: nowrap;
      min-width: 220px;
    }
    .ai-active-model-name {
      font-size: 14px;
      color: ${unsafeCSSVarV2('text/secondary')};
      line-height: 22px;
      margin-left: 40px;
    }
    .ai-model-prefix {
      width: 20px;
      height: 20px;
    }
    .ai-model-prefix svg {
      color: ${unsafeCSSVarV2('icon/activated')};
    }
    .ai-model-postfix svg:hover {
      color: ${unsafeCSSVarV2('icon/activated')};
    }
    .ai-model-version {
      font-size: 12px;
      color: ${unsafeCSSVarV2('text/tertiary')};
      line-height: 20px;
      margin-right: 40px;
    }
    .ai-model-beta-badge {
      display: inline-block;
      font-size: 10px;
      text-transform: uppercase;
      color: ${unsafeCSSVarV2('button/secondary')};
      background: ${unsafeCSSVarV2('layer/insideBorder/border')};
      padding: 1px 4px;
      border-radius: 3px;
      margin-left: 6px;
      line-height: 14px;
    }
    /* Tier badge — sits next to the version string. Three tiers, three
       muted background tones so the eye can scan a list quickly without
       any single badge overpowering the model name. */
    .ai-model-tier-badge {
      display: inline-block;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 1px 5px;
      border-radius: 3px;
      margin-left: 6px;
      line-height: 14px;
      font-weight: 600;
    }
    .ai-model-tier-badge[data-tier='Fast'] {
      background: rgba(16, 163, 127, 0.12);
      color: #10a37f;
    }
    .ai-model-tier-badge[data-tier='Balanced'] {
      background: rgba(66, 133, 244, 0.12);
      color: #4285f4;
    }
    .ai-model-tier-badge[data-tier='Max'] {
      background: rgba(204, 124, 94, 0.16);
      color: #b86844;
    }
    /* Family dot — replaces vendor logos for a clean, neutral marker.
       Sized to match the existing prefix slot so layout stays tidy. */
    .ai-family-dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
      margin-right: 8px;
    }
    .ai-auto-sublabel {
      display: block;
      font-size: 11px;
      color: ${unsafeCSSVarV2('text/tertiary')};
      line-height: 14px;
      margin-top: 1px;
    }
  `;

  @property({ attribute: false })
  accessor session!: CopilotChatHistoryFragment | null | undefined;
  // --------- model props end ---------

  // --------- extended thinking props start ---------
  @property({ attribute: false })
  accessor extendedThinking: boolean = false;

  @property({ attribute: false })
  accessor onExtendedThinkingChange:
    | ((extendedThinking: boolean) => void)
    | undefined;
  // --------- extended thinking props end ---------

  @property({ attribute: false })
  accessor serverService!: ServerService;

  @property({ attribute: false })
  accessor toolsConfigService!: AIToolsConfigService;

  @property({ attribute: false })
  accessor notificationService!: NotificationService;

  @property({ attribute: false })
  accessor subscriptionService!: SubscriptionService;

  @property({ attribute: false })
  accessor aiModelService!: AIModelService;

  @property({ attribute: false })
  accessor onAISubscribe!: () => Promise<void>;

  model = computed(() => {
    const modelId = this.aiModelService.modelId.value;
    const activeModel = this.aiModelService.models.value.find(
      model => model.id === modelId
    );
    const defaultModel = this.aiModelService.models.value.find(
      model => model.isDefault
    );
    return activeModel || defaultModel;
  });

  openPreference(e: Event) {
    const element = e.currentTarget;
    if (!(element instanceof HTMLElement)) return;
    const modelItems = [];
    const searchItems = [];

    // Group all available models by family for the picker. The Auto entry
    // appears as its own group at the top with a sublabel explaining what
    // it does — matching the pattern in ChatGPT/Claude.
    const isSelfHosted =
      this.serverService.server.config$.value?.type ===
      ServerDeploymentType.Selfhosted;
    const status = this.subscriptionService.subscription.ai$.value?.status;
    const isSubscribed = status === SubscriptionStatus.Active;

    const buildAction = (
      model: ReturnType<typeof this.aiModelService.models.value.at>
    ) => {
      if (!model) return null;
      const isSelected = model.id === this.model.value?.id;
      const tier = inferTier(model as { id: string; name?: string });
      const family = inferFamily(
        model as {
          id: string;
          name?: string;
          category?: string;
        }
      );
      const isAuto = model.id === 'auto';
      return menu.action({
        name: isAuto ? 'Auto' : model.category,
        info: html`
          ${isAuto
            ? html`<span class="ai-auto-sublabel">
                Smart routing — picks the best model for each task
              </span>`
            : html`<span class="ai-model-version">${model.version}</span> ${tier
                  ? html`<span class="ai-model-tier-badge" data-tier=${tier}>
                      ${tier}
                    </span>`
                  : ''}
                ${BETA_MODEL_IDS.has(model.id)
                  ? html`<span class="ai-model-beta-badge">Beta</span>`
                  : ''}`}
        `,
        prefix: html`
          <div class="ai-model-prefix">
            ${isSelected
              ? DoneIcon()
              : html`<span
                  class="ai-family-dot"
                  style="background:${FAMILY_DOT[family]}"
                ></span>`}
          </div>
        `,
        postfix: html`
          <div class="ai-model-postfix" @click=${this.onAISubscribe}>
            ${model.isPro && !isSelfHosted && !isSubscribed
              ? LockIcon()
              : undefined}
          </div>
        `,
        select: () => {
          if (model.isPro && !isSelfHosted && !isSubscribed) {
            this.notificationService.toast(
              `Pro models require an AFFiNE AI subscription.`
            );
            return;
          }
          this.aiModelService.setModel(model.id);
        },
      });
    };

    // Build family → models mapping in the canonical order so the picker
    // is stable across renders even if the backend returns models in a
    // different order each call.
    const grouped = new Map<
      ModelFamily,
      typeof this.aiModelService.models.value
    >();
    for (const m of this.aiModelService.models.value) {
      const fam = inferFamily(
        m as {
          id: string;
          name?: string;
          category?: string;
        }
      );
      const bucket = grouped.get(fam);
      if (bucket) {
        bucket.push(m);
      } else {
        grouped.set(fam, [m]);
      }
    }

    const groupedItems: Array<ReturnType<typeof menu.group>> = [];
    for (const fam of FAMILY_ORDER) {
      const list = grouped.get(fam);
      if (!list || list.length === 0) continue;
      groupedItems.push(
        menu.group({
          name: fam,
          items: list.map(buildAction).filter(Boolean) as ReturnType<
            typeof menu.action
          >[],
        })
      );
    }

    modelItems.push(
      menu.subMenu({
        name: 'Model',
        prefix: AiOutlineIcon(),
        middleware: modelSubMenuMiddleware,
        postfix: html`
          <span class="ai-active-model-name"> ${this.model.value?.name} </span>
        `,
        options: {
          items: groupedItems,
        },
      })
    );

    modelItems.push(
      menu.toggleSwitch({
        name: 'Extended Thinking',
        prefix: ThinkingIcon(),
        on: this.extendedThinking,
        onChange: (value: boolean) => this.onExtendedThinkingChange?.(value),
        class: { 'preference-action': true },
      })
    );

    searchItems.push(
      menu.toggleSwitch({
        name: 'Workspace All Docs',
        prefix: CloudWorkspaceIcon(),
        on:
          !!this.toolsConfigService.config.value.searchWorkspace &&
          !!this.toolsConfigService.config.value.readingDocs,
        onChange: (value: boolean) =>
          this.toolsConfigService.setConfig({
            searchWorkspace: value,
            readingDocs: value,
          }),
        class: { 'preference-action': true },
      })
    );

    popMenu(popupTargetFromElement(element), {
      options: {
        items: [
          menu.group({
            items: [...modelItems],
          }),
          menu.group({
            items: [...searchItems],
          }),
        ],
        testId: 'chat-input-preference',
      },
    });
  }

  override render() {
    return html`<button
      @click=${this.openPreference}
      data-testid="chat-input-preference-trigger"
      class="chat-input-preference-trigger"
    >
      <span class="chat-input-preference-trigger-label">
        ${this.model.value?.category}
      </span>
      <span class="chat-input-preference-trigger-icon">
        ${ArrowDownSmallIcon()}
      </span>
    </button>`;
  }
}
