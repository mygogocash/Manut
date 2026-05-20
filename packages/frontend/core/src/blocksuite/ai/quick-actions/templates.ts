// Per-doc-type quick-action templates surfaced in the floating chat
// empty state (and any future chat surface that wants to chip in
// "what can I do here?" affordances).
//
// Epic E1.10 — T-1.10.1. Five doc types, ~4 prompts each. Strings
// are intentionally English-only at v1; once the rest of the
// floating chat copy lands in i18n we can swap to t() lookups.
// Adding a new doc type:
//   1. Extend QuickActionDocType with the new key (mirror the
//      backend block flavour or surface name — affine:* for
//      blocksuite block flavours, mn:* for Manut surfaces).
//   2. Add the entry to QUICK_ACTIONS below.
//   3. Map the new key in callers (see quick-actions-row.tsx for
//      the floating chat mapping).
//
// Prompts are short imperative sentences so the AI can act on them
// without needing the user to clarify intent. Keep them deterministic
// — no "if X then Y" branching; the chat will handle clarification.

export type QuickActionDocType =
  | 'affine:page'
  | 'affine:database'
  | 'affine:edgeless'
  | 'mn:meeting'
  | 'code-block';

export interface QuickAction {
  label: string;
  prompt: string;
}

export const QUICK_ACTIONS: Record<QuickActionDocType, readonly QuickAction[]> =
  {
    'affine:page': [
      {
        label: 'Summarize',
        prompt: 'Summarize this document in 3 bullet points.',
      },
      {
        label: 'Translate',
        prompt:
          'Translate this document to English (or detect the source language).',
      },
      {
        label: 'Outline',
        prompt: 'Create a hierarchical outline of this document.',
      },
      {
        label: 'Continue writing',
        prompt:
          'Continue writing the next paragraph from where this document ends.',
      },
    ],
    'affine:database': [
      {
        label: 'Suggest filters',
        prompt: 'Suggest 3 useful filters for this database.',
      },
      {
        label: 'Generate column',
        prompt: 'Suggest a new column to add to this database.',
      },
      {
        label: 'Analyze trends',
        prompt: 'Analyze trends in the data of this database.',
      },
      {
        label: 'Make chart',
        prompt: 'Suggest a chart visualization for this database.',
      },
    ],
    'affine:edgeless': [
      {
        label: 'Cluster shapes',
        prompt: 'Cluster the shapes on this whiteboard into logical groups.',
      },
      {
        label: 'Generate flowchart',
        prompt: 'Generate a flowchart based on the content on this whiteboard.',
      },
      {
        label: 'Add labels',
        prompt: 'Add descriptive labels to the unlabeled shapes.',
      },
    ],
    'mn:meeting': [
      {
        label: 'Extract action items',
        prompt: 'Extract action items from this meeting note.',
      },
      {
        label: 'Draft follow-up',
        prompt: 'Draft a follow-up email summarizing this meeting.',
      },
      {
        label: 'Suggest next meeting',
        prompt: 'Suggest topics for the next meeting based on this one.',
      },
    ],
    'code-block': [
      { label: 'Explain', prompt: 'Explain this code in simple terms.' },
      {
        label: 'Refactor',
        prompt: 'Refactor this code for better readability.',
      },
      { label: 'Test', prompt: 'Write unit tests for this code.' },
      {
        label: 'Translate to language',
        prompt: 'Translate this code to another language.',
      },
    ],
  };

/**
 * Lookup helper — returns the readonly list of quick actions for a doc
 * type, or undefined when the type isn't registered. Callers should
 * treat undefined as "no quick actions for this surface" and render
 * nothing rather than a fallback set, so users don't see misleading
 * prompts that won't act on their current context.
 */
export function getQuickActionsFor(
  docType: string
): readonly QuickAction[] | undefined {
  return QUICK_ACTIONS[docType as QuickActionDocType];
}
