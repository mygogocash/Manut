import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

import {
  manutColor,
  manutDisplay,
  manutGlass,
  manutMotion,
  manutRadius,
  manutSpace,
} from '../manut-tokens';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cssPath = resolve(__dirname, '../manut-tokens.css');

// Read the CSS file once for the contract-drift check.
// If P1-A has not yet shipped the CSS file this throws ENOENT, which
// is the right failure for that one test (other tests fail on import).
const readCssFile = (): string => readFileSync(cssPath, 'utf8');

const accentNames = ['blue', 'violet', 'magenta', 'lime', 'cream'] as const;
const radiusNames = ['chip', 'input', 'card', 'modal', 'sheet'] as const;
const displayScales = [1, 2, 3, 4, 5] as const;
const spaceLevels = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

describe('manutColor > given each accent family', () => {
  test.each(accentNames)('%s > then exports fg/bg/border var strings', name => {
    expect(manutColor[name].fg).toBe(`var(--manut-accent-${name}-fg)`);
    expect(manutColor[name].bg).toBe(`var(--manut-accent-${name}-bg)`);
    expect(manutColor[name].border).toBe(`var(--manut-accent-${name}-border)`);
  });
});

describe('manutRadius > given the five named radii', () => {
  test.each(radiusNames)('%s > then equals var(--manut-radius-%s)', name => {
    expect(manutRadius[name]).toBe(`var(--manut-radius-${name})`);
  });
});

describe('manutSpace > given level 1-12', () => {
  test.each([1, 6, 12] as const)(
    'level %i > then returns var(--manut-space-%i)',
    level => {
      expect(manutSpace(level)).toBe(`var(--manut-space-${level})`);
    }
  );
});

describe('manutDisplay > given the public surface', () => {
  test('scale(1) > then equals var(--manut-display-1)', () => {
    expect(manutDisplay.scale(1)).toBe('var(--manut-display-1)');
  });

  test('scale(5) > then equals var(--manut-display-5)', () => {
    expect(manutDisplay.scale(5)).toBe('var(--manut-display-5)');
  });

  test('font > then equals var(--manut-font-display)', () => {
    expect(manutDisplay.font).toBe('var(--manut-font-display)');
  });

  test('weight > then equals var(--manut-display-weight)', () => {
    expect(manutDisplay.weight).toBe('var(--manut-display-weight)');
  });

  test('lineHeight > then equals var(--manut-display-line-height)', () => {
    expect(manutDisplay.lineHeight).toBe('var(--manut-display-line-height)');
  });

  test('letterSpacing > then equals var(--manut-display-letter-spacing)', () => {
    expect(manutDisplay.letterSpacing).toBe(
      'var(--manut-display-letter-spacing)'
    );
  });
});

describe('manutMotion > given the curve and stagger duration tokens', () => {
  test('curveSpring > then equals var(--manut-anim-curve-spring)', () => {
    expect(manutMotion.curveSpring).toBe('var(--manut-anim-curve-spring)');
  });

  test('curveOvershoot > then equals var(--manut-anim-curve-overshoot)', () => {
    expect(manutMotion.curveOvershoot).toBe(
      'var(--manut-anim-curve-overshoot)'
    );
  });

  test('durationStagger > then equals var(--manut-anim-duration-stagger)', () => {
    expect(manutMotion.durationStagger).toBe(
      'var(--manut-anim-duration-stagger)'
    );
  });
});

describe('manutGlass > given a surface request', () => {
  test('surface > then equals var(--manut-surface-glass)', () => {
    expect(manutGlass.surface).toBe('var(--manut-surface-glass)');
  });

  test('backdropFilter > then composes blur() and saturate() from vars', () => {
    expect(manutGlass.backdropFilter).toBe(
      'blur(var(--manut-surface-glass-blur)) saturate(var(--manut-surface-glass-saturate))'
    );
  });
});

describe('manut-tokens.css > given the file content', () => {
  // This guards against drift between the CSS file and the TS contract:
  // if a sub-agent renames a CSS variable but forgets to update the TS
  // (or vice versa), this test fires before deploy. CSS is the source
  // of truth at runtime — TS is just a typed accessor.
  const expectedVars = [
    // Accents
    ...accentNames.flatMap(name => [
      `--manut-accent-${name}-fg`,
      `--manut-accent-${name}-bg`,
      `--manut-accent-${name}-border`,
    ]),
    // Radii
    ...radiusNames.map(name => `--manut-radius-${name}`),
    // Space scale 1-12
    ...spaceLevels.map(level => `--manut-space-${level}`),
    // Display
    ...displayScales.map(scale => `--manut-display-${scale}`),
    '--manut-font-display',
    '--manut-display-weight',
    '--manut-display-line-height',
    '--manut-display-letter-spacing',
    // Motion
    '--manut-anim-curve-spring',
    '--manut-anim-curve-overshoot',
    '--manut-anim-duration-stagger',
    // Glass
    '--manut-surface-glass',
    '--manut-surface-glass-blur',
    '--manut-surface-glass-saturate',
  ];

  test('declares every CSS var the TS contract references', () => {
    const css = readCssFile();
    const missing = expectedVars.filter(varName => !css.includes(varName));
    expect(missing).toEqual([]);
  });
});
