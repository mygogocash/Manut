import type { MemoryKind, RetrievedMemory } from './types';

/**
 * Manut Wave 4 (M5b) — Format retrieved memories for system-prompt injection.
 *
 * Output shape:
 *   <memory kind="PLAYBOOK" scope="workspace">…</memory>
 *   <memory kind="DECISION" scope="workspace">…</memory>
 *   ...
 *
 * Why XML-ish tags and not Markdown?
 *   - The system prompt is consumed by an LLM; XML-ish blocks are the
 *     vendor-recommended structured-context convention (Anthropic +
 *     Google Vertex Gemini both consume them well).
 *   - Tagging with `kind` lets the LLM prioritise PLAYBOOK over OBSERVATION
 *     without needing extra meta-instructions — the surrounding system
 *     prompt explicitly tells the model to honour PLAYBOOK + DECISION as
 *     ground truth.
 *   - Tagging with `scope` lets the model honour user-personal facts
 *     ("you previously said you prefer X") differently from workspace-
 *     team facts ("the team decided Y").
 *
 * Returns an empty string when there are no memories. Caller-side
 * concatenation (`memories + originalSystemPrompt`) becomes a no-op in
 * that case, so callers never need a null check.
 *
 * Pure / side-effect-free / no DI — exposed as a stand-alone function so
 * tests can hit it without booting a NestJS module.
 *
 * Manut M2 E2.4 — ordering contract: PLAYBOOK > FACT > DECISION >
 * OBSERVATION. The distill cron writes a workspace-scoped PLAYBOOK from
 * the past week's feedback; the chat resolver fetches it independently
 * and passes it via `latestPlaybook` so it ALWAYS appears at the top of
 * the memory blob, regardless of kNN ranking. The other memories then
 * follow in the same priority order, so the LLM reads the PLAYBOOK
 * first and uses everything else as supporting detail.
 */
const KIND_PRIORITY: Record<MemoryKind, number> = {
  PLAYBOOK: 0,
  FACT: 1,
  DECISION: 2,
  OBSERVATION: 3,
};

export function formatMemoriesForPrompt(
  memories: RetrievedMemory[],
  // Manut M2 E2.4 — the workspace's most-recent PLAYBOOK (output of the
  // weekly distill cron). When provided, it is rendered FIRST and the
  // same row is removed from `memories` if it appeared via kNN so we
  // don't double-render. When omitted/null, behaviour is unchanged from
  // the M5b release.
  latestPlaybook?: RetrievedMemory | null
): string {
  const ordered: RetrievedMemory[] = [];
  const seenIds = new Set<string>();
  if (latestPlaybook && latestPlaybook.content?.trim()) {
    ordered.push(latestPlaybook);
    seenIds.add(latestPlaybook.id);
  }
  if (memories && memories.length > 0) {
    // Stable-sort by kind priority. Array.prototype.sort is stable in
    // V8/Node 12+, so equal-priority items keep their incoming order
    // (which is kNN-distance ascending — see retrieve.service.ts).
    const sorted = [...memories]
      .filter(m => !seenIds.has(m.id))
      .sort((a, b) => KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind]);
    ordered.push(...sorted);
  }
  if (ordered.length === 0) {
    return '';
  }
  const blocks = ordered.map(m => formatBlock(m)).filter(Boolean);
  if (blocks.length === 0) {
    return '';
  }
  // The trailing \n\n separates the memory blob from whatever follows.
  return `${PREAMBLE}\n${blocks.join('\n')}\n${EPILOGUE}\n\n`;
}

const PREAMBLE =
  '<memories>\n' +
  '<!--\n' +
  '  Below are durable memories surfaced from prior chat turns in this\n' +
  '  workspace. PLAYBOOK and DECISION items represent agreed-upon\n' +
  '  ground truth — honour them. FACT items represent stated\n' +
  '  preferences — apply unless contradicted by the current message.\n' +
  '  OBSERVATION items are background notes — use them as soft hints.\n' +
  '-->';

const EPILOGUE = '</memories>';

function formatBlock(memory: RetrievedMemory): string {
  // Defensive content escaping — strip stray closing tags from content so
  // a hand-written FACT that contains `</memory>` doesn't end the block
  // early. We don't HTML-escape further because the LLM consumes XML-ish
  // tags directly and aggressive escaping hurts readability.
  const safe = (memory.content ?? '')
    .replace(/<\/memory>/gi, '</_memory>')
    .trim();
  if (!safe) {
    return '';
  }
  return `  <memory kind="${memory.kind}" scope="${memory.scope}">${safe}</memory>`;
}
