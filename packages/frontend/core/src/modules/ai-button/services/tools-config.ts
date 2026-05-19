import {
  createSignalFromObservable,
  type Signal,
} from '@blocksuite/affine/shared/utils';
import { LiveData, Service } from '@toeverything/infra';
import { map } from 'rxjs';

import type { GlobalStateService } from '../../storage';

const AI_TOOLS_CONFIG_KEY = 'AIToolsConfig';

// ε-AI-INTEL B8 / Epic E1.6: per-workspace chat-mode + enabledTools.
// Stored under separate keys so the legacy AIToolsConfig migration
// path is undisturbed, and so two workspaces hold independent
// selections without cross-talk.
const CHAT_MODE_KEY_PREFIX = 'chatMode.';
const CHAT_ENABLED_TOOLS_KEY_PREFIX = 'chatEnabledTools.';

export type ChatModePreset = 'read' | 'edit' | 'agent';

function chatModeKey(workspaceId: string): string {
  return CHAT_MODE_KEY_PREFIX + workspaceId;
}

function chatEnabledToolsKey(workspaceId: string): string {
  return CHAT_ENABLED_TOOLS_KEY_PREFIX + workspaceId;
}

function isChatModePreset(value: unknown): value is ChatModePreset {
  return value === 'read' || value === 'edit' || value === 'agent';
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(v => typeof v === 'string');
}

export interface AIToolsConfig {
  searchWorkspace?: boolean;
  readingDocs?: boolean;
  // ε-AI-INTEL v1.10: write-tool flags. Default `false` so existing users keep
  // Read-only behavior on upgrade. Each flag opts the chat session into a
  // group of backend tools.
  // - editingDocs   → enables doc-edit, section-edit, doc-write
  //                   (docCreate/docUpdate/docUpdateMeta).
  // - composingDocs → enables doc-compose (creates new docs from prompts).
  // - editingDataViews → enables data-view-filter and
  //                      data-view-autofill-column.
  editingDocs?: boolean;
  composingDocs?: boolean;
  editingDataViews?: boolean;
  // M3: when true, every write-tool call in this chat session emits a
  // pending TOOL_CALL_REVIEW approval before the side-effect runs.
  // Default `false` so the workspace-default behaviour is unchanged.
  requireToolApproval?: boolean;
  // ε-AI-INTEL B8 / Epic E1.6: per-tool allowlist. When present, the
  // backend filters the prompt's declared tool set by membership in
  // this array (see `getTools()` in copilot/utils.ts). Populated from
  // the Mode picker's defaults and the Advanced submenu per-tool
  // checkboxes. Echoed onto this workspace-agnostic key so the chat
  // request payload — which reads `aiToolsConfigService.config.value`
  // — picks it up without the request path needing to know about the
  // per-workspace store directly.
  enabledTools?: string[];
}

export class AIToolsConfigService extends Service {
  constructor(private readonly globalStateService: GlobalStateService) {
    super();

    const { signal, cleanup: enabledCleanup } =
      createSignalFromObservable<AIToolsConfig>(this.config$, {
        searchWorkspace: true,
        readingDocs: true,
        editingDocs: false,
        composingDocs: false,
        editingDataViews: false,
        requireToolApproval: false,
      });
    this.config = signal;
    this.disposables.push(enabledCleanup);
  }

  config: Signal<AIToolsConfig>;

  private readonly config$ = LiveData.from(
    this.globalStateService.globalState.watch<AIToolsConfig>(
      AI_TOOLS_CONFIG_KEY
    ),
    undefined
  ).pipe(
    map(config => ({
      searchWorkspace: config?.searchWorkspace ?? true,
      readingDocs: config?.readingDocs ?? true,
      // Default `false` for write flags — existing users get Read-only mode
      // after the v1.10 upgrade and must explicitly opt in.
      editingDocs: config?.editingDocs ?? false,
      composingDocs: config?.composingDocs ?? false,
      editingDataViews: config?.editingDataViews ?? false,
      // M3: defaults to workspace-default (false) — only opt-in surfaces
      // approval gates on every tool call.
      requireToolApproval: config?.requireToolApproval ?? false,
      // ε-AI-INTEL B8: omit when undefined so the backend keeps using
      // the legacy flag-based mapping. The popup writes this when the
      // user picks a mode or toggles a per-tool checkbox.
      enabledTools: config?.enabledTools,
    }))
  );

  setConfig = (data: Partial<AIToolsConfig>) => {
    this.globalStateService.globalState.set(AI_TOOLS_CONFIG_KEY, {
      ...this.config.value,
      ...data,
    });
  };

  // ε-AI-INTEL B8: read the persisted ChatMode for a workspace. Returns
  // `undefined` if the user hasn't picked one yet, so the caller can
  // apply its own default (DEFAULT_MODE in modes.ts).
  getChatMode(workspaceId: string): ChatModePreset | undefined {
    const raw = this.globalStateService.globalState.get<unknown>(
      chatModeKey(workspaceId)
    );
    return isChatModePreset(raw) ? raw : undefined;
  }

  setChatMode(workspaceId: string, mode: ChatModePreset): void {
    this.globalStateService.globalState.set(chatModeKey(workspaceId), mode);
  }

  watchChatMode(workspaceId: string) {
    return this.globalStateService.globalState.watch<ChatModePreset>(
      chatModeKey(workspaceId)
    );
  }

  // ε-AI-INTEL B8: read the per-tool enabledTools list. `undefined`
  // means "no override stored" — callers should fall back to the
  // mode's defaults.
  getEnabledTools(workspaceId: string): string[] | undefined {
    const raw = this.globalStateService.globalState.get<unknown>(
      chatEnabledToolsKey(workspaceId)
    );
    return isStringArray(raw) ? raw : undefined;
  }

  setEnabledTools(workspaceId: string, tools: readonly string[]): void {
    this.globalStateService.globalState.set(chatEnabledToolsKey(workspaceId), [
      ...tools,
    ]);
  }

  watchEnabledTools(workspaceId: string) {
    return this.globalStateService.globalState.watch<string[]>(
      chatEnabledToolsKey(workspaceId)
    );
  }
}
