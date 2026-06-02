import type { StreamObject } from '../providers/types';

export type GroundingVerificationStatus = 'skipped' | 'pass' | 'warn';

export type GroundingVerificationResult = {
  status: GroundingVerificationStatus;
  sourceCount: number;
  warnings: string[];
  unsupportedCitations: string[];
};

const WORKSPACE_SOURCE_TOOLS = new Set([
  'doc_hybrid_search',
  'doc_keyword_search',
  'doc_read',
  'doc_semantic_search',
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function citationKeyFromRecord(record: Record<string, unknown>) {
  const type = record.type ?? record.sourceType;
  if (
    (type === 'doc' || type === 'document') &&
    typeof record.docId === 'string'
  ) {
    return `doc:${record.docId}`;
  }
  if (
    (type === 'attachment' || type === 'file' || type === 'blob') &&
    typeof record.blobId === 'string'
  ) {
    return `attachment:${record.blobId}`;
  }
  if (typeof record.docId === 'string') {
    return `doc:${record.docId}`;
  }
  if (typeof record.blobId === 'string') {
    return `attachment:${record.blobId}`;
  }
  return null;
}

function addCitationKey(sourceKeys: Set<string>, value: unknown) {
  const record = asRecord(value);
  if (!record) return;
  const key = citationKeyFromRecord(record);
  if (key) {
    sourceKeys.add(key);
  }
}

function collectSourceKeys(streamObjects: readonly StreamObject[]) {
  const sourceKeys = new Set<string>();
  for (const item of streamObjects) {
    if (item.type !== 'tool-result') continue;
    if (!WORKSPACE_SOURCE_TOOLS.has(item.toolName)) continue;
    const result = item.result;
    if (Array.isArray(result)) {
      for (const source of result) {
        const record = asRecord(source);
        addCitationKey(sourceKeys, record?.citation ?? source);
      }
      continue;
    }
    addCitationKey(sourceKeys, result);
  }
  return sourceKeys;
}

function parseReferenceDefinitions(content: string) {
  const citations: string[] = [];
  const pattern = /^\[\^\d+\]:\s*(\{.+\})\s*$/gm;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content))) {
    try {
      const parsed = JSON.parse(match[1]);
      const record = asRecord(parsed);
      const key = record ? citationKeyFromRecord(record) : null;
      if (key) {
        citations.push(key);
      }
    } catch {
      citations.push('invalid-json');
    }
  }
  return citations;
}

export function verifyWorkspaceGrounding({
  content,
  streamObjects,
}: {
  content: string;
  streamObjects: readonly StreamObject[];
}): GroundingVerificationResult {
  const sourceKeys = collectSourceKeys(streamObjects);
  const warnings: string[] = [];
  const unsupportedCitations: string[] = [];

  if (sourceKeys.size === 0) {
    return {
      status: 'skipped',
      sourceCount: 0,
      warnings,
      unsupportedCitations,
    };
  }

  const hasInlineCitations = /\[\^\d+\]/.test(content);
  const referenceDefinitions = parseReferenceDefinitions(content);
  if (!hasInlineCitations) {
    warnings.push('missing-inline-citations');
  }
  if (referenceDefinitions.length === 0) {
    warnings.push('missing-reference-list');
  }
  for (const citation of referenceDefinitions) {
    if (citation === 'invalid-json') {
      warnings.push('invalid-reference-json');
      unsupportedCitations.push(citation);
      continue;
    }
    if (!sourceKeys.has(citation)) {
      unsupportedCitations.push(citation);
    }
  }
  if (unsupportedCitations.length > 0) {
    warnings.push('unsupported-citations');
  }

  return {
    status: warnings.length > 0 ? 'warn' : 'pass',
    sourceCount: sourceKeys.size,
    warnings,
    unsupportedCitations,
  };
}
