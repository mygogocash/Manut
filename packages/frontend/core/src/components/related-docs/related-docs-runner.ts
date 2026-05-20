/**
 * Related-docs agent runner.
 *
 * Pipeline:
 *   1. Extract the current doc's title + markdown body (capped at 3000
 *      chars).
 *   2. Call `matchWorkspaceDocs` (the existing semantic-search GraphQL
 *      surface — see CLAUDE.md §6c on the doc-semantic-search tool;
 *      same pgvector embedding backend). This returns up to N chunks.
 *   3. Collapse chunks to one entry per docId; drop the current doc.
 *   4. (Optional next-step) the caller can hand the candidate list to
 *      the `Suggest Related Docs` prompt for an LLM re-rank — that path
 *      lives in the sidebar component since it needs CopilotClient.
 *
 * Defense-in-depth: we never trust the AI's id list against the
 * workspace. The caller must filter the LLM's output against the
 * candidate list before linking — otherwise a hallucinated id could
 * insert a broken backlink.
 */

import type { CopilotClient } from '../../blocksuite/ai/provider/copilot-client';
import { textToText } from '../../blocksuite/ai/provider/request';
import { cleanTagSuggestions } from '../auto-tag/parse';

export interface SemanticDocChunk {
  docId: string;
  chunk: number;
  content: string;
  distance?: number | null;
}

export interface SemanticDocCandidate {
  docId: string;
  /** First chunk we saw for this doc — used as the snippet. */
  snippet: string;
  /** Min distance across all chunks for this doc (lower = closer). */
  distance: number;
}

/**
 * Collapse a chunk list to per-doc candidates, drop the current doc
 * and any explicitly-excluded ids, and keep the closest distance per
 * doc.
 */
export function collapseChunksToCandidates(
  chunks: SemanticDocChunk[],
  excludeDocIds: Set<string>
): SemanticDocCandidate[] {
  const byDoc = new Map<string, SemanticDocCandidate>();
  for (const c of chunks) {
    if (excludeDocIds.has(c.docId)) continue;
    const distance = typeof c.distance === 'number' ? c.distance : Infinity;
    const existing = byDoc.get(c.docId);
    if (!existing) {
      byDoc.set(c.docId, {
        docId: c.docId,
        snippet: c.content,
        distance,
      });
      continue;
    }
    if (distance < existing.distance) {
      existing.distance = distance;
      // Don't overwrite snippet — first chunk seen is fine and
      // overwriting would cause UI flicker on re-render.
    }
  }
  return Array.from(byDoc.values()).sort((a, b) => a.distance - b.distance);
}

export interface RankCandidatesArgs {
  client: CopilotClient;
  workspaceId: string;
  docId: string;
  title: string;
  bodyMarkdown: string;
  candidates: Array<{ docId: string; title: string; snippet: string }>;
}

/**
 * Optional LLM re-rank step: feeds the candidate list through the
 * `Suggest Related Docs` prompt and returns the docIds the model
 * judged most related. Returns an empty array on transport failure or
 * if the model hallucinates ids that aren't in the candidate list.
 *
 * SSE-stream-object defense: reuses the shared `cleanTagSuggestions`
 * pipeline (it's a generic string-list cleaner, not tag-specific). We
 * then INTERSECT with the candidate list — a hallucinated id is
 * silently dropped.
 */
export async function rankCandidatesWithLLM(
  args: RankCandidatesArgs
): Promise<string[]> {
  if (args.candidates.length === 0) return [];

  const candidateBlock = args.candidates
    .map(c => {
      const snippet = c.snippet.replace(/\s+/g, ' ').slice(0, 240);
      return `- id: ${c.docId}\n  title: ${c.title || 'Untitled'}\n  snippet: ${snippet}`;
    })
    .join('\n');

  const sessionId = await args.client.createSession({
    workspaceId: args.workspaceId,
    docId: args.docId,
    promptName: 'Suggest Related Docs',
  });
  if (!sessionId) return [];

  const result = await textToText({
    client: args.client,
    sessionId,
    content: 'Re-rank these candidates now.',
    params: {
      title: args.title,
      content: args.bodyMarkdown.slice(0, 2000),
      candidates: candidateBlock,
    },
    stream: false,
  });

  const text = typeof result === 'string' ? result : '';
  if (!text) return [];

  // The model returns a JSON array of docIds — reuse the tag parser
  // (it's a generic string-array extractor with the SSE-fragment
  // defense the §6c scar demands).
  const proposed = cleanTagSuggestions(text, 5).map(s => s.trim());

  // Intersect against the candidate id whitelist. A hallucinated id
  // gets dropped here — never inserted as a broken backlink.
  const allowed = new Set(args.candidates.map(c => c.docId));
  const out: string[] = [];
  for (const id of proposed) {
    if (!allowed.has(id)) continue;
    if (out.includes(id)) continue;
    out.push(id);
    if (out.length >= 5) break;
  }
  return out;
}
