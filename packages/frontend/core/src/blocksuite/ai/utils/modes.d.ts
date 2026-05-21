export type AIToolName = 'blobRead' | 'codeArtifact' | 'conversationSummary' | 'docEdit' | 'docRead' | 'docCreate' | 'docUpdate' | 'docUpdateMeta' | 'docKeywordSearch' | 'docSemanticSearch' | 'webSearch' | 'docCompose' | 'sectionEdit' | 'dataViewFilter' | 'dataViewAutofillColumn' | 'imageGen' | 'codeRun' | 'gmailSearch' | 'calendarSearch' | 'githubSearchIssues' | 'githubReadIssue' | 'githubSearchRepos' | 'githubReadPr';
export type ChatMode = 'read' | 'edit' | 'agent';
export declare const MODE_TOOL_SET: Record<ChatMode, readonly AIToolName[]>;
export declare const DEFAULT_MODE: ChatMode;
export declare const ALL_TOOLS: readonly AIToolName[];
export declare const TOOL_LABELS: Partial<Record<AIToolName, string>>;
export declare function defaultEnabledTools(mode: ChatMode): AIToolName[];
//# sourceMappingURL=modes.d.ts.map