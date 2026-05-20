/**
 * Manut M2 E2.7 — Framer Motion presets.
 *
 * Three spring-tuned presets and a shared stagger config that the rest of
 * the visual polish layer (skeletons, hover previews, magic-line tab
 * indicators, button press scale, AI token streaming) builds on. The
 * presets stay narrow on purpose: the more we let callers pass arbitrary
 * spring configs inline, the more "intentional" motion will drift toward
 * generic Material Design overshoots.
 *
 * Naming convention mirrors the React Spring world: GENTLE is the everyday
 * baseline (lists, hover overlays), WOBBLY is the playful "this is the
 * Manut brand" overshoot (badges, magic-line transitions, AI streaming
 * cursor), TIGHT is the no-nonsense feel for primary actions (button
 * press scale, modal close).
 *
 * `STAGGER_30MS` is the shared list-entrance cascade; it pairs with
 * `SPRING_GENTLE` on per-child motion.div elements (see usage in the
 * floating chat tab strip and any future virtualised list that wants the
 * brand stagger).
 *
 * ## prefers-reduced-motion
 *
 * Framer Motion respects the OS-level preference automatically when the
 * caller wraps its tree in `<MotionConfig reducedMotion="user">` (or
 * "always"). We do NOT enable that globally here — individual call
 * sites opt in via `useReducedMotion()` to keep the contract explicit.
 *
 * The presets themselves contain no `duration` overrides; the spring
 * physics naturally collapse to zero distance when the source and target
 * keyframes match. Callers that need a hard kill-switch should branch on
 * `useReducedMotion()` and substitute an instant `{ duration: 0 }`
 * transition.
 */
import type { Transition } from 'framer-motion';

/**
 * Everyday spring. Stiff enough to feel responsive (~250ms to settle),
 * damped enough to avoid bouncing. Default for hover previews, skeleton
 * fades, and list entrances.
 */
export const SPRING_GENTLE: Transition = {
  type: 'spring',
  stiffness: 180,
  damping: 24,
};

/**
 * Playful overshoot. Visible bounce (~10% overshoot) for moments where
 * we want the user to notice motion: magic-line tab indicator, AI write
 * chip pulse, primary CTA on first render. Use sparingly.
 */
export const SPRING_WOBBLY: Transition = {
  type: 'spring',
  stiffness: 280,
  damping: 14,
};

/**
 * Snappy press feel. No overshoot. Used for whileTap scale on buttons
 * and for modal/popover dismissal.
 */
export const SPRING_TIGHT: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 32,
};

/**
 * Shared stagger cascade — 30ms between children. Matches the
 * `--manut-anim-duration-stagger` token's spirit (50ms) but trimmed to
 * 30ms because Framer Motion's spring physics already perceptually
 * lengthen each child's entrance.
 *
 * Pass on the container `transition`:
 *
 * ```tsx
 * <motion.ul transition={STAGGER_30MS}>
 *   {items.map(i => <motion.li transition={SPRING_GENTLE} ... />)}
 * </motion.ul>
 * ```
 */
export const STAGGER_30MS = {
  staggerChildren: 0.03,
} as const;

/**
 * Standard list-child entrance: fade up from 8px below resting position.
 * Pair with {@link SPRING_GENTLE} as the transition for the item.
 */
export const FADE_UP_VARIANTS = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
} as const;
