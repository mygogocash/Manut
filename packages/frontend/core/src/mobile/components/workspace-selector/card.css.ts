import { bodyEmphasized } from '@toeverything/theme/typography';
import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

export const card = style({
  border: 0,
  padding: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  background: 'transparent',
  color: cssVarV2('text/primary'),
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition:
    'transform 160ms var(--manut-anim-curve-overshoot), background-color 160ms ease-out, box-shadow 160ms ease-out',
  selectors: {
    '&:active': {
      transform: 'scale(0.94)',
    },
    '&:focus-visible': {
      outline: `2px solid ${cssVarV2('button/primary')}`,
      outlineOffset: 3,
    },
  },
});

export const label = style([
  bodyEmphasized,
  {
    display: 'flex',
    gap: 4,
    color: cssVarV2('text/primary'),
  },
]);

export const dropdownIcon = style({
  fontSize: 24,
  color: cssVarV2('icon/primary'),
});
