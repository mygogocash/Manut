/**
 * AgentAvatar — small display component for an agent's Avataaars-style avatar.
 *
 * Usage: `<AgentAvatar agent={agent} size={32} />`
 *
 * If `agent.avatar` is missing or empty, a deterministic default is generated
 * by hashing `agent.id` so the same agent always gets the same default look
 * across renders / sessions.
 */

import { type CSSProperties, type FC, useMemo } from 'react';
// avataaars's runtime is a class component using legacy lifecycle hooks; we
// import the default export. Types in the package are written for React 17 —
// we cast at the call site so it's accepted by the React 19 typings here.
import AvataaarsAvatar from 'avataaars';

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

const DEFAULT_EYES = [
  'Default',
  'Happy',
  'Side',
  'Squint',
  'Wink',
] as const;

const DEFAULT_EYEBROWS = [
  'Default',
  'DefaultNatural',
  'RaisedExcited',
  'UpDown',
  'FlatNatural',
] as const;

const DEFAULT_MOUTHS = [
  'Smile',
  'Default',
  'Twinkle',
  'Serious',
] as const;

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

const AvataaarsAny = AvataaarsAvatar as unknown as FC<Record<string, unknown>>;

export const AgentAvatar: FC<AgentAvatarProps> = ({
  agent,
  size = 32,
  className,
  style,
  bare,
}) => {
  // Resolve the avatar config: explicit > deterministic default.
  const config = useMemo(() => {
    const explicit = agent.avatar;
    if (explicit && Object.keys(explicit).length > 0) {
      // Merge explicit on top of defaults so partially-saved avatars look ok.
      return { ...defaultAvatarForId(agent.id), ...explicit };
    }
    return defaultAvatarForId(agent.id);
  }, [agent.id, agent.avatar]);

  const wrapperStyle: CSSProperties = {
    width: size,
    height: size,
    ...(bare ? { background: 'transparent' } : {}),
    ...style,
  };

  // The avataaars SVG has its own viewBox. Sizing the wrapper to size×size
  // and letting the SVG fill 100% gives a crisp scaled circle.
  return (
    <span
      className={[styles.wrapper, className].filter(Boolean).join(' ') || undefined}
      style={wrapperStyle}
      data-testid="agent-avatar"
      aria-label={agent.name ? `${agent.name} avatar` : 'Agent avatar'}
    >
      <AvataaarsAny
        avatarStyle="Transparent"
        className={styles.svg}
        topType={config.topType}
        accessoriesType={config.accessoriesType}
        hairColor={config.hairColor}
        facialHairType={config.facialHairType}
        facialHairColor={config.facialHairColor}
        clotheType={config.clotheType}
        clotheColor={config.clotheColor}
        graphicType={config.graphicType}
        eyeType={config.eyeType}
        eyebrowType={config.eyebrowType}
        mouthType={config.mouthType}
        skinColor={config.skinColor}
      />
    </span>
  );
};
