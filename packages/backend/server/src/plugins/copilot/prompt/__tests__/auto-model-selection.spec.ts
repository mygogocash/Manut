import test from 'ava';

import type { PromptAttachment } from '../../providers/types.js';
import { selectAutoModelForScenario } from '../auto-model-selection.js';

const scenariosConfig = {
  scenarios: {
    chat: 'gemini-2.5-flash',
    quick_text_generation: 'gemini-2.5-flash',
    complex_text_generation: 'gemini-2.5-pro',
    image: 'gpt-image-1',
  },
};

test('selectAutoModelForScenario__given_long_chat_input__then_routes_to_long_context_model', t => {
  const content = 'context '.repeat(16_000);

  t.is(
    selectAutoModelForScenario({
      scenario: 'chat',
      content,
      scenariosConfig,
    }),
    'gemini-2.5-pro'
  );
});

test('selectAutoModelForScenario__given_code_input__then_routes_to_claude_code_model', t => {
  t.is(
    selectAutoModelForScenario({
      scenario: 'quick_text_generation',
      content:
        'Please refactor this function:\n```ts\nexport function sum(items: number[]) { return items.reduce((a, b) => a + b, 0); }\n```',
      scenariosConfig,
    }),
    'claude-sonnet-4-5@20250929'
  );
});

test('selectAutoModelForScenario__given_image_input__then_avoids_openai_image_model_for_text_chat', t => {
  t.is(
    selectAutoModelForScenario({
      scenario: 'image',
      content: 'convert this image into a cleaner icon',
      attachments: [
        {
          attachment: 'handle://image-1',
          mimeType: 'image/png',
        } as unknown as PromptAttachment,
      ],
      scenariosConfig,
    }),
    'gemini-2.5-flash'
  );
});

test('selectAutoModelForScenario__given_complex_text_scenario__then_uses_scenario_config_model', t => {
  t.is(
    selectAutoModelForScenario({
      scenario: 'complex_text_generation',
      content:
        'Please create a presentation outline for our AI chat launch covering citations, mobile, safety and rollout.',
      scenariosConfig,
    }),
    'gemini-2.5-pro'
  );
});
