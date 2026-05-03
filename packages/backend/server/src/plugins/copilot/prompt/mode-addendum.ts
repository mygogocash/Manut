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
  concise:
    'Be concise and direct. Use short paragraphs. Avoid filler.',
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
export function isChatMode(value: string | undefined | null): value is ChatMode {
  if (!value) return false;
  return value.trim().toLowerCase() in MODE_ADDENDA;
}
