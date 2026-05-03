import { cssVar } from '@toeverything/theme';
import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

export const generalAccessRoot = style({
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  marginLeft: '4px',
});

export const tierList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
});

export const tierRow = style({
  display: 'grid',
  gridTemplateColumns: '20px 1fr auto',
  alignItems: 'center',
  gap: '10px',
  padding: '8px 8px',
  borderRadius: '8px',
  border: `1px solid transparent`,
  transition: 'background-color 0.12s ease, border-color 0.12s ease',
  selectors: {
    '&:hover:not([data-disabled="true"])': {
      backgroundColor: cssVarV2('layer/background/secondary'),
    },
  },
});

export const tierRowSelected = style({
  borderColor: cssVarV2('layer/insideBorder/border'),
  backgroundColor: cssVarV2('layer/background/secondary'),
});

export const tierRowDisabled = style({
  opacity: 0.5,
  cursor: 'not-allowed',
});

export const radioCircle = style({
  width: '16px',
  height: '16px',
  borderRadius: '50%',
  border: `1.5px solid ${cssVarV2('icon/secondary')}`,
  background: 'transparent',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  flexShrink: 0,
  selectors: {
    '&[data-state="checked"]': {
      borderColor: cssVar('primaryColor'),
    },
    '&[disabled]': {
      cursor: 'not-allowed',
    },
  },
});

export const radioIndicator = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  backgroundColor: cssVar('primaryColor'),
});

export const tierLabelBlock = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  cursor: 'pointer',
  minWidth: 0,
});

export const tierLabel = style({
  fontSize: cssVar('fontSm'),
  fontWeight: 500,
  color: cssVarV2('text/primary'),
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

export const tierDescription = style({
  fontSize: cssVar('fontXs'),
  fontWeight: 400,
  color: cssVarV2('text/secondary'),
  lineHeight: '16px',
});

export const permissionTrigger = style({
  padding: '4px 6px 4px 8px',
  borderRadius: '4px',
  height: '28px',
  fontSize: cssVar('fontSm'),
  fontWeight: 400,
  minWidth: '92px',
  justifyContent: 'space-between',
});

export const permissionTriggerSuffix = style({
  width: '18px',
  height: '18px',
});

export const permissionItem = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
});

export const permissionHint = style({
  fontSize: cssVar('fontXs'),
  color: cssVarV2('text/secondary'),
});
