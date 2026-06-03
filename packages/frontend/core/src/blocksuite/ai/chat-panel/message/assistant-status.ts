import type { StreamObject } from '../../components/ai-chat-messages';

export type AssistantStatusChipKind =
  | 'approvals'
  | 'tools'
  | 'sources'
  | 'writes'
  | 'failures';

export type AssistantStatusChip = {
  readonly kind: AssistantStatusChipKind;
  readonly label: string;
  readonly testId: string;
};

export type AssistantTimelineItemKind =
  | 'code'
  | 'external'
  | 'generate'
  | 'read'
  | 'search'
  | 'tool'
  | 'write';

export type AssistantTimelineItemStatus =
  | 'awaiting-approval'
  | 'completed'
  | 'failed'
  | 'running';

export type AssistantTimelineItem = {
  readonly id: string;
  readonly kind: AssistantTimelineItemKind;
  readonly label: string;
  readonly detail: string | null;
  readonly status: AssistantTimelineItemStatus;
};

const SEARCH_TOOLS = new Set([
  'calendarsearch',
  'dochybridsearch',
  'dockeywordsearch',
  'docsemanticsearch',
  'githubsearchissues',
  'githubsearchrepos',
  'gmailsearch',
  'websearch',
]);

const READ_TOOLS = new Set([
  'blobread',
  'docread',
  'githubreadissue',
  'githubreadpr',
]);

const SOURCE_TOOLS = new Set([
  'blobread',
  'calendarsearch',
  'dochybridsearch',
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

const GENERATE_TOOLS = new Set(['doccompose', 'imagegen']);

const CODE_TOOLS = new Set(['coderun']);

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

function isAwaitingApproval(result: unknown): boolean {
  if (!result || typeof result !== 'object') return false;
  return (
    'type' in result &&
    (result as { type?: unknown }).type === 'awaiting-approval'
  );
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function toolArgsDetail(args: unknown, normalizedName: string): string | null {
  if (!args || typeof args !== 'object') return null;
  const record = args as Record<string, unknown>;
  if (SEARCH_TOOLS.has(normalizedName)) {
    return (
      stringValue(record.query) ??
      stringValue(record.keyword) ??
      stringValue(record.text)
    );
  }
  if (normalizedName === 'doccompose') {
    return stringValue(record.title);
  }
  if (WRITE_TOOLS.has(normalizedName)) {
    return stringValue(record.title) ?? stringValue(record.docId);
  }
  return (
    stringValue(record.title) ??
    stringValue(record.query) ??
    stringValue(record.docId)
  );
}

function approvalDetail(result: unknown): string | null {
  if (!result || typeof result !== 'object') return null;
  return stringValue((result as Record<string, unknown>).approvalId);
}

function failureDetail(result: unknown): string | null {
  if (!result || typeof result !== 'object') return null;
  const record = result as Record<string, unknown>;
  return (
    stringValue(record.message) ??
    stringValue(record.error) ??
    stringValue(record.name) ??
    stringValue(record.toolError)
  );
}

function timelineKindForTool(
  normalizedName: string
): AssistantTimelineItemKind {
  if (SEARCH_TOOLS.has(normalizedName)) return 'search';
  if (READ_TOOLS.has(normalizedName)) return 'read';
  if (GENERATE_TOOLS.has(normalizedName)) return 'generate';
  if (WRITE_TOOLS.has(normalizedName)) return 'write';
  if (CODE_TOOLS.has(normalizedName)) return 'code';
  if (normalizedName.includes('github') || normalizedName.includes('gmail')) {
    return 'external';
  }
  return 'tool';
}

function timelineLabelForTool(
  normalizedName: string,
  kind: AssistantTimelineItemKind
): string {
  if (normalizedName === 'dochybridsearch') return 'Searched workspace';
  if (normalizedName === 'docsemanticsearch') return 'Searched docs';
  if (normalizedName === 'dockeywordsearch') return 'Searched docs';
  if (normalizedName === 'websearch') return 'Searched web';
  if (normalizedName === 'gmailsearch') return 'Searched Gmail';
  if (normalizedName === 'calendarsearch') return 'Searched calendar';
  if (normalizedName === 'docread') return 'Read doc';
  if (normalizedName === 'blobread') return 'Read attachment';
  if (normalizedName === 'doccompose') return 'Drafting doc';
  if (normalizedName === 'imagegen') return 'Generating image';
  if (normalizedName === 'coderun') return 'Running code';
  if (kind === 'write') return 'Preparing write';
  if (kind === 'search') return 'Searching';
  if (kind === 'read') return 'Reading';
  if (kind === 'generate') return 'Drafting';
  return 'Using tool';
}

export function summarizeAssistantStatusChips(
  streamObjects?: readonly StreamObject[] | null
): AssistantStatusChip[] {
  if (!streamObjects?.length) return [];

  const toolKeys = new Set<string>();
  const sourceToolKeys = new Set<string>();
  const writeToolKeys = new Set<string>();
  const failedToolKeys = new Set<string>();
  const awaitingApprovalToolKeys = new Set<string>();

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
    if (item.type === 'tool-result' && isAwaitingApproval(item.result)) {
      awaitingApprovalToolKeys.add(key);
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
  if (awaitingApprovalToolKeys.size > 0) {
    chips.push({
      kind: 'approvals',
      label: `${awaitingApprovalToolKeys.size} ${plural(awaitingApprovalToolKeys.size, 'approval')} needed`,
      testId: 'ai-approval-status-chip',
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

export function summarizeAssistantTimelineItems(
  streamObjects?: readonly StreamObject[] | null
): AssistantTimelineItem[] {
  if (!streamObjects?.length) return [];

  const items = new Map<string, AssistantTimelineItem>();

  for (const streamObject of streamObjects) {
    if (
      streamObject.type !== 'tool-call' &&
      streamObject.type !== 'tool-result'
    ) {
      continue;
    }

    const normalizedName = normalizeToolName(streamObject.toolName);
    const kind = timelineKindForTool(normalizedName);
    const base = {
      id: streamObject.toolCallId,
      kind,
      label: timelineLabelForTool(normalizedName, kind),
      detail: toolArgsDetail(streamObject.args, normalizedName),
    };

    if (streamObject.type === 'tool-call') {
      if (!items.has(streamObject.toolCallId)) {
        items.set(streamObject.toolCallId, {
          ...base,
          status: 'running',
        });
      }
      continue;
    }

    const result = streamObject.result;
    const status: AssistantTimelineItemStatus = isToolFailure(result)
      ? 'failed'
      : isAwaitingApproval(result)
        ? 'awaiting-approval'
        : 'completed';
    const detail =
      status === 'failed'
        ? (failureDetail(result) ?? base.detail)
        : status === 'awaiting-approval'
          ? (approvalDetail(result) ?? base.detail)
          : base.detail;

    items.set(streamObject.toolCallId, {
      ...base,
      detail,
      status,
    });
  }

  return [...items.values()];
}

function cleanPlanStep(value: string): string | null {
  const step = value.replace(/\s+/g, ' ').trim();
  if (!step || step.length > 180) return null;
  return step;
}

function extractStepFromLine(line: string): string | null {
  const match = line.match(/^\s*(?:\d+[.)]|[-*•])\s+(.+?)\s*$/);
  if (!match) return null;
  return cleanPlanStep(match[1]);
}

export function extractAgentPlanSteps(
  content: string | null | undefined,
  maxSteps = 4
): string[] {
  if (!content) return [];

  const lines = content.split(/\r?\n/);
  const firstContentIndex = lines.findIndex(line => line.trim().length > 0);
  if (firstContentIndex === -1) return [];

  const firstLine = lines[firstContentIndex].trim();
  const explicitPlan = /^(?:full agent plan|agent plan|plan)\s*:?/i.test(
    firstLine
  );
  const firstLineStep = extractStepFromLine(firstLine);
  if (!explicitPlan && !firstLineStep) return [];

  const steps: string[] = [];
  if (firstLineStep) {
    steps.push(firstLineStep);
  }

  for (let index = firstContentIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    const step = extractStepFromLine(line);
    if (step) {
      steps.push(step);
      if (steps.length >= maxSteps) break;
      continue;
    }
    if (steps.length > 0 && line.trim()) break;
  }

  return steps.slice(0, maxSteps);
}
