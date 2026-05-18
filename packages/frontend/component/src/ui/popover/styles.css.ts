import { cssVar } from '@toeverything/theme';
import { style } from '@vanilla-extract/css';

import { manutGlass, manutRadius } from '../../theme/manut-tokens';

export const popoverContent = style({
  minWidth: '180px',
  color: cssVar('textPrimaryColor'),
  borderRadius: manutRadius.modal,
  padding: '8px',
  fontSize: cssVar('fontSm'),
  fontWeight: '400',
  backgroundColor: manutGlass.surface,
  backdropFilter: manutGlass.backdropFilter,
  WebkitBackdropFilter: manutGlass.backdropFilter,
  boxShadow: cssVar('menuShadow'),
  userSelect: 'none',
  '@supports': {
    'not (backdrop-filter: blur(20px))': {
      backgroundColor: cssVar('backgroundOverlayPanelColor'),
    },
  },
});
