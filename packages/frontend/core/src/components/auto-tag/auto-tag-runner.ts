/**
 * Auto Tag agent runner.
 *
 * Wraps the existing `Auto Tag` copilot prompt (backed by gemini-2.5-flash
 * on Manut's Vertex stack — see CLAUDE.md §6c on the gpt-5-mini trap) and
 * surfaces a clean candidate list ready for either:
 *   (a) the manual "AI Auto Tag" property-panel button (unchanged path,
 *       see workspace-property-types/tags.tsx), OR
 *   (b) the new auto-on-save flow that proposes tags via a non-intrusive
 *       toast when a fresh, body-laden doc has no tags yet.
 *
 * The function does NOT write tags itself — it returns a list. The
 * caller (toast accept handler, or the manual button) decides whether
 * to apply, and uses TagService for the write.
 *
 * SSE-stream-object defense: results pass through `cleanTagSuggestions`
 * which combines `parseTagCandidates` + `looksLikeSseFragment`. v1.10.1's
 * scar (rendered `{"type":"text-delta"...}` chunks as tags) means we
 * MUST run that defense at the parse boundary even though `request.ts`
 * also strips wrappers.
 */

import type {
  EventSourceService,
  GraphQLService,
} from '@affine/core/modules/cloud';

import { CopilotClient } from '../../blocksuite/ai/provider/copilot-client';
import { textToText } from '../../blocksuite/ai/provider/request';
import { cleanTagSuggestions } from './parse';

export interface AutoTagRequest {
  workspaceId: string;
  docId: string;
  title: string;
  bodyMarkdown: string;
  existingTags: string[];
  graphqlService: GraphQLService;
  eventSourceService: EventSourceService;
}

export interface AutoTagResult {
  /** Sanitized lowercase tag candidates (max 7). May be empty. */
  candidates: string[];
}

/**
 * Run the Auto Tag prompt against the given doc and return the
 * candidates. Throws on transport / session-creation failure; returns
 * `{ candidates: [] }` on a successful round-trip that yields no usable
 * tags (e.g. an already-well-tagged doc).
 */
export async function runAutoTag(req: AutoTagRequest): Promise<AutoTagResult> {
  const client = new CopilotClient(
    req.graphqlService.gql,
    req.eventSourceService.eventSource
  );

  // Cap markdown at 3000 chars to keep the prompt under a reasonable
  // token budget (same cap as the manual button path).
  const content = (req.bodyMarkdown || req.title).slice(0, 3000);

  const sessionId = await client.createSession({
    workspaceId: req.workspaceId,
    docId: req.docId,
    promptName: 'Auto Tag',
  });
  if (!sessionId) {
    throw new Error('Failed to create copilot session for Auto Tag');
  }

  const result = await textToText({
    client,
    sessionId,
    content: 'Generate tags now.',
    params: {
      title: req.title,
      content,
      existingTags: req.existingTags.length
        ? req.existingTags.join(', ')
        : '(none)',
    },
    stream: false,
  });

  const text = typeof result === 'string' ? result : '';
  if (!text) {
    return { candidates: [] };
  }

  return { candidates: cleanTagSuggestions(text, 7) };
}
