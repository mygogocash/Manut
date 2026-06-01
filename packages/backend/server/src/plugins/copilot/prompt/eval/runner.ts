import {
  getModeAddendum,
  getPermissionModeAddendum,
} from '../mode-addendum.js';
import { type Prompt, prompts } from '../prompts.js';
import { ScenarioClassifier } from '../scenario-classifier.js';
import {
  chatPromptEvalConfig,
  type MessageSubstringScope,
  modeAddendumEvalCases,
  permissionModeEvalCases,
  scenarioEvalCases,
} from './fixtures.js';

export type PromptEvalArea = 'scenario' | 'mode-addendum' | 'chat-prompt';

export type PromptEvalResult = {
  readonly id: string;
  readonly area: PromptEvalArea;
  readonly pass: boolean;
  readonly message: string;
};

export type PromptEvalReport = {
  readonly ok: boolean;
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly results: readonly PromptEvalResult[];
};

function result(
  area: PromptEvalArea,
  id: string,
  pass: boolean,
  message: string
): PromptEvalResult {
  return { area, id, pass, message };
}

function findChatPrompt(): Prompt | undefined {
  return prompts.find(
    prompt => prompt.name === chatPromptEvalConfig.promptName
  );
}

function contentForScope(prompt: Prompt, scope: MessageSubstringScope): string {
  if (scope === 'all') {
    return prompt.messages.map(message => message.content).join('\n');
  }
  return prompt.messages
    .filter(message => message.role === scope)
    .map(message => message.content)
    .join('\n');
}

function runScenarioEval(): PromptEvalResult[] {
  const classifier = new ScenarioClassifier();
  return scenarioEvalCases.map(testCase => {
    const actual = classifier.classify(testCase.input);
    return result(
      'scenario',
      testCase.id,
      actual === testCase.expected,
      `expected ${testCase.expected}, got ${actual}`
    );
  });
}

function runModeAddendumEval(): PromptEvalResult[] {
  const legacyModeResults = modeAddendumEvalCases.map(testCase => {
    const addendum = getModeAddendum(testCase.mode);
    const pass = testCase.expectedEmpty
      ? addendum === ''
      : addendum.includes(testCase.expectedSubstring);

    return result(
      'mode-addendum',
      testCase.id,
      pass,
      testCase.expectedEmpty
        ? `expected empty addendum, got "${addendum}"`
        : `expected addendum to include "${testCase.expectedSubstring}", got "${addendum}"`
    );
  });

  const permissionModeResults = permissionModeEvalCases.map(testCase => {
    const addendum = getPermissionModeAddendum(testCase.toolsConfig);
    return result(
      'mode-addendum',
      testCase.id,
      addendum.includes(testCase.expectedSubstring),
      `expected permission mode addendum to include "${testCase.expectedSubstring}", got "${addendum}"`
    );
  });

  return [...legacyModeResults, ...permissionModeResults];
}

function runChatPromptEval(): PromptEvalResult[] {
  const prompt = findChatPrompt();
  if (!prompt) {
    return [
      result(
        'chat-prompt',
        'chat-prompt-exists',
        false,
        `missing prompt "${chatPromptEvalConfig.promptName}"`
      ),
    ];
  }

  const optionalModels = prompt.optionalModels ?? [];
  const checks: PromptEvalResult[] = [
    result(
      'chat-prompt',
      'chat-prompt-default-model',
      prompt.model === chatPromptEvalConfig.expectedModel,
      `expected default model ${chatPromptEvalConfig.expectedModel}, got ${prompt.model}`
    ),
    ...chatPromptEvalConfig.requiredOptionalModels.map(modelId =>
      result(
        'chat-prompt',
        `chat-prompt-optional-model-${modelId}`,
        optionalModels.includes(modelId),
        `expected optionalModels to include ${modelId}`
      )
    ),
    ...chatPromptEvalConfig.forbiddenOptionalModels.map(modelId =>
      result(
        'chat-prompt',
        `chat-prompt-forbidden-model-${modelId}`,
        !optionalModels.includes(modelId),
        `expected optionalModels not to include ${modelId}`
      )
    ),
  ];

  for (const substringCase of chatPromptEvalConfig.requiredSubstrings) {
    const content = contentForScope(prompt, substringCase.scope);
    checks.push(
      result(
        'chat-prompt',
        substringCase.id,
        content.includes(substringCase.substring),
        `expected ${substringCase.scope} prompt content to include "${substringCase.substring}"`
      )
    );
  }

  return checks;
}

export function runPromptEval(): PromptEvalReport {
  const results = [
    ...runScenarioEval(),
    ...runModeAddendumEval(),
    ...runChatPromptEval(),
  ];
  const failed = results.filter(check => !check.pass).length;
  const passed = results.length - failed;

  return {
    ok: failed === 0,
    total: results.length,
    passed,
    failed,
    results,
  };
}

export function formatPromptEvalReport(report: PromptEvalReport): string {
  const lines = [
    `AI chat prompt eval: ${report.passed}/${report.total} passed`,
  ];
  if (report.ok) {
    return lines.join('\n');
  }

  lines.push('Failures:');
  for (const failure of report.results.filter(check => !check.pass)) {
    lines.push(`- [${failure.area}] ${failure.id}: ${failure.message}`);
  }
  return lines.join('\n');
}
