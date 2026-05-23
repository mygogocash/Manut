import { bodyEmphasized, bodyRegular } from '@toeverything/theme/typography';
import { style } from '@vanilla-extract/css';

import {
  manutRadius,
  manutSpace,
  manutSurface,
} from '../../theme/manut-tokens';

// desktop
export const desktopStyles = {
  container: style({
    display: 'flex',
    flexDirection: 'column',
  }),
  description: style({
    color: manutSurface.inkSoft,
  }),
  header: style({
    color: manutSurface.ink,
  }),
  content: style({
    height: '100%',
    overflowY: 'auto',
    padding: `${manutSpace(2)} 4px ${manutSpace(5)} 4px`,
    color: manutSurface.ink,
  }),
  footer: style({
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingTop: manutSpace(7),
    marginTop: 'auto',
    gap: manutSpace(2),
    selectors: {
      '&.modalFooterWithChildren': {
        paddingTop: manutSpace(4),
      },
      '&.reverse': {
        flexDirection: 'row-reverse',
        justifyContent: 'flex-start',
      },
    },
  }),
  action: style({
    minWidth: 76,
    borderRadius: manutRadius.input,
  }),
};

// mobile
export const mobileStyles = {
  container: style({
    display: 'flex',
    flexDirection: 'column',
    padding: '12px 0 !important',
    borderRadius: 22,
  }),
  description: style([
    bodyRegular,
    {
      padding: '11px 22px',
      color: manutSurface.inkSoft,
    },
  ]),
  header: style([
    bodyEmphasized,
    {
      padding: '10px 16px',
      marginBottom: '0px !important',
      color: manutSurface.ink,
    },
  ]),
  content: style([
    bodyRegular,
    {
      padding: '11px 22px',
      color: manutSurface.ink,
    },
  ]),
  footer: style({
    padding: '8px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: manutSpace(2),
    selectors: {
      '&.row': {
        flexDirection: 'row',
        justifyContent: 'space-between',
      },
      '&.reverse': {
        flexDirection: 'column-reverse',
      },
      '&.rowReverse': {
        flexDirection: 'row-reverse',
      },
    },
  }),
  action: style([
    bodyRegular,
    {
      width: '100%',
      height: 44,
      borderRadius: manutRadius.input,
      fontSize: 17,
      fontWeight: 400,
      selectors: {
        '&.row': {
          width: 'auto',
          minWidth: 0,
          maxWidth: 140,
          flex: 1,
          height: 32,
        },
      },
    },
  ]),
};
