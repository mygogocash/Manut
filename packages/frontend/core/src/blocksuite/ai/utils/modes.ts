// Mode -> tool-set mapping for the chat input preference popup.
//
// Three preset modes (Read / Edit / Agent) project onto the canonical
// backend tool union (PromptToolsSchema in
// packages/backend/server/src/plugins/copilot/providers/types.ts). The
// frontend Mode picker maps to ChatPermissionMode in preference-popup
// (read-only / edit-doc / full-agent), and that maps to the
// editingDocs / composingDocs / editingDataViews flags on the
// AIToolsConfig — which the backend then translates back into
// PromptTools[] via getTools() in copilot/utils.ts.
//
// This file is the single source of truth for the Mode picker's tool
// list. The Advanced caret in preference-popup uses MODE_TOOL_SET[mode]
// as the initial checked state, and the user can deviate per-tool —
// at which point we emit the per-tool list as enabledTools and the
// backend filters dispatch by membership.
//
// Tool name canonical form matches the backend PromptTools enum
// (camelCase: docRead, webSearch, etc.) — NOT the snake_case form the
// epic plan hints at. That form would require translating in both
// directions; staying camelCase keeps the gate cheap and lets the
// existing prompt-config tool lists round-trip without translation.

// Canonical AI tool name (mirrors backend PromptToolsSchema in
// providers/types.ts). Kept here as a literal union rather than
// importing from the backend to avoid pulling a backend-only module
// into the frontend bundle.
export type AIToolName =
  | 'blobRead'
  | 'codeArtifact'
  | 'conversationSummary'
  | 'docEdit'
  | 'docRead'
  | 'docCreate'
  | 'docUpdate'
  | 'docUpdateMeta'
  | 'docKeywordSearch'
  | 'docSemanticSearch'
  | 'webSearch'
  | 'docCompose'
  | 'sectionEdit'
  | 'dataViewFilter'
  | 'dataViewAutofillColumn';

export type ChatMode = 'read' | 'edit' | 'agent';

const READ_TOOLS: readonly AIToolName[] = [
  'docRead',
  'docKeywordSearch',
  'docSemanticSearch',
  'webSearch',
] as const;

const EDIT_TOOLS: readonly AIToolName[] = [
  ...READ_TOOLS,
  'docEdit',
  'sectionEdit',
  'dataViewFilter',
] as const;

const AGENT_TOOLS: readonly AIToolName[] = [
  ...EDIT_TOOLS,
  'docCreate',
  'docUpdate',
  'docUpdateMeta',
  'docCompose',
  'dataViewAutofillColumn',
] as const;

export const MODE_TOOL_SET: Record<ChatMode, readonly AIToolName[]> = {
  read: READ_TOOLS,
  edit: EDIT_TOOLS,
  agent: AGENT_TOOLS,
};

export const DEFAULT_MODE: ChatMode = 'edit';

// The full set of tools the Advanced view lists, in display order.
// Same order as the AIToolName union so the checkbox grid is stable.
export const ALL_TOOLS: readonly AIToolName[] = [
  'docRead',
  'docKeywordSearch',
  'docSemanticSearch',
  'webSearch',
  'docEdit',
  'sectionEdit',
  'dataViewFilter',
  'docCreate',
  'docUpdate',
  'docUpdateMeta',
  'docCompose',
  'dataViewAutofillColumn',
] as const;

// Human-readable labels for the Advanced view's checkbox rows. Falls
// back to the raw tool name if absent (so adding a new backend tool
// without updating this map still produces a clickable row).
export const TOOL_LABELS: Partial<Record<AIToolName, string>> = {
  docRead: 'Read docs',
  docKeywordSearch: 'Keyword search',
  docSemanticSearch: 'Semantic search',
  webSearch: 'Web search',
  docEdit: 'Edit doc',
  sectionEdit: 'Edit section',
  dataViewFilter: 'Filter data view',
  docCreate: 'Create doc',
  docUpdate: 'Update doc',
  docUpdateMeta: 'Update doc metadata',
  docCompose: 'Compose new doc',
  dataViewAutofillColumn: 'Autofill data column',
};

// Map a ChatMode to its default enabledTools list (the persisted
// per-tool state when the user picks a Mode without overriding).
export function defaultEnabledTools(mode: ChatMode): AIToolName[] {
  return [...MODE_TOOL_SET[mode]];
}
