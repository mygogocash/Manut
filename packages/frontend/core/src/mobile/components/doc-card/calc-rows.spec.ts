import { describe, expect, it } from 'vitest';

import { calcRowsById } from './calc-rows';

describe('calcRowsById', () => {
  it('given a char code that maps to the top of the range > returns max (inclusive)', () => {
    // With min=2, max=8 the span is 7 distinct rows [2..8].
    // A char whose code mod 7 === 6 must yield min + 6 === 8.
    // 'h' has charCode 104; 104 % 7 === 6.
    expect('h'.charCodeAt(0) % 7).toBe(6);
    expect(calcRowsById('h')).toBe(8);
  });

  it('given any id > returns a value within [min, max] inclusive', () => {
    for (let code = 0; code < 256; code++) {
      const rows = calcRowsById(String.fromCharCode(code));
      expect(rows).toBeGreaterThanOrEqual(2);
      expect(rows).toBeLessThanOrEqual(8);
    }
  });

  it('given a char code at the bottom of the range > returns min', () => {
    // 'b' has charCode 98; 98 % 7 === 0 -> min (2).
    expect('b'.charCodeAt(0) % 7).toBe(0);
    expect(calcRowsById('b')).toBe(2);
  });
});
