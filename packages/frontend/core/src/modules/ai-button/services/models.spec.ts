import { describe, expect, test } from 'vitest';

import type { AIModel } from './models';
import { resolveSelectedAIModelId } from './models';

const models: AIModel[] = [
  {
    id: 'auto',
    name: 'Auto',
    version: 'Smart routing',
    category: 'Auto',
    isPro: false,
    isDefault: true,
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    version: '2.5 Flash',
    category: 'Gemini',
    isPro: false,
    isDefault: false,
  },
];

describe('AIModelService selection', () => {
  test('resolveSelectedAIModelId > given no stored model > then returns visible default Auto', () => {
    expect(resolveSelectedAIModelId(models, undefined)).toBe('auto');
  });

  test('resolveSelectedAIModelId > given valid stored model > then preserves explicit model', () => {
    expect(resolveSelectedAIModelId(models, 'gemini-2.5-flash')).toBe(
      'gemini-2.5-flash'
    );
  });

  test('resolveSelectedAIModelId > given stale stored OpenAI model > then falls back to default Auto', () => {
    expect(resolveSelectedAIModelId(models, 'gpt-5-mini')).toBe('auto');
  });

  test('resolveSelectedAIModelId > given models have not loaded > then still sends Auto sentinel', () => {
    expect(resolveSelectedAIModelId([], undefined)).toBe('auto');
  });
});
