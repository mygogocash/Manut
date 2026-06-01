import { describe, expect, test } from 'vitest';

import { dueAtInputValue, dueAtToIso, readableStatus } from './helpers';

describe('projects/helpers', () => {
  test('readableStatus > given a known status > returns a human label', () => {
    expect(readableStatus('IN_PROGRESS')).toBe('In progress');
    expect(readableStatus('TODO')).toBe('To do');
    expect(readableStatus('DONE')).toBe('Done');
    expect(readableStatus('CANCELLED')).toBe('Cancelled');
    expect(readableStatus('BACKLOG')).toBe('Backlog');
  });

  test('dueAtToIso > given a date-only string > pins to UTC midnight', () => {
    expect(dueAtToIso('2026-01-15')).toBe('2026-01-15T00:00:00.000Z');
  });

  test('dueAtToIso > given empty input > returns null', () => {
    expect(dueAtToIso('')).toBeNull();
    expect(dueAtToIso(null)).toBeNull();
  });

  // M12: the picked date must survive a write→read round-trip in EVERY
  // timezone. Run under TZ=America/Los_Angeles (UTC-8): with the old
  // local-getter read this returns '2026-01-14' (drifts back a day).
  test('dueAtInputValue > given a UTC-midnight value in a negative-offset TZ > round-trips to the same calendar day', () => {
    const iso = dueAtToIso('2026-01-15');
    expect(iso).not.toBeNull();
    expect(dueAtInputValue(iso)).toBe('2026-01-15');
  });
});
