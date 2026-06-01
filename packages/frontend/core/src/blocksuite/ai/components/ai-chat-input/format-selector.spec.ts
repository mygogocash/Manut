/**
 * @vitest-environment happy-dom
 */
import { describe, expect, test } from 'vitest';

import {
  DEFAULT_FORMAT,
  OUTPUT_FORMAT_OPTIONS,
} from '../../utils/format-prompt';
import { getFormatSelectorTriggerLabel } from './format-selector';

describe('AIChatInput footer controls', () => {
  test('AIChatInput > given default auto format and auto model > renders one visible Auto control', () => {
    // The chip trigger label and the model picker's "Auto" are the two
    // "visible Auto controls" in the footer. The format chip must NOT add a
    // second bare "Auto" — its default trigger reads "Format" instead.
    const visibleLabels = [
      getFormatSelectorTriggerLabel(DEFAULT_FORMAT),
      'Auto',
    ];

    expect(visibleLabels.filter(label => label === 'Auto')).toHaveLength(1);
  });

  test('format options > given the default (auto) row > labels it "Auto (default)" not bare "Auto"', () => {
    // M3 relabel: the menu's selected default row reads as the neutral
    // default ("Auto (default)") so users recognise it as the no-op choice,
    // while the chip trigger stays "Format". This keeps the menu unambiguous
    // without re-introducing a bare "Auto" that collides with the model
    // picker's Auto entry.
    const autoOption = OUTPUT_FORMAT_OPTIONS.find(
      option => option.format === DEFAULT_FORMAT
    );

    expect(autoOption?.label).toBe('Auto (default)');
    expect(autoOption?.label).not.toBe('Auto');
  });
});
