/**
 * AgentAvatar — small display component for an agent's Avataaars-style avatar.
 *
 * Usage: `<AgentAvatar agent={agent} size={32} />`
 *
 * If `agent.avatar` is missing or empty, a deterministic default is generated
 * by hashing `agent.id` so the same agent always gets the same default look
 * across renders / sessions.
 */

// avataaars's wrapper component uses the LEGACY React context API
// (`childContextTypes` / `getChildContext`), which was removed in React 19.
// On modern React the inner SVG can't read its `optionContext`, so calling
// `optionContext.addStateChangeListener(...)` crashes the page with
// "Cannot read properties of undefined". Reproduces 100% on agent create.
//
// We render a deterministic letter+color avatar instead — same visual slot,
// same prop surface, no React-19 incompatibilities. Backend AgentAvatarConfig
// is preserved so the wire contract doesn't change; we just don't generate
// or consume it on the client. If we want cartoon avatars back, swap to a
// modern lib (e.g. @dicebear/core) that uses props or hooks.
import { type CSSProperties, type FC, useMemo } from 'react';

import * as styles from './index.css';

// ---- Avatar shape (matches the backend contract) ----------------------------

export interface AgentAvatarConfig {
  topType?: string;
  accessoriesType?: string;
  hairColor?: string;
  facialHairType?: string;
  facialHairColor?: string;
  clotheType?: string;
  clotheColor?: string;
  graphicType?: string;
  eyeType?: string;
  eyebrowType?: string;
  mouthType?: string;
  skinColor?: string;
}

interface AgentLike {
  id: string;
  name?: string;
  avatar?: AgentAvatarConfig | null;
}

export interface AgentAvatarProps {
  agent: AgentLike;
  size?: number;
  /** Optional className appended to the wrapper. */
  className?: string;
  /** Optional inline style appended to the wrapper. */
  style?: CSSProperties;
  /** When true, renders without the circular wrapper (transparent SVG only). */
  bare?: boolean;
}

// ---- Deterministic default avatar from agent id -----------------------------

// Stable, lightweight non-cryptographic hash. We don't need cryptographic
// strength — just consistent bucketing per agent id.
function hashString(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

// Pools of safe, broadly-flattering options for the deterministic default.
// Kept smaller than the full picker palette so defaults stay tasteful.
const DEFAULT_TOPS = [
  'ShortHairShortFlat',
  'ShortHairShortRound',
  'ShortHairShortWaved',
  'ShortHairSides',
  'ShortHairTheCaesar',
  'LongHairStraight',
  'LongHairBob',
  'LongHairCurly',
  'LongHairBun',
  'LongHairMiaWallace',
  'NoHair',
  'Hat',
] as const;

const DEFAULT_ACCESSORIES = [
  'Blank',
  'Blank',
  'Blank',
  'Round',
  'Prescription02',
] as const;

const DEFAULT_HAIR_COLORS = [
  'BrownDark',
  'Brown',
  'Black',
  'Blonde',
  'Auburn',
  'Red',
  'SilverGray',
  'Platinum',
] as const;

const DEFAULT_FACIAL_HAIR = [
  'Blank',
  'Blank',
  'Blank',
  'Blank',
  'BeardLight',
  'BeardMedium',
  'MoustacheFancy',
] as const;

const DEFAULT_CLOTHES = [
  'BlazerShirt',
  'CollarSweater',
  'Hoodie',
  'ShirtCrewNeck',
  'ShirtScoopNeck',
  'ShirtVNeck',
  'BlazerSweater',
] as const;

const DEFAULT_CLOTHE_COLORS = [
  'Blue02',
  'Blue03',
  'Heather',
  'PastelBlue',
  'PastelGreen',
  'Pink',
  'Gray02',
  'Black',
] as const;

const DEFAULT_EYES = ['Default', 'Happy', 'Side', 'Squint', 'Wink'] as const;

const DEFAULT_EYEBROWS = [
  'Default',
  'DefaultNatural',
  'RaisedExcited',
  'UpDown',
  'FlatNatural',
] as const;

const DEFAULT_MOUTHS = ['Smile', 'Default', 'Twinkle', 'Serious'] as const;

const DEFAULT_SKIN = [
  'Light',
  'Pale',
  'Tanned',
  'Yellow',
  'Brown',
  'DarkBrown',
  'Black',
] as const;

function pick<T>(pool: readonly T[], seed: number, salt: number): T {
  // Mix salt back into seed so different categories pick independently.
  const mixed = (seed ^ Math.imul(salt + 0x9e3779b9, 0x85ebca6b)) >>> 0;
  return pool[mixed % pool.length] as T;
}

export function defaultAvatarForId(agentId: string): AgentAvatarConfig {
  const seed = hashString(agentId);
  return {
    topType: pick(DEFAULT_TOPS, seed, 1),
    accessoriesType: pick(DEFAULT_ACCESSORIES, seed, 2),
    hairColor: pick(DEFAULT_HAIR_COLORS, seed, 3),
    facialHairType: pick(DEFAULT_FACIAL_HAIR, seed, 4),
    facialHairColor: pick(DEFAULT_HAIR_COLORS, seed, 5),
    clotheType: pick(DEFAULT_CLOTHES, seed, 6),
    clotheColor: pick(DEFAULT_CLOTHE_COLORS, seed, 7),
    graphicType: 'Bat',
    eyeType: pick(DEFAULT_EYES, seed, 8),
    eyebrowType: pick(DEFAULT_EYEBROWS, seed, 9),
    mouthType: pick(DEFAULT_MOUTHS, seed, 10),
    skinColor: pick(DEFAULT_SKIN, seed, 11),
  };
}

// ---- Component --------------------------------------------------------------

// Hand-picked palette — accessible contrast against white text, broadly
// pleasant. Order matters: hashed agent ids index into this directly.
const LETTER_AVATAR_COLORS = [
  '#3478F6', // blue
  '#34C759', // green
  '#FF9500', // orange
  '#AF52DE', // purple
  '#FF3B30', // red
  '#5AC8FA', // cyan
  '#FFCC00', // yellow
  '#FF2D55', // pink
  '#5856D6', // indigo
  '#A2845E', // brown
];

function letterFor(name?: string): string {
  const trimmed = name?.trim();
  if (!trimmed) return '?';
  // Use the first non-whitespace code point — handles emoji + non-Latin.
  const cp = trimmed.codePointAt(0);
  if (cp === undefined) return '?';
  return String.fromCodePoint(cp).toUpperCase();
}

export const AgentAvatar: FC<AgentAvatarProps> = ({
  agent,
  size = 32,
  className,
  style,
  bare,
}) => {
  const { letter, color } = useMemo(() => {
    const seed = hashString(agent.id);
    return {
      letter: letterFor(agent.name),
      color: LETTER_AVATAR_COLORS[seed % LETTER_AVATAR_COLORS.length],
    };
  }, [agent.id, agent.name]);

  const wrapperStyle: CSSProperties = {
    width: size,
    height: size,
    background: bare ? 'transparent' : color,
    color: '#ffffff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    fontWeight: 600,
    // Letter scales with avatar — 0.45 keeps it visually balanced inside
    // the circle from 16px (sidebar) to 96px (detail page header).
    fontSize: Math.round(size * 0.45),
    lineHeight: 1,
    overflow: 'hidden',
    userSelect: 'none',
    ...style,
  };

  return (
    <span
      className={
        [styles.wrapper, className].filter(Boolean).join(' ') || undefined
      }
      style={wrapperStyle}
      data-testid="agent-avatar"
      aria-label={agent.name ? `${agent.name} avatar` : 'Agent avatar'}
    >
      {letter}
    </span>
  );
};
