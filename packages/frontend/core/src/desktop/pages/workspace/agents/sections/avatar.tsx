/**
 * AvatarSection — Picrew-style picker for an agent's Avataaars avatar.
 *
 * Renders a live preview of the current `value` and a tabbed editor for each
 * category (Top, Accessory, Eyes, Eyebrow, Mouth, Facial Hair, Clothes, Skin).
 * On every change, calls `onChange(nextAvatar)` with the merged config.
 *
 * Color pickers (hair / clothes / facial hair / skin) sit next to their
 * matching category as a small palette of preset swatches.
 */

import { UserIcon } from '@blocksuite/icons/rc';
import { type FC, useCallback, useMemo, useState } from 'react';

import {
  AgentAvatar,
  type AgentAvatarConfig,
  defaultAvatarForId,
} from '../../../../../components/agent-avatar';
import * as styles from './avatar.css';

// ---- Public API ------------------------------------------------------------

export interface AvatarSectionProps {
  /** Stable agent id — used for the deterministic default avatar. */
  agentId: string;
  /** The agent's display name (used for accessible labels). */
  agentName?: string;
  /** Current persisted avatar config. */
  value: AgentAvatarConfig | null | undefined;
  /** Called whenever the user picks a new option. */
  onChange: (next: AgentAvatarConfig) => void;
  disabled?: boolean;
}

// ---- Option catalog --------------------------------------------------------

// Mirrors the option lists shipped by avataaars. Hand-extracted so the picker
// stays decoupled from the library's runtime registration.

const TOP_TYPES: readonly string[] = [
  'NoHair',
  'Eyepatch',
  'Hat',
  'Hijab',
  'Turban',
  'WinterHat1',
  'WinterHat2',
  'WinterHat3',
  'WinterHat4',
  'LongHairBigHair',
  'LongHairBob',
  'LongHairBun',
  'LongHairCurly',
  'LongHairCurvy',
  'LongHairDreads',
  'LongHairFrida',
  'LongHairFro',
  'LongHairFroBand',
  'LongHairNotTooLong',
  'LongHairShavedSides',
  'LongHairMiaWallace',
  'LongHairStraight',
  'LongHairStraight2',
  'LongHairStraightStrand',
  'ShortHairDreads01',
  'ShortHairDreads02',
  'ShortHairFrizzle',
  'ShortHairShaggyMullet',
  'ShortHairShortCurly',
  'ShortHairShortFlat',
  'ShortHairShortRound',
  'ShortHairShortWaved',
  'ShortHairSides',
  'ShortHairTheCaesar',
  'ShortHairTheCaesarSidePart',
];

const ACCESSORY_TYPES: readonly string[] = [
  'Blank',
  'Kurt',
  'Prescription01',
  'Prescription02',
  'Round',
  'Sunglasses',
  'Wayfarers',
];

const FACIAL_HAIR_TYPES: readonly string[] = [
  'Blank',
  'BeardLight',
  'BeardMajestic',
  'BeardMedium',
  'MoustacheFancy',
  'MoustacheMagnum',
];

const CLOTHE_TYPES: readonly string[] = [
  'BlazerShirt',
  'BlazerSweater',
  'CollarSweater',
  'GraphicShirt',
  'Hoodie',
  'Overall',
  'ShirtCrewNeck',
  'ShirtScoopNeck',
  'ShirtVNeck',
];

const EYE_TYPES: readonly string[] = [
  'Default',
  'Close',
  'Cry',
  'Dizzy',
  'EyeRoll',
  'Happy',
  'Hearts',
  'Side',
  'Squint',
  'Surprised',
  'Wink',
  'WinkWacky',
];

const EYEBROW_TYPES: readonly string[] = [
  'Default',
  'DefaultNatural',
  'Angry',
  'AngryNatural',
  'FlatNatural',
  'RaisedExcited',
  'RaisedExcitedNatural',
  'SadConcerned',
  'SadConcernedNatural',
  'UnibrowNatural',
  'UpDown',
  'UpDownNatural',
  'FrownNatural',
];

const MOUTH_TYPES: readonly string[] = [
  'Default',
  'Smile',
  'Twinkle',
  'Serious',
  'Concerned',
  'Disbelief',
  'Eating',
  'Grimace',
  'Sad',
  'ScreamOpen',
  'Tongue',
  'Vomit',
];

// ---- Color palettes (hex values come from the avataaars library) -----------

const HAIR_COLORS: { value: string; label: string; hex: string }[] = [
  { value: 'Auburn', label: 'Auburn', hex: '#A55728' },
  { value: 'Black', label: 'Black', hex: '#2C1B18' },
  { value: 'Blonde', label: 'Blonde', hex: '#B58143' },
  { value: 'BlondeGolden', label: 'Golden', hex: '#D6B370' },
  { value: 'Brown', label: 'Brown', hex: '#724133' },
  { value: 'BrownDark', label: 'Brown Dark', hex: '#4A312C' },
  { value: 'PastelPink', label: 'Pink', hex: '#F59797' },
  { value: 'Blue', label: 'Blue', hex: '#000fdb' },
  { value: 'Platinum', label: 'Platinum', hex: '#ECDCBF' },
  { value: 'Red', label: 'Red', hex: '#C93305' },
  { value: 'SilverGray', label: 'Silver', hex: '#E8E1E1' },
];

const CLOTHE_COLORS: { value: string; label: string; hex: string }[] = [
  { value: 'Black', label: 'Black', hex: '#262E33' },
  { value: 'Blue01', label: 'Blue Light', hex: '#65C9FF' },
  { value: 'Blue02', label: 'Blue', hex: '#5199E4' },
  { value: 'Blue03', label: 'Blue Dark', hex: '#25557C' },
  { value: 'Gray01', label: 'Gray Light', hex: '#E6E6E6' },
  { value: 'Gray02', label: 'Gray', hex: '#929598' },
  { value: 'Heather', label: 'Heather', hex: '#3C4F5C' },
  { value: 'PastelBlue', label: 'Pastel Blue', hex: '#B1E2FF' },
  { value: 'PastelGreen', label: 'Pastel Green', hex: '#A7FFC4' },
  { value: 'PastelOrange', label: 'Pastel Orange', hex: '#FFDEB5' },
  { value: 'PastelRed', label: 'Pastel Red', hex: '#FFAFB9' },
  { value: 'PastelYellow', label: 'Pastel Yellow', hex: '#FFFFB1' },
  { value: 'Pink', label: 'Pink', hex: '#FF488E' },
  { value: 'Red', label: 'Red', hex: '#FF5C5C' },
  { value: 'White', label: 'White', hex: '#FFFFFF' },
];

const SKIN_COLORS: { value: string; label: string; hex: string }[] = [
  { value: 'Tanned', label: 'Tanned', hex: '#FD9841' },
  { value: 'Yellow', label: 'Yellow', hex: '#F8D25C' },
  { value: 'Pale', label: 'Pale', hex: '#FFDBB4' },
  { value: 'Light', label: 'Light', hex: '#EDB98A' },
  { value: 'Brown', label: 'Brown', hex: '#D08B5B' },
  { value: 'DarkBrown', label: 'Dark Brown', hex: '#AE5D29' },
  { value: 'Black', label: 'Black', hex: '#614335' },
];

// ---- Tab definitions -------------------------------------------------------

type CategoryKey =
  | 'top'
  | 'accessories'
  | 'eyes'
  | 'eyebrow'
  | 'mouth'
  | 'facialHair'
  | 'clothes'
  | 'skin';

interface TabDef {
  key: CategoryKey;
  label: string;
  /** Field on AgentAvatarConfig this tab edits. */
  field: keyof AgentAvatarConfig;
  /** Available values rendered as thumbnails. */
  values: readonly string[];
  /** Whether `Blank` is a valid value (for "no item" looks). */
  hasBlank?: boolean;
}

const TABS: readonly TabDef[] = [
  { key: 'top', label: 'Hair', field: 'topType', values: TOP_TYPES },
  {
    key: 'accessories',
    label: 'Accessory',
    field: 'accessoriesType',
    values: ACCESSORY_TYPES,
    hasBlank: true,
  },
  { key: 'eyes', label: 'Eyes', field: 'eyeType', values: EYE_TYPES },
  {
    key: 'eyebrow',
    label: 'Brow',
    field: 'eyebrowType',
    values: EYEBROW_TYPES,
  },
  { key: 'mouth', label: 'Mouth', field: 'mouthType', values: MOUTH_TYPES },
  {
    key: 'facialHair',
    label: 'Facial Hair',
    field: 'facialHairType',
    values: FACIAL_HAIR_TYPES,
    hasBlank: true,
  },
  { key: 'clothes', label: 'Clothes', field: 'clotheType', values: CLOTHE_TYPES },
  { key: 'skin', label: 'Skin', field: 'skinColor', values: [] },
];

// ---- Helpers ---------------------------------------------------------------

/** Override one field on the config and pass through to onChange. */
function withField(
  config: AgentAvatarConfig,
  field: keyof AgentAvatarConfig,
  value: string
): AgentAvatarConfig {
  return { ...config, [field]: value };
}

// ---- Color picker subcomponent --------------------------------------------

interface ColorPickerProps {
  label: string;
  options: { value: string; label: string; hex: string }[];
  selected?: string;
  onSelect: (value: string) => void;
  disabled?: boolean;
}

const ColorPicker: FC<ColorPickerProps> = ({
  label,
  options,
  selected,
  onSelect,
  disabled,
}) => {
  return (
    <div className={styles.swatchRow} role="radiogroup" aria-label={label}>
      <span className={styles.swatchLabel}>{label}</span>
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          className={styles.swatch}
          data-selected={selected === opt.value}
          style={{ background: opt.hex }}
          onClick={() => onSelect(opt.value)}
          disabled={disabled}
          aria-label={opt.label}
          aria-pressed={selected === opt.value}
          title={opt.label}
        />
      ))}
    </div>
  );
};

// ---- Option grid subcomponent ---------------------------------------------

interface OptionGridProps {
  agentId: string;
  /** The committed avatar config (for thumbnail rendering). */
  baseConfig: AgentAvatarConfig;
  field: keyof AgentAvatarConfig;
  values: readonly string[];
  hasBlank?: boolean;
  selected?: string;
  onSelect: (value: string) => void;
  disabled?: boolean;
}

const OptionGrid: FC<OptionGridProps> = ({
  agentId,
  baseConfig,
  field,
  values,
  hasBlank,
  selected,
  onSelect,
  disabled,
}) => {
  // We render each thumbnail as a small AgentAvatar with the option applied
  // on top of the current config — so the user previews "what does my avatar
  // look like with this choice?" rather than a generic thumbnail.
  const items = useMemo(() => {
    const list = [...values];
    if (hasBlank && !list.includes('Blank')) {
      list.unshift('Blank');
    }
    return list;
  }, [values, hasBlank]);

  return (
    <div className={styles.optionGrid} role="radiogroup">
      {items.map(value => {
        const previewAgent = {
          id: agentId,
          avatar: { ...baseConfig, [field]: value },
        };
        const isSelected = selected === value;
        return (
          <button
            key={value}
            type="button"
            className={styles.optionThumb}
            data-selected={isSelected}
            onClick={() => onSelect(value)}
            disabled={disabled}
            aria-label={value}
            aria-pressed={isSelected}
            title={value}
          >
            <span className={styles.optionThumbInner}>
              <AgentAvatar agent={previewAgent} size={56} bare />
            </span>
          </button>
        );
      })}
    </div>
  );
};

// ---- Main section ----------------------------------------------------------

export const AvatarSection: FC<AvatarSectionProps> = ({
  agentId,
  agentName,
  value,
  onChange,
  disabled,
}) => {
  const [activeTab, setActiveTab] = useState<CategoryKey>('top');

  // Resolve the "current" config for previewing — explicit value wins, but
  // falls back to the deterministic default so partial configs render fully.
  const config = useMemo<AgentAvatarConfig>(() => {
    const def = defaultAvatarForId(agentId);
    return value ? { ...def, ...value } : def;
  }, [agentId, value]);

  const setField = useCallback(
    (field: keyof AgentAvatarConfig, next: string) => {
      onChange(withField(config, field, next));
    },
    [config, onChange]
  );

  const handleReset = useCallback(() => {
    onChange(defaultAvatarForId(agentId));
  }, [agentId, onChange]);

  const previewAgent = useMemo(
    () => ({ id: agentId, name: agentName, avatar: config }),
    [agentId, agentName, config]
  );

  const tab = TABS.find(t => t.key === activeTab) ?? TABS[0];

  return (
    <section className={styles.section} aria-labelledby="agent-avatar-heading">
      <div className={styles.sectionHeader}>
        <span className={styles.sectionIcon} aria-hidden="true">
          <UserIcon />
        </span>
        <h3 id="agent-avatar-heading" className={styles.sectionTitle}>
          Avatar
        </h3>
      </div>
      <p className={styles.sectionDescription}>
        Customize how this agent looks across the app.
      </p>

      <div className={styles.layout}>
        <div className={styles.previewColumn}>
          <div className={styles.preview}>
            <AgentAvatar agent={previewAgent} size={160} bare />
          </div>
          <button
            type="button"
            className={styles.resetButton}
            onClick={handleReset}
            disabled={disabled}
          >
            Reset to default
          </button>
        </div>

        <div className={styles.editorColumn}>
          <div className={styles.tabBar} role="tablist">
            {TABS.map(t => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={activeTab === t.key}
                data-active={activeTab === t.key}
                className={styles.tabButton}
                onClick={() => setActiveTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {activeTab === 'skin' ? (
            <ColorPicker
              label="Skin tone"
              options={SKIN_COLORS}
              selected={config.skinColor}
              onSelect={v => setField('skinColor', v)}
              disabled={disabled}
            />
          ) : (
            <OptionGrid
              agentId={agentId}
              baseConfig={config}
              field={tab.field}
              values={tab.values}
              hasBlank={tab.hasBlank}
              selected={config[tab.field] as string | undefined}
              onSelect={v => setField(tab.field, v)}
              disabled={disabled}
            />
          )}

          {/* Color pickers tied to the active tab */}
          {activeTab === 'top' && config.topType !== 'NoHair' ? (
            <ColorPicker
              label="Hair color"
              options={HAIR_COLORS}
              selected={config.hairColor}
              onSelect={v => setField('hairColor', v)}
              disabled={disabled}
            />
          ) : null}

          {activeTab === 'facialHair' &&
          config.facialHairType &&
          config.facialHairType !== 'Blank' ? (
            <ColorPicker
              label="Facial hair color"
              options={HAIR_COLORS}
              selected={config.facialHairColor}
              onSelect={v => setField('facialHairColor', v)}
              disabled={disabled}
            />
          ) : null}

          {activeTab === 'clothes' ? (
            <ColorPicker
              label="Clothes color"
              options={CLOTHE_COLORS}
              selected={config.clotheColor}
              onSelect={v => setField('clotheColor', v)}
              disabled={disabled}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
};
