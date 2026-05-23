/**
 * @vitest-environment happy-dom
 */
import { describe, expect, test } from 'vitest';

import { DEFAULT_FORMAT } from '../../utils/format-prompt';
import { getFormatSelectorTriggerLabel } from './format-selector';

describe('AIChatInput footer controls', () => {
  test('AIChatInput > given default auto format and auto model > renders one visible Auto control', () => {
    const visibleLabels = [
      getFormatSelectorTriggerLabel(DEFAULT_FORMAT),
      'Auto',
    ];

    expect(visibleLabels.filter(label => label === 'Auto')).toHaveLength(1);
  });
});
