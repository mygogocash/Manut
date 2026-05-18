/**
 * Manut design tokens (TypeScript bindings).
 *
 * These constants reference the CSS custom properties declared in
 * `manut-tokens.css`. Use them inside vanilla-extract `.css.ts` files
 * instead of typing the variable names by hand, so renames stay
 * type-safe and IDE autocomplete works.
 *
 * Example:
 *
 *     import { manutColor, manutRadius, manutSpace } from '@affine/component';
 *
 *     export const chip = style({
 *       backgroundColor: manutColor.blue.bg,
 *       color: manutColor.blue.fg,
 *       borderRadius: manutRadius.chip,
 *       padding: `${manutSpace(1)} ${manutSpace(2)}`,
 *     });
 *
 * IMPORTANT — keep this module LEAF-PURE. It must NOT import anything
 * from `@affine/component` package root or any other module that drags
 * in DOM-only symbols (e.g. `HTMLElement`). vanilla-extract evaluates
 * `.css.ts` files in a Node VM at build time and any transitive import
 * that references the DOM at module scope will crash the bundle. See
 * CLAUDE.md §6 "vanilla-extract evaluates .css.ts files in a Node VM".
 */

/**
 * Accent colour ramp. Each named accent exposes a foreground tone, a
 * surface tint, and a border tint. The CSS values flip automatically
 * between light and dark themes via `manut-tokens.css`.
 */
export const manutColor = {
  blue: {
    fg: 'var(--manut-accent-blue-fg)',
    bg: 'var(--manut-accent-blue-bg)',
    border: 'var(--manut-accent-blue-border)',
  },
  violet: {
    fg: 'var(--manut-accent-violet-fg)',
    bg: 'var(--manut-accent-violet-bg)',
    border: 'var(--manut-accent-violet-border)',
  },
  magenta: {
    fg: 'var(--manut-accent-magenta-fg)',
    bg: 'var(--manut-accent-magenta-bg)',
    border: 'var(--manut-accent-magenta-border)',
  },
  lime: {
    fg: 'var(--manut-accent-lime-fg)',
    bg: 'var(--manut-accent-lime-bg)',
    border: 'var(--manut-accent-lime-border)',
  },
  cream: {
    fg: 'var(--manut-accent-cream-fg)',
    bg: 'var(--manut-accent-cream-bg)',
    border: 'var(--manut-accent-cream-border)',
  },
} as const;

export type ManutAccentName = keyof typeof manutColor;
export type ManutAccentTone = keyof (typeof manutColor)[ManutAccentName];

/**
 * Corner radii. Use these instead of hard-coding pixel values so the
 * shape language stays consistent across surfaces.
 */
export const manutRadius = {
  /** Pill / chip / tag corners. */
  chip: 'var(--manut-radius-chip)',
  /** Inputs, buttons, small interactive elements. */
  input: 'var(--manut-radius-input)',
  /** Cards, hero tiles, surface containers. */
  card: 'var(--manut-radius-card)',
  /** Modals, popovers, large floating surfaces. */
  modal: 'var(--manut-radius-modal)',
  /** Full-screen sheets, bottom drawers, large editorial surfaces. */
  sheet: 'var(--manut-radius-sheet)',
} as const;

export type ManutRadius = keyof typeof manutRadius;

/**
 * Spacing scale level. Use {@link manutSpace} to translate a level
 * into the corresponding CSS var.
 */
export type ManutSpaceLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

/**
 * Spacing helper. Returns a `var(--manut-space-N)` reference.
 *
 *     padding: `${manutSpace(2)} ${manutSpace(4)}`,
 */
export function manutSpace(level: ManutSpaceLevel): string {
  return `var(--manut-space-${level})`;
}

/**
 * Display typography scale level. {@link manutDisplay.scale} maps
 * a level to the corresponding `font-size` CSS var.
 */
export type ManutDisplayLevel = 1 | 2 | 3 | 4 | 5;

/**
 * Display typography tokens. Pair `scale(N)` with the shared
 * `font`, `weight`, `lineHeight`, and `letterSpacing` constants to
 * compose Manut-grade headlines.
 */
export const manutDisplay = {
  /** Returns the `var(--manut-display-N)` font-size reference. */
  scale: (level: ManutDisplayLevel): string => `var(--manut-display-${level})`,
  /**
   * Font family for display text. Currently aliases the body font
   * (Inter); a real variable display face is a follow-up.
   */
  font: 'var(--manut-font-display)',
  weight: 'var(--manut-display-weight)',
  lineHeight: 'var(--manut-display-line-height)',
  letterSpacing: 'var(--manut-display-letter-spacing)',
} as const;

/**
 * Motion tokens. These complement `animationToken` in `animation.ts`
 * with Manut-specific overshoot/spring curves and a stagger duration
 * for sequenced reveals. The stagger duration honours
 * `prefers-reduced-motion: reduce` automatically.
 */
export const manutMotion = {
  /** Springy overshoot curve. Use for "playful" entrances. */
  curveSpring: 'var(--manut-anim-curve-spring)',
  /** Gentler overshoot curve. Use for hover / press feedback. */
  curveOvershoot: 'var(--manut-anim-curve-overshoot)',
  /** Inter-item delay when staggering a sequence of reveals. */
  durationStagger: 'var(--manut-anim-duration-stagger)',
} as const;

/**
 * Glass surface tokens. Use {@link manutGlass.backdropFilter} as the
 * canonical `backdrop-filter` shorthand to keep the blur + saturate
 * pair consistent across surfaces.
 */
export const manutGlass = {
  /** Default glass tint (72% white / 60% near-black). */
  surface: 'var(--manut-surface-glass)',
  /** Stronger glass tint (88% white / 80% near-black). */
  surfaceStrong: 'var(--manut-surface-glass-strong)',
  blur: 'var(--manut-surface-glass-blur)',
  saturate: 'var(--manut-surface-glass-saturate)',
  /** Convenience: the full `backdrop-filter` shorthand string. */
  backdropFilter:
    'blur(var(--manut-surface-glass-blur)) saturate(var(--manut-surface-glass-saturate))',
} as const;
