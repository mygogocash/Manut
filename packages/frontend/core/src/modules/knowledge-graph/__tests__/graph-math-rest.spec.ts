import { describe, expect, it } from 'vitest';

import { isAtRest, prefersReducedMotion } from '../utils/graph-math';

describe('isAtRest', () => {
  it('is true when all velocities are below epsilon and no pulses are active', () => {
    const velocities = [
      { vx: 0.001, vy: -0.001 },
      { vx: 0.0005, vy: 0.0005 },
    ];
    expect(isAtRest(velocities, false, 0.01)).toBe(true);
  });

  it('is false when total kinetic energy exceeds epsilon', () => {
    const velocities = [
      { vx: 0.5, vy: 0.5 },
      { vx: 0, vy: 0 },
    ];
    expect(isAtRest(velocities, false, 0.01)).toBe(false);
  });

  it('is false when pulses are active even if velocities are tiny', () => {
    const velocities = [{ vx: 0, vy: 0 }];
    // Active pulses must keep the loop alive so they can animate.
    expect(isAtRest(velocities, true, 0.01)).toBe(false);
  });

  it('is true for an empty graph with no pulses', () => {
    expect(isAtRest([], false, 0.01)).toBe(true);
  });

  it('sums the magnitude across all nodes, not per-node', () => {
    // Each node is individually under epsilon, but the SUM of magnitudes
    // exceeds it — the loop should NOT settle.
    const velocities = Array.from({ length: 100 }, () => ({
      vx: 0.02,
      vy: 0,
    }));
    // 100 nodes × magnitude 0.02 = 2.0 total, well over 0.01.
    expect(isAtRest(velocities, false, 0.01)).toBe(false);
  });
});

describe('prefersReducedMotion', () => {
  it('returns false when window is undefined (SSR guard)', () => {
    // No window in the node test environment by default, so this exercises
    // the SSR-safe early return.
    expect(prefersReducedMotion()).toBe(false);
  });

  it('returns true when matchMedia reports the reduce preference', () => {
    const fakeWindow = {
      matchMedia: (query: string) => ({
        matches: query.includes('reduce'),
      }),
    } as unknown as Window & typeof globalThis;
    expect(prefersReducedMotion(fakeWindow)).toBe(true);
  });

  it('returns false when matchMedia reports no reduce preference', () => {
    const fakeWindow = {
      matchMedia: () => ({ matches: false }),
    } as unknown as Window & typeof globalThis;
    expect(prefersReducedMotion(fakeWindow)).toBe(false);
  });

  it('returns false when matchMedia is missing on the window', () => {
    const fakeWindow = {} as unknown as Window & typeof globalThis;
    expect(prefersReducedMotion(fakeWindow)).toBe(false);
  });
});
