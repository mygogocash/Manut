import { describe, expect, test } from 'vitest';

import { resolveUsageProgressState } from './usage-state';

describe('mobile storage usage', () => {
  test('mobile storage usage > given quota load error > then surfaces fallback storage information', () => {
    const state = resolveUsageProgressState({
      color: null,
      fallback: {
        maxFormatted: '2 GB',
        percent: 0.5,
        usedFormatted: '0 B',
      },
      loadError: new Error('quota unavailable'),
      maxFormatted: null,
      percent: null,
      usedFormatted: null,
    });

    expect(state).toEqual({
      color: null,
      desc: '0 B/2 GB',
      kind: 'ready',
      name: 'Cloud',
      percent: 0.5,
    });
  });

  test('mobile storage usage > given quota is still loading > then keeps the loading state', () => {
    const state = resolveUsageProgressState({
      color: null,
      fallback: {
        maxFormatted: '2 GB',
        percent: 0.5,
        usedFormatted: '0 B',
      },
      loadError: null,
      maxFormatted: null,
      percent: null,
      usedFormatted: null,
    });

    expect(state).toEqual({ kind: 'loading' });
  });
});
