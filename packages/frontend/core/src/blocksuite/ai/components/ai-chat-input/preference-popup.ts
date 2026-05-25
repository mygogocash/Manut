import type { AIToolsConfigService } from '@affine/core/modules/ai-button';
import { isAIModelProLocked } from '@affine/core/modules/ai-button/services/model-access';
import type { AIModelService } from '@affine/core/modules/ai-button/services/models';
import type {
  ServerService,
  SubscriptionService,
} from '@affine/core/modules/cloud';
import { type CopilotChatHistoryFragment } from '@affine/graphql';
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

import {
  type AIToolName,
  ALL_TOOLS,
  CHAT_MODEL_FAMILY_LABELS,
  CHAT_MODEL_FAMILY_ORDER,
  type ChatMode,
  type ChatModelFamily,
  DEFAULT_MODE,
  defaultEnabledTools,
  getChatModelFamily,
  MODE_TOOL_SET,
  TOOL_LABELS,
} from '../../utils/modes';

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

  // ε-AI-INTEL B8 / Epic E1.6: workspace-scoped ChatMode + enabledTools.
  // Reads + writes go through AIToolsConfigService.get/setChatMode and
  // .get/setEnabledTools (which persist to GlobalStateService under
  // chatMode.<workspaceId> + chatEnabledTools.<workspaceId>). The
  // current session's workspaceId is the scope key; popup re-renders
  // pick up changes via the SignalWatcher mixin.
  private get _workspaceId(): string | undefined {
    return this.session?.workspaceId;
  }

  private _getCurrentChatMode(): ChatMode {
    const wsId = this._workspaceId;
    if (!wsId) return DEFAULT_MODE;
    const stored = this.toolsConfigService.getChatMode(wsId);
    return stored ?? DEFAULT_MODE;
  }

  private _getCurrentEnabledTools(): readonly AIToolName[] {
    const wsId = this._workspaceId;
    if (!wsId) return defaultEnabledTools(DEFAULT_MODE);
    const stored = this.toolsConfigService.getEnabledTools(wsId);
    if (stored) return stored as readonly AIToolName[];
    return defaultEnabledTools(this._getCurrentChatMode());
  }

  private _setChatMode(mode: ChatMode) {
    const wsId = this._workspaceId;
    if (!wsId) return;
    this.toolsConfigService.setChatMode(wsId, mode);
    // Picking a mode resets enabledTools to that mode's defaults.
    const tools = [...MODE_TOOL_SET[mode]];
    this.toolsConfigService.setEnabledTools(wsId, tools);
    // Echo to the workspace-agnostic AIToolsConfig so the chat request
    // payload (which reads `config.value`) carries the same array. The
    // legacy editing flags are written by `setMode` in openPreference
    // — this only adds the new `enabledTools` field.
    this.toolsConfigService.setConfig({ enabledTools: tools });
  }

  private _toggleTool(tool: AIToolName, enabled: boolean) {
    const wsId = this._workspaceId;
    if (!wsId) return;
    const current = this._getCurrentEnabledTools();
    const without = current.filter(t => t !== tool);
    const next = enabled ? [...without, tool] : without;
    this.toolsConfigService.setEnabledTools(wsId, next);
    this.toolsConfigService.setConfig({ enabledTools: next });
  }

  openPreference(e: Event) {
    const element = e.currentTarget;
    if (!(element instanceof HTMLElement)) return;
    const modeItems = [];
    const modelItems = [];
    const searchItems = [];

    // ε-AI-INTEL v1.10: Mode picker. Sits above the Model group so the
    // user picks "what AI is allowed to do" before "which model does it".
    // ε-AI-INTEL B8 / Epic E1.6: in addition to the legacy editing-flag
    // toggle (which keeps backwards compat with the v1.10 toolsConfig
    // surface), each mode pick now ALSO writes the new per-workspace
    // ChatMode + enabledTools state so the Advanced submenu's per-tool
    // checkboxes start from the right baseline.
    const activeMode = this.currentMode.value;
    const PERMISSION_TO_CHAT_MODE: Record<ChatPermissionMode, ChatMode> = {
      'read-only': 'read',
      'edit-doc': 'edit',
      'full-agent': 'agent',
    };
    const setMode = (mode: ChatPermissionMode) => {
      this.toolsConfigService.setConfig(CHAT_PERMISSION_MODE_FLAGS[mode]);
      this._setChatMode(PERMISSION_TO_CHAT_MODE[mode]);
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

    // ε-AI-INTEL B8 / Epic E1.6: "Advanced" submenu listing per-tool
    // checkboxes. The initial checked state comes from the mode's
    // default tool set (via MODE_TOOL_SET) unless the user has stored
    // an explicit override in chatEnabledTools.<workspaceId>. Toggling
    // an individual checkbox only updates enabledTools — the mode pick
    // above stays whatever it was. The toggle reads fresh state on
    // every click so the menu never drifts from the persisted store.
    const enabledTools = this._getCurrentEnabledTools();
    const enabledToolsSet = new Set<AIToolName>(enabledTools);
    const advancedItems = ALL_TOOLS.map(tool =>
      menu.toggleSwitch({
        name: TOOL_LABELS[tool] ?? tool,
        prefix: EditIcon(),
        on: enabledToolsSet.has(tool),
        onChange: (value: boolean) => this._toggleTool(tool, value),
        class: { 'preference-action': true },
      })
    );
    modeItems.push(
      menu.subMenu({
        name: 'Advanced',
        prefix: EditIcon(),
        middleware: modelSubMenuMiddleware,
        postfix: html`
          <span class="ai-active-model-name">
            ${enabledToolsSet.size}/${ALL_TOOLS.length}
          </span>
        `,
        options: {
          items: advancedItems,
        },
      })
    );

    // model switch — group the submenu items by family (Auto / Gemini /
    // Claude / Llama / Other) so the picker stays readable as we add more
    // optionalModels per CHAT_PROMPT in
    // packages/backend/server/src/plugins/copilot/prompt/prompts.ts.
    // Auto sits at the top with a "Smart routing" sublabel; clicking it
    // sends modelId='auto' which the backend's ScenarioClassifier resolves
    // per request. The Pro lock chip and the Beta badge logic are preserved
    // from the flat version below.
    const allModels = this.aiModelService.models.value;
    const serverConfig = this.serverService.server.config$.value;
    const status = this.subscriptionService.subscription.ai$.value?.status;
    const handleLockClick = (ev: Event) => {
      // Stop the row's select handler from also firing
      ev.stopPropagation();
      ev.preventDefault();
      const proLockedTitle = I18n.t('com.affine.payment.ai.pro-locked.title');
      const upgradeLabel = I18n.t('com.affine.payment.ai.pro-locked.upgrade');
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
    const buildModelRow = (model: (typeof allModels)[number]) => {
      const isSelected = model.id === this.model.value?.id;
      const isBeta = BETA_MODEL_IDS.has(model.id);
      const isLocked = isAIModelProLocked(model, {
        serverType: serverConfig?.type,
        serverFeatures: serverConfig?.features,
        aiSubscriptionStatus: status,
      });
      const betaTooltip = isBeta
        ? I18n.t('com.affine.ai.model.beta-tooltip', {
            provider: getProviderLabel(model.category),
          })
        : '';
      // Auto entry shows "Smart routing" as its sub-label instead of a
      // version string — it doesn't have a single model behind it.
      const isAuto = model.id === 'auto';
      return menu.action({
        name: isAuto ? CHAT_MODEL_FAMILY_LABELS.auto : model.category,
        info: html`
          <span class="ai-model-version">
            ${isAuto ? 'Smart routing' : model.version}
          </span>
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
            ${isLocked ? LockIcon() : undefined}
          </div>
        `,
        select: () => {
          if (isLocked) {
            this.notificationService.toast(
              I18n.t('com.affine.payment.ai.pro-locked.title')
            );
            return;
          }
          this.aiModelService.setModel(model.id);
        },
      });
    };
    // Partition by family while preserving the order the backend returned
    // optionalModels in (so users see the same lead model first within
    // each section as the canonical list in prompts.ts).
    const byFamily = new Map<ChatModelFamily, typeof allModels>();
    for (const model of allModels) {
      const family = getChatModelFamily(model.id);
      const bucket = byFamily.get(family) ?? [];
      bucket.push(model);
      byFamily.set(family, bucket);
    }
    const modelSubmenuItems = CHAT_MODEL_FAMILY_ORDER.flatMap(family => {
      const bucket = byFamily.get(family);
      if (!bucket || bucket.length === 0) return [];
      // Auto is presented as the topmost row WITHOUT a section heading —
      // it's the default and treated as "no override". Every other family
      // gets a labelled group divider so the user can scan by brand.
      // Static English labels here (CHAT_MODEL_FAMILY_LABELS) keep the
      // change off the i18n resource files; localised labels can land in
      // a follow-up by reading `com.affine.ai.model.family.<family>`.
      const groupName =
        family === 'auto' ? undefined : CHAT_MODEL_FAMILY_LABELS[family];
      return [
        menu.group({
          name: groupName,
          items: bucket.map(buildModelRow),
        }),
      ];
    });
    modelItems.push(
      menu.subMenu({
        name: 'Model',
        prefix: AiOutlineIcon(),
        middleware: modelSubMenuMiddleware,
        postfix: html`
          <span class="ai-active-model-name"> ${this.model.value?.name} </span>
        `,
        options: {
          items: modelSubmenuItems,
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

    // M3: opt this chat session into per-tool approval gates. The
    // backend gate is also keyed off any workspace-level pending
    // approval, so this toggle is the "always force review for THIS
    // session" override rather than the only on-ramp.
    const approvalItems = [
      menu.toggleSwitch({
        name: 'Require approval before write tools',
        label: () => html`
          <div class="ai-pref-toggle-label">
            <span class="ai-pref-toggle-label-title">
              Require approval before write tools
            </span>
            <span class="ai-pref-toggle-label-sub">
              Every doc-edit, doc-create, and data-view write in this chat waits
              for a human approval. Track decisions in Settings → Control Plane
              → Approvals.
            </span>
          </div>
        `,
        prefix: LockIcon(),
        on: !!this.toolsConfigService.config.value.requireToolApproval,
        onChange: (value: boolean) =>
          this.toolsConfigService.setConfig({
            requireToolApproval: value,
          }),
        class: { 'preference-action': true },
      }),
    ];

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
          menu.group({
            items: [...approvalItems],
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
