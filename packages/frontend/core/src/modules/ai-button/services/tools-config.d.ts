import { type Signal } from '@blocksuite/affine/shared/utils';
import { Service } from '@toeverything/infra';
import type { GlobalStateService } from '../../storage';
export type ChatModePreset = 'read' | 'edit' | 'agent';
export interface AIToolsConfig {
    searchWorkspace?: boolean;
    readingDocs?: boolean;
    editingDocs?: boolean;
    composingDocs?: boolean;
    editingDataViews?: boolean;
    requireToolApproval?: boolean;
    enabledTools?: string[];
}
export declare class AIToolsConfigService extends Service {
    private readonly globalStateService;
    constructor(globalStateService: GlobalStateService);
    config: Signal<AIToolsConfig>;
    private readonly config$;
    setConfig: (data: Partial<AIToolsConfig>) => void;
    getChatMode(workspaceId: string): ChatModePreset | undefined;
    setChatMode(workspaceId: string, mode: ChatModePreset): void;
    watchChatMode(workspaceId: string): import("rxjs").Observable<ChatModePreset | undefined>;
    getEnabledTools(workspaceId: string): string[] | undefined;
    setEnabledTools(workspaceId: string, tools: readonly string[]): void;
    watchEnabledTools(workspaceId: string): import("rxjs").Observable<string[] | undefined>;
}
//# sourceMappingURL=tools-config.d.ts.map