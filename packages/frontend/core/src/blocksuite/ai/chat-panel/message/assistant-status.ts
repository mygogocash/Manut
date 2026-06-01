import type { StreamObject } from '../../components/ai-chat-messages';

export type AssistantStatusChipKind =
  | 'tools'
  | 'sources'
  | 'writes'
  | 'failures';

export type AssistantStatusChip = {
  readonly kind: AssistantStatusChipKind;
  readonly label: string;
  readonly testId: string;
};

const SOURCE_TOOLS = new Set([
  'blobread',
  'calendarsearch',
  'dockeywordsearch',
  'docread',
  'docsemanticsearch',
  'githubreadissue',
  'githubreadpr',
  'githubsearchissues',
  'githubsearchrepos',
  'gmailsearch',
  'websearch',
]);

const WRITE_TOOLS = new Set([
  'dataviewautofillcolumn',
  'dataviewfilter',
  'doccompose',
  'doccreate',
  'docedit',
  'docupdate',
  'docupdatemeta',
  'sectionedit',
]);

function normalizeToolName(toolName: string): string {
  return toolName.replace(/[_-]/g, '').toLowerCase();
}

function plural(count: number, singular: string, pluralName = `${singular}s`) {
  return count === 1 ? singular : pluralName;
}

function isToolFailure(result: unknown): boolean {
  if (!result || typeof result !== 'object') return false;
  return (
    ('type' in result && (result as { type?: unknown }).type === 'error') ||
    'error' in result ||
    'toolError' in result
  );
}

export function summarizeAssistantStatusChips(
  streamObjects?: readonly StreamObject[] | null
): AssistantStatusChip[] {
  if (!streamObjects?.length) return [];

  const toolKeys = new Set<string>();
  const sourceToolKeys = new Set<string>();
  const writeToolKeys = new Set<string>();
  const failedToolKeys = new Set<string>();

  for (const item of streamObjects) {
    if (item.type !== 'tool-call' && item.type !== 'tool-result') continue;
    const key = `${item.toolCallId}:${item.toolName}`;
    const normalizedName = normalizeToolName(item.toolName);
    toolKeys.add(key);

    if (SOURCE_TOOLS.has(normalizedName)) {
      sourceToolKeys.add(key);
    }
    if (WRITE_TOOLS.has(normalizedName)) {
      writeToolKeys.add(key);
    }
    if (item.type === 'tool-result' && isToolFailure(item.result)) {
      failedToolKeys.add(key);
    }
  }

  const chips: AssistantStatusChip[] = [];
  if (toolKeys.size > 0) {
    chips.push({
      kind: 'tools',
      label: `Used ${toolKeys.size} ${plural(toolKeys.size, 'tool')}`,
      testId: 'ai-tool-status-chip',
    });
  }
  if (sourceToolKeys.size > 0) {
    chips.push({
      kind: 'sources',
      label: `Checked ${sourceToolKeys.size} ${plural(sourceToolKeys.size, 'source')}`,
      testId: 'ai-source-status-chip',
    });
  }
  if (writeToolKeys.size > 0) {
    chips.push({
      kind: 'writes',
      label: 'AI made changes',
      testId: 'ai-write-tool-chip',
    });
  }
  if (failedToolKeys.size > 0) {
    chips.push({
      kind: 'failures',
      label: `${failedToolKeys.size} ${plural(failedToolKeys.size, 'tool')} failed`,
      testId: 'ai-tool-failure-chip',
    });
  }

  return chips;
}
