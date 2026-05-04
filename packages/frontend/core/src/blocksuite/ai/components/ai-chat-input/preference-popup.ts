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
import { I18n } from '@affine/i18n';
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
  EditIcon,
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

// Best-effort mapping from model.category (the human-facing brand prefix the
// service derives from model.name) to a display "provider" string used in the
// Beta tooltip. Falls back to the category itself if not in the map.
function getProviderLabel(category: string | undefined): string {
  if (!category) return 'the model provider';
  const c = category.toLowerCase();
  if (c.startsWith('claude')) return 'Anthropic';
  if (c.startsWith('gpt') || c.startsWith('openai') || c === 'o1' || c === 'o3')
    return 'OpenAI';
  if (c.startsWith('gemini')) return 'Google';
  return category;
}

// ε-AI-INTEL v1.10: permission modes for AI write tools. Each mode maps
// to a fixed combination of write-flag values on AIToolsConfig. We treat
// the tuple of (editingDocs, composingDocs, editingDataViews) as the mode
// identity, so flipping any individual flag falls back to the matching
// preset (or "custom" when no preset matches — currently the picker
// always sets one of the three presets).
type ChatPermissionMode = 'read-only' | 'edit-doc' | 'full-agent';

interface ChatPermissionModeFlags {
  editingDocs: boolean;
  composingDocs: boolean;
  editingDataViews: boolean;
}

const CHAT_PERMISSION_MODE_FLAGS: Record<
  ChatPermissionMode,
  ChatPermissionModeFlags
> = {
  // Default. No write tools — AI can search and read but not change anything.
  'read-only': {
    editingDocs: false,
    composingDocs: false,
    editingDataViews: false,
  },
  // Edit current doc — AI can modify the doc the user is working in
  // (doc-edit, section-edit, doc-write) but cannot create new docs or
  // touch data views.
  'edit-doc': {
    editingDocs: true,
    composingDocs: false,
    editingDataViews: false,
  },
  // Full agent — all write groups enabled.
  'full-agent': {
    editingDocs: true,
    composingDocs: true,
    editingDataViews: true,
  },
};

function deriveMode(flags: {
  editingDocs?: boolean;
  composingDocs?: boolean;
  editingDataViews?: boolean;
}): ChatPermissionMode {
  const editing = !!flags.editingDocs;
  const composing = !!flags.composingDocs;
  const dataView = !!flags.editingDataViews;
  if (editing && composing && dataView) return 'full-agent';
  if (editing && !composing && !dataView) return 'edit-doc';
  // Anything else collapses to read-only — including the default
  // (all false) and any unexpected partial states.
  return 'read-only';
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
      cursor: help;
    }
    .ai-pref-toggle-label {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .ai-pref-toggle-label-title {
      font-size: 14px;
      line-height: 20px;
      color: inherit;
    }
    .ai-pref-toggle-label-sub {
      font-size: 12px;
      line-height: 16px;
      color: ${unsafeCSSVarV2('text/tertiary')};
      white-space: normal;
    }
    /* ε-AI-INTEL v1.10: sub-label styling for the Mode picker rows. */
    .ai-pref-mode-sublabel {
      display: block;
      font-size: 12px;
      line-height: 16px;
      color: ${unsafeCSSVarV2('text/tertiary')};
      white-space: normal;
      max-width: 280px;
      margin-right: 12px;
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

  // ε-AI-INTEL v1.10: derive the current mode from the live tools-config
  // signal so the menu re-renders the right "Mode → <Name>" label and the
  // sub-menu's check-marks track external updates.
  currentMode = computed<ChatPermissionMode>(() => {
    const cfg = this.toolsConfigService.config.value;
    return deriveMode({
      editingDocs: cfg.editingDocs,
      composingDocs: cfg.composingDocs,
      editingDataViews: cfg.editingDataViews,
    });
  });

  openPreference(e: Event) {
    const element = e.currentTarget;
    if (!(element instanceof HTMLElement)) return;
    const modeItems = [];
    const modelItems = [];
    const searchItems = [];

    // ε-AI-INTEL v1.10: Mode picker. Sits above the Model group so the
    // user picks "what AI is allowed to do" before "which model does it".
    const activeMode = this.currentMode.value;
    const setMode = (mode: ChatPermissionMode) => {
      this.toolsConfigService.setConfig(CHAT_PERMISSION_MODE_FLAGS[mode]);
    };
    const modeOptions: Array<{
      mode: ChatPermissionMode;
      label: string;
      sublabel: string;
    }> = [
      {
        mode: 'read-only',
        label: I18n.t('com.affine.ai.preference.mode.read-only.label'),
        sublabel: I18n.t('com.affine.ai.preference.mode.read-only.sublabel'),
      },
      {
        mode: 'edit-doc',
        label: I18n.t('com.affine.ai.preference.mode.edit-doc.label'),
        sublabel: I18n.t('com.affine.ai.preference.mode.edit-doc.sublabel'),
      },
      {
        mode: 'full-agent',
        label: I18n.t('com.affine.ai.preference.mode.full-agent.label'),
        sublabel: I18n.t('com.affine.ai.preference.mode.full-agent.sublabel'),
      },
    ];
    const activeModeLabel =
      modeOptions.find(option => option.mode === activeMode)?.label ?? '';
    modeItems.push(
      menu.subMenu({
        name: I18n.t('com.affine.ai.preference.mode.label'),
        prefix: EditIcon(),
        middleware: modelSubMenuMiddleware,
        postfix: html`
          <span class="ai-active-model-name">${activeModeLabel}</span>
        `,
        options: {
          items: modeOptions.map(option => {
            const isSelected = option.mode === activeMode;
            return menu.action({
              name: option.label,
              info: html`
                <span class="ai-pref-mode-sublabel">${option.sublabel}</span>
              `,
              prefix: html`
                <div class="ai-model-prefix">
                  ${isSelected ? DoneIcon() : undefined}
                </div>
              `,
              select: () => setMode(option.mode),
            });
          }),
        },
      })
    );

    // model switch
    modelItems.push(
      menu.subMenu({
        name: 'Model',
        prefix: AiOutlineIcon(),
        middleware: modelSubMenuMiddleware,
        postfix: html`
          <span class="ai-active-model-name"> ${this.model.value?.name} </span>
        `,
        options: {
          items: this.aiModelService.models.value.map(model => {
            const isSelected = model.id === this.model.value?.id;
            const isSelfHosted =
              this.serverService.server.config$.value?.type ===
              ServerDeploymentType.Selfhosted;
            const status =
              this.subscriptionService.subscription.ai$.value?.status;
            const isSubscribed = status === SubscriptionStatus.Active;
            const isBeta = BETA_MODEL_IDS.has(model.id);
            const betaTooltip = isBeta
              ? I18n.t('com.affine.ai.model.beta-tooltip', {
                  provider: getProviderLabel(model.category),
                })
              : '';
            const handleLockClick = (ev: Event) => {
              // Stop the row's select handler from also firing
              ev.stopPropagation();
              ev.preventDefault();
              const proLockedTitle = I18n.t(
                'com.affine.payment.ai.pro-locked.title'
              );
              const upgradeLabel = I18n.t(
                'com.affine.payment.ai.pro-locked.upgrade'
              );
              // Surface a confirm dialog acting as the popover: clear copy +
              // an explicit "Upgrade" CTA that triggers the existing
              // subscription flow.
              this.notificationService
                .confirm({
                  title: proLockedTitle,
                  message: '',
                  confirmText: upgradeLabel,
                  cancelText: 'Cancel',
                })
                .then(confirmed => {
                  if (confirmed) {
                    return this.onAISubscribe();
                  }
                  return undefined;
                })
                .catch(() => {
                  // Surfacing failures here would double-toast on top of the
                  // subscribe flow's own error handling.
                });
            };
            return menu.action({
              name: model.category,
              info: html`
                <span class="ai-model-version">${model.version}</span>
                ${isBeta
                  ? html`<span
                      class="ai-model-beta-badge"
                      title=${betaTooltip}
                      aria-label=${betaTooltip}
                      >Beta</span
                    >`
                  : ''}
              `,
              prefix: html`
                <div class="ai-model-prefix">
                  ${isSelected ? DoneIcon() : undefined}
                </div>
              `,
              postfix: html`
                <div class="ai-model-postfix" @click=${handleLockClick}>
                  ${model.isPro && !isSelfHosted && !isSubscribed
                    ? LockIcon()
                    : undefined}
                </div>
              `,
              select: () => {
                if (model.isPro && !isSelfHosted && !isSubscribed) {
                  this.notificationService.toast(
                    I18n.t('com.affine.payment.ai.pro-locked.title')
                  );
                  return;
                }
                this.aiModelService.setModel(model.id);
              },
            });
          }),
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
        name: 'Search workspace docs',
        label: () => html`
          <div class="ai-pref-toggle-label">
            <span class="ai-pref-toggle-label-title">
              ${I18n.t('com.affine.ai.preference.search-workspace.label')}
            </span>
            <span class="ai-pref-toggle-label-sub">
              ${I18n.t('com.affine.ai.preference.search-workspace.sublabel')}
            </span>
          </div>
        `,
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
          // ε-AI-INTEL v1.10: Mode group first so it's the most prominent
          // control. Picking a mode rewrites the editing flags atomically.
          menu.group({
            items: [...modeItems],
          }),
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
