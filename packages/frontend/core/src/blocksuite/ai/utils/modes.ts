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
  | 'docHybridSearch'
  | 'docKeywordSearch'
  | 'docSemanticSearch'
  | 'webSearch'
  | 'docCompose'
  | 'sectionEdit'
  | 'dataViewFilter'
  | 'dataViewAutofillColumn'
  // M3 E3.2 — Vertex Imagen text-to-image. Only available in Agent
  // mode; the Image format chip in the chat input also flips this on
  // so the AI selects the tool for the next reply.
  | 'imageGen'
  // M3 E3.1 — Remote code execution in a Modal sandbox. Privileged:
  // Agent mode only. Gracefully no-ops when `MODAL_API_TOKEN` is
  // unset, so showing the option is safe even on installs that
  // haven't provisioned Modal.
  | 'codeRun'
  // M1 B10 / E1.8 — Gmail search via the existing Google OAuth
  // scaffold. Read-only; gated on the user having connected Gmail
  // under Settings > Integrations.
  | 'gmailSearch'
  // M1 B10 / E1.8 — Workspace-linked calendar events read from the
  // Postgres-cached calendarEvent table. Read-only.
  | 'calendarSearch'
  // M2 E2.1 — GitHub read-only tools via the v1.13.0 GitHub OAuth
  // scaffold. Gated on the user having connected GitHub under
  // Settings > Integrations.
  | 'githubSearchIssues'
  | 'githubReadIssue'
  | 'githubSearchRepos'
  | 'githubReadPr';

export type ChatMode = 'read' | 'edit' | 'agent';

const READ_TOOLS: readonly AIToolName[] = [
  'docRead',
  'docHybridSearch',
  'docKeywordSearch',
  'docSemanticSearch',
  'webSearch',
  // Gmail + Calendar reads are non-mutating personal-data lookups —
  // safe to expose at every Mode level once the user has connected the
  // accounts in Settings > Integrations.
  'gmailSearch',
  'calendarSearch',
  // GitHub reads — same reasoning as Gmail/Calendar above. All four
  // are non-mutating; gated on the user having connected GitHub.
  'githubSearchIssues',
  'githubReadIssue',
  'githubSearchRepos',
  'githubReadPr',
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
  'imageGen',
  'codeRun',
] as const;

export const MODE_TOOL_SET: Record<ChatMode, readonly AIToolName[]> = {
  read: READ_TOOLS,
  edit: EDIT_TOOLS,
  agent: AGENT_TOOLS,
};

// M5: default to 'read' so a fresh/empty config is consistently
// Read-only across BOTH the Mode picker label and the Advanced
// submenu's default checked set. The label derives from the
// tools-config write flags (all default false -> deriveMode() ->
// "read-only"); the Advanced default set is defaultEnabledTools(
// DEFAULT_MODE). With 'edit' here the two disagreed — the label read
// "Read-only" while the submenu pre-checked Edit-mode write tools.
// 'read' matches the documented "existing users get read-only on
// upgrade" intent (see editingDocs/composingDocs/editingDataViews
// defaulting to false in modules/ai-button/services/tools-config.ts).
export const DEFAULT_MODE: ChatMode = 'read';

// The full set of tools the Advanced view lists, in display order.
// Same order as the AIToolName union so the checkbox grid is stable.
export const ALL_TOOLS: readonly AIToolName[] = [
  'docRead',
  'docHybridSearch',
  'docKeywordSearch',
  'docSemanticSearch',
  'webSearch',
  'gmailSearch',
  'calendarSearch',
  'githubSearchIssues',
  'githubReadIssue',
  'githubSearchRepos',
  'githubReadPr',
  'docEdit',
  'sectionEdit',
  'dataViewFilter',
  'docCreate',
  'docUpdate',
  'docUpdateMeta',
  'docCompose',
  'dataViewAutofillColumn',
  'imageGen',
  'codeRun',
] as const;

// Human-readable labels for the Advanced view's checkbox rows. Falls
// back to the raw tool name if absent (so adding a new backend tool
// without updating this map still produces a clickable row).
export const TOOL_LABELS: Partial<Record<AIToolName, string>> = {
  docRead: 'Read docs',
  docHybridSearch: 'Hybrid search',
  docKeywordSearch: 'Keyword search',
  docSemanticSearch: 'Semantic search',
  webSearch: 'Web search',
  gmailSearch: 'Search Gmail',
  calendarSearch: 'Search Calendar',
  githubSearchIssues: 'Search GitHub issues',
  githubReadIssue: 'Read GitHub issue',
  githubSearchRepos: 'Search GitHub repos',
  githubReadPr: 'Read GitHub PR',
  docEdit: 'Edit doc',
  sectionEdit: 'Edit section',
  dataViewFilter: 'Filter data view',
  docCreate: 'Create doc',
  docUpdate: 'Update doc',
  docUpdateMeta: 'Update doc metadata',
  docCompose: 'Compose new doc',
  dataViewAutofillColumn: 'Autofill data column',
  imageGen: 'Generate image',
  codeRun: 'Run code',
};

// Map a ChatMode to its default enabledTools list (the persisted
// per-tool state when the user picks a Mode without overriding).
export function defaultEnabledTools(mode: ChatMode): AIToolName[] {
  return [...MODE_TOOL_SET[mode]];
}

// Model family taxonomy for the chat input's Model picker submenu.
// Used to GROUP optional models in the preference popup so the user sees
// "Auto" at top, then Gemini, Claude, Llama, and "Other" sections — instead
// of one flat alphabetical list. Detection is best-effort against model.id
// prefixes; matches CHAT_PROMPT.optionalModels in
// packages/backend/server/src/plugins/copilot/prompt/prompts.ts.
export type ChatModelFamily = 'auto' | 'gemini' | 'claude' | 'llama' | 'other';

export const CHAT_MODEL_FAMILY_LABELS: Record<ChatModelFamily, string> = {
  auto: 'Auto',
  gemini: 'Gemini',
  claude: 'Claude',
  llama: 'Llama',
  other: 'Other',
};

// Stable render order so the submenu is deterministic regardless of the
// order the backend returns optionalModels in.
export const CHAT_MODEL_FAMILY_ORDER: readonly ChatModelFamily[] = [
  'auto',
  'gemini',
  'claude',
  'llama',
  'other',
] as const;

// Map a model id (e.g. "claude-sonnet-4-5@20250929") or the synthetic
// "auto" entry to the family it belongs to. Matches the prefix conventions
// the Vertex provider lists use today; falls back to 'other' for direct
// OpenAI-compat vendors like kimi-k2 / grok-4 / qwen3.
export function getChatModelFamily(modelId: string): ChatModelFamily {
  const id = modelId.toLowerCase();
  if (id === 'auto') return 'auto';
  if (id.startsWith('gemini')) return 'gemini';
  if (id.startsWith('claude')) return 'claude';
  if (id.startsWith('llama')) return 'llama';
  return 'other';
}
