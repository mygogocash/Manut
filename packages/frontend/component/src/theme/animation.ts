/**
 * Superflow animation tokens (TypeScript bindings).
 *
 * These constants reference the CSS custom properties declared in
 * `animation.css`. Use them inside vanilla-extract `.css.ts` files when
 * defining `transition` or `animation` shorthand strings, e.g.:
 *
 *     transition: `background-color ${animationToken.durationBase} ${animationToken.curveDefault}`,
 *
 * Always prefer these tokens over hard-coded durations / cubic-bezier curves
 * so that motion stays consistent with the design system and respects
 * `prefers-reduced-motion: reduce` automatically.
 */
export const animationToken = {
  /** Instant feedback: button press, scale snap-back. */
  durationFast: 'var(--affine-anim-duration-fast)',
  /** Default UI motion: hover, dropdown, popover, tooltip. */
  durationBase: 'var(--affine-anim-duration-base)',
  /** Larger surface motion: modal open, panel slide, toast. */
  durationSlow: 'var(--affine-anim-duration-slow)',
  /** Default curve — ease-out-expo. Use for entrances. */
  curveDefault: 'var(--affine-anim-curve-default)',
  /** Ease-in curve. Use for exits. */
  curveIn: 'var(--affine-anim-curve-in)',
  /** Alternate ease-out. Use when the default curve feels too snappy. */
  curveOut: 'var(--affine-anim-curve-out)',
} as const;

export type AnimationTokenKey = keyof typeof animationToken;
