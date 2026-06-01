import type { PromptMessage } from '../providers/types.js';
import type { ToolsConfig } from '../types.js';

/**
 * Maps a chat mode name to a system-prompt addendum string.
 *
 * Modes are appended to the system prompt of the "Chat With AFFiNE AI"
 * prompt template via the {{modeAddendum}} placeholder. Unknown modes and
 * the "default" mode return an empty string so the prompt is unchanged.
 */
export type ChatMode = 'default' | 'concise' | 'creative';

const MODE_ADDENDA: Record<ChatMode, string> = {
  default: '',
  concise: 'Be concise and direct. Use short paragraphs. Avoid filler.',
  creative:
    'Be more exploratory. Suggest unconventional angles. Use vivid language.',
};

/**
 * Returns the system-prompt addendum for the given mode name.
 *
 * - Unrecognised values fall back to '' (no change).
 * - Comparison is case-insensitive and tolerant of leading/trailing whitespace.
 */
export function getModeAddendum(mode: string | undefined | null): string {
  if (!mode) return '';
  const normalised = mode.trim().toLowerCase();
  if (normalised in MODE_ADDENDA) {
    return MODE_ADDENDA[normalised as ChatMode];
  }
  return '';
}

/**
 * Type guard for a known ChatMode value. Useful when validating query input.
 */
export function isChatMode(
  value: string | undefined | null
): value is ChatMode {
  if (!value) return false;
  return value.trim().toLowerCase() in MODE_ADDENDA;
}

type PermissionMode = 'read' | 'edit' | 'agent';

const PERMISSION_MODE_ADDENDA: Record<PermissionMode, string> = {
  read: [
    'Read mode: answer from available context and tools without making changes.',
    'Search/read workspace sources before answering workspace-specific questions.',
    'Do not call write tools or imply you changed docs, databases, metadata, files, or external accounts.',
    'Cite workspace, file, web, or connected-account sources for factual claims.',
    'Keep the answer direct: short summary first, then only the details needed.',
  ].join('\n'),
  edit: [
    'Edit current doc mode: you may edit the current document or selected content only.',
    'Read the current document or relevant workspace sources before changing content.',
    'Do not create new documents, update metadata, edit data views, or use external write actions unless the user explicitly asks.',
    'After a write tool succeeds, summarize exactly what changed and cite sources used for factual claims.',
    'Keep the answer direct and include only necessary follow-up steps.',
  ].join('\n'),
  agent: [
    'Full Agent mode: you may combine available read, write, code, image, and connected-account tools to complete the task.',
    'Use tools deliberately: retrieve evidence first, execute the smallest useful action, then report tool results clearly.',
    'Keep final answers source-grounded with citations for factual workspace or external claims.',
    'Ask before destructive, irreversible, or broad external-account actions.',
    'Keep the user-facing answer streamlined: outcome, sources, tool results, and next blocker if any.',
  ].join('\n'),
};

function permissionModeFromToolsConfig(
  toolsConfig?: Pick<
    ToolsConfig,
    'editingDocs' | 'composingDocs' | 'editingDataViews'
  >
): PermissionMode {
  const editingDocs = !!toolsConfig?.editingDocs;
  const composingDocs = !!toolsConfig?.composingDocs;
  const editingDataViews = !!toolsConfig?.editingDataViews;

  if (editingDocs && composingDocs && editingDataViews) {
    return 'agent';
  }
  if (editingDocs && !composingDocs && !editingDataViews) {
    return 'edit';
  }
  return 'read';
}

export function getPermissionModeAddendum(
  toolsConfig?: Pick<
    ToolsConfig,
    'editingDocs' | 'composingDocs' | 'editingDataViews'
  >
): string {
  return PERMISSION_MODE_ADDENDA[permissionModeFromToolsConfig(toolsConfig)];
}

export function appendPermissionModeAddendum(
  messages: PromptMessage[],
  toolsConfig?: Pick<
    ToolsConfig,
    'editingDocs' | 'composingDocs' | 'editingDataViews'
  >
): PromptMessage[] {
  const addendum = getPermissionModeAddendum(toolsConfig);
  const modeBlock = `<mode_guidelines>\n${addendum}\n</mode_guidelines>`;
  const systemIndex = messages.findIndex(message => message.role === 'system');

  if (systemIndex === -1) {
    return [
      {
        role: 'system',
        content: modeBlock,
      },
      ...messages,
    ];
  }

  return messages.map((message, index) => {
    if (index !== systemIndex) return message;
    return {
      ...message,
      content: `${message.content}\n\n${modeBlock}`,
    };
  });
}
