import { describe, expect, test } from 'vitest';

import {
  ANALYTICS_PLATFORM_ACCOUNT_LABELS,
  ANALYTICS_PLATFORM_LABELS,
  LINE_CONNECTION_CARD_COPY,
} from '../entities/platform-copy';

describe('analytics platform copy', () => {
  test('LINE labels use Official Account wording until VOOM API access is confirmed', () => {
    expect(ANALYTICS_PLATFORM_LABELS.LINE_VOOM).toBe('LINE Official Account');
    expect(ANALYTICS_PLATFORM_ACCOUNT_LABELS.LINE_VOOM).toBe(
      'LINE Official Account channel'
    );
  });

  test('LINE connection description does not promise VOOM post analytics', () => {
    expect(LINE_CONNECTION_CARD_COPY.name).toBe('LINE Official Account');
    expect(LINE_CONNECTION_CARD_COPY.description).toContain(
      'Messaging API events'
    );
    expect(LINE_CONNECTION_CARD_COPY.description).toContain(
      'VOOM post analytics stay hidden'
    );
  });
});
