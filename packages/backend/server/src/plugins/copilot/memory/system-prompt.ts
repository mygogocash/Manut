import type { RetrievedMemory } from './types';

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
 */
export function formatMemoriesForPrompt(memories: RetrievedMemory[]): string {
  if (!memories || memories.length === 0) {
    return '';
  }
  const blocks = memories.map(m => formatBlock(m)).filter(Boolean);
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
