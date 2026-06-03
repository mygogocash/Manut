import type { ToolsConfig } from '../../types.js';
import type { ClassifyInput, ScenarioKey } from '../scenario-classifier.js';

type EvalAttachment = NonNullable<ClassifyInput['attachments']>[number];

export type ScenarioEvalCase = {
  readonly id: string;
  readonly input: ClassifyInput;
  readonly expected: ScenarioKey;
};

export type AutoModelEvalCase = {
  readonly id: string;
  readonly scenario: ScenarioKey;
  readonly content: string;
  readonly attachments?: ClassifyInput['attachments'];
  readonly expectedModel: string;
};

export type ModeAddendumEvalCase = {
  readonly id: string;
  readonly mode: string | null | undefined;
  readonly expectedSubstring: string;
  readonly expectedEmpty?: boolean;
};

export type PermissionModeEvalCase = {
  readonly id: string;
  readonly toolsConfig: Pick<
    ToolsConfig,
    'editingDocs' | 'composingDocs' | 'editingDataViews'
  >;
  readonly expectedSubstring: string;
};

export type MessageSubstringScope = 'all' | 'system' | 'user';

export type PromptSubstringEvalCase = {
  readonly id: string;
  readonly scope: MessageSubstringScope;
  readonly substring: string;
};

export const scenarioEvalCases = [
  {
    id: 'audio-attachment-routes-to-transcription',
    input: {
      content: 'Please transcribe this customer call.',
      attachments: [
        {
          attachment: 'handle://recording-1',
          mimeType: 'audio/mpeg',
        } as unknown as EvalAttachment,
      ],
    },
    expected: 'audio_transcribing',
  },
  {
    id: 'image-edit-routes-to-image',
    input: {
      content:
        'Remove the background and convert this image into a clean icon.',
      attachments: [
        {
          attachment: 'handle://image-1',
          mimeType: 'image/png',
        } as unknown as EvalAttachment,
      ],
    },
    expected: 'image',
  },
  {
    id: 'code-request-routes-to-coding',
    input: {
      content:
        'Please refactor this TypeScript function and fix bug handling for empty input.',
    },
    expected: 'coding',
  },
  {
    id: 'short-question-routes-to-quick-decision',
    input: {
      content: 'What should I do next?',
    },
    expected: 'quick_decision_making',
  },
  {
    id: 'medium-summary-routes-to-polish-and-summarize',
    input: {
      content:
        'Can you summarize the following workspace notes into action items for the team meeting tomorrow morning?',
    },
    expected: 'polish_and_summarize',
  },
  {
    id: 'long-planning-routes-to-complex-generation',
    input: {
      content:
        'Please create an outline for a product presentation about the next version of Manut AI chat. ' +
        'The plan needs to cover workspace-grounded answers, citations, model routing, tool visibility, ' +
        'Thai-language support, mobile behavior, safety controls, rollout phases, and a measurable eval strategy ' +
        'that lets us compare prompt revisions before we ship them to production users.',
    },
    expected: 'complex_text_generation',
  },
  {
    id: 'full-agent-task-completion-routes-to-complex-generation',
    input: {
      content:
        'Please plan and complete this Manut task from the available workspace evidence. ' +
        'First inspect related notes and sources, then draft the launch update, save the produced work as a doc, ' +
        'link it back to the task, report any approval needed for write tools, and include verification evidence ' +
        'so I can see whether the definition of done is satisfied before we close the task.',
    },
    expected: 'complex_text_generation',
  },
  {
    id: 'thai-mixed-language-summary-routes-to-polish-and-summarize',
    input: {
      content:
        'ช่วย summarize เอกสารล่าสุดของโปรเจกต์ Manut AI เป็น bullet สั้นๆ พร้อม next steps สำหรับทีมพรุ่งนี้',
    },
    expected: 'polish_and_summarize',
  },
  {
    id: 'medium-writing-routes-to-quick-generation',
    input: {
      content:
        'Write a short update for the product team about why AI answers should show sources and tool status in the transcript.',
    },
    expected: 'quick_text_generation',
  },
  {
    id: 'source-grounded-research-routes-to-quick-generation',
    input: {
      content:
        'Research this product question with workspace sources first, show source chips, and give me a concise answer with citations.',
    },
    expected: 'quick_text_generation',
  },
  {
    id: 'long-general-question-routes-to-chat',
    input: {
      content:
        'I want to understand the strengths and weaknesses of our current AI chat system across workspace search, memory, ' +
        'source grounding, response style, and mobile usability. There are several possible improvements, but I need a careful ' +
        'analysis that separates what is already supported from what still needs backend or frontend work before launch.',
    },
    expected: 'chat',
  },
] satisfies readonly ScenarioEvalCase[];

export const autoModelEvalCases = [
  {
    id: 'long-chat-routes-to-pro',
    scenario: 'chat',
    content: 'context '.repeat(16_000),
    expectedModel: 'gemini-2.5-pro',
  },
  {
    id: 'code-routes-to-claude',
    scenario: 'quick_text_generation',
    content:
      'Please refactor this function:\n```ts\nexport function sum(items: number[]) { return items.reduce((a, b) => a + b, 0); }\n```',
    expectedModel: 'claude-sonnet-4-5@20250929',
  },
  {
    id: 'image-input-routes-to-gemini-text-model',
    scenario: 'image',
    content: 'convert this image into a cleaner icon',
    attachments: [
      {
        attachment: 'handle://image-1',
        mimeType: 'image/png',
      } as unknown as EvalAttachment,
    ],
    expectedModel: 'gemini-2.5-flash',
  },
  {
    id: 'complex-text-uses-pro-scenario-model',
    scenario: 'complex_text_generation',
    content:
      'Please create a presentation outline for our AI chat launch covering citations, mobile, safety and rollout.',
    expectedModel: 'gemini-2.5-pro',
  },
  {
    id: 'full-agent-task-completion-uses-pro-scenario-model',
    scenario: 'complex_text_generation',
    content:
      'Plan the task, gather evidence, draft the work product, and verify whether the definition of done is satisfied.',
    expectedModel: 'gemini-2.5-pro',
  },
] satisfies readonly AutoModelEvalCase[];

export const modeAddendumEvalCases = [
  {
    id: 'default-mode-is-empty',
    mode: 'default',
    expectedSubstring: '',
    expectedEmpty: true,
  },
  {
    id: 'concise-mode-asks-for-short-direct-answers',
    mode: ' concise ',
    expectedSubstring: 'Be concise and direct',
  },
  {
    id: 'creative-mode-asks-for-exploratory-answers',
    mode: 'CREATIVE',
    expectedSubstring: 'Be more exploratory',
  },
  {
    id: 'unknown-mode-is-empty',
    mode: 'verbose',
    expectedSubstring: '',
    expectedEmpty: true,
  },
] satisfies readonly ModeAddendumEvalCase[];

export const permissionModeEvalCases = [
  {
    id: 'read-mode-addendum',
    toolsConfig: {
      editingDocs: false,
      composingDocs: false,
      editingDataViews: false,
    },
    expectedSubstring: 'Read mode',
  },
  {
    id: 'edit-current-doc-addendum',
    toolsConfig: {
      editingDocs: true,
      composingDocs: false,
      editingDataViews: false,
    },
    expectedSubstring: 'Edit current doc mode',
  },
  {
    id: 'full-agent-addendum',
    toolsConfig: {
      editingDocs: true,
      composingDocs: true,
      editingDataViews: true,
    },
    expectedSubstring: 'Full Agent mode',
  },
  {
    id: 'full-agent-plan-first-guidance',
    toolsConfig: {
      editingDocs: true,
      composingDocs: true,
      editingDataViews: true,
    },
    expectedSubstring: 'short executable plan',
  },
  {
    id: 'full-agent-evidence-before-writes-guidance',
    toolsConfig: {
      editingDocs: true,
      composingDocs: true,
      editingDataViews: true,
    },
    expectedSubstring: 'Read evidence before writes',
  },
] satisfies readonly PermissionModeEvalCase[];

export const chatPromptEvalConfig = {
  promptName: 'Chat With Manut AI',
  expectedModel: 'gemini-2.5-flash',
  requiredTools: ['docHybridSearch'],
  requiredOptionalModels: [
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'claude-sonnet-4-5@20250929',
  ],
  forbiddenOptionalModels: [
    'gpt-5-mini',
    'gemini-3.1-flash-lite-preview',
    'gemini-3.1-pro-preview',
    'claude-sonnet-4-6',
    'claude-opus-4-6',
    'claude-opus-4-7',
  ],
  requiredSubstrings: [
    {
      id: 'citation-footnotes-required',
      scope: 'system',
      substring: 'Always use markdown footnote format for citations',
    },
    {
      id: 'citation-reference-list-required',
      scope: 'system',
      substring: 'REFERENCE LIST',
    },
    {
      id: 'workspace-search-prioritized',
      scope: 'system',
      substring:
        "prioritize searching the user's workspace rather than the web",
    },
    {
      id: 'hybrid-search-tool-preferred',
      scope: 'system',
      substring: 'doc_hybrid_search',
    },
    {
      id: 'current-doc-read-before-answering',
      scope: 'system',
      substring: 'call the doc_read tool with docId {{currentDocId}}',
    },
    {
      id: 'one-follow-up-question-limit',
      scope: 'system',
      substring: 'Ask at most ONE follow-up question per response',
    },
  ] satisfies readonly PromptSubstringEvalCase[],
} as const;
