import { style } from '@vanilla-extract/css';

import {
  manutPrimary,
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
  label: style({
    color: manutSurface.inkSoft,
    fontSize: 14,
    lineHeight: '22px',
    padding: '8px 0',
  }),
  input: style({
    borderRadius: manutRadius.input,
    selectors: {
      '&:focus': {
        borderColor: manutPrimary.fg,
        boxShadow: `0 0 0 3px ${manutPrimary.bg}`,
      },
    },
  }),
  inputContainer: style({}),
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
  description: style({
    padding: '11px 22px',
    fontSize: 17,
    fontWeight: 400,
    letterSpacing: 0,
    lineHeight: '22px',
    color: manutSurface.inkSoft,
  }),
  label: style({
    color: manutSurface.inkSoft,
    fontSize: 14,
    lineHeight: '22px',
    padding: '8px 16px',
  }),
  header: style({
    padding: '10px 16px',
    marginBottom: '0px !important',
    fontSize: 17,
    fontWeight: 600,
    letterSpacing: 0,
    lineHeight: '22px',
    color: manutSurface.ink,
  }),
  inputContainer: style({
    padding: '0 16px',
  }),
  input: style({
    height: 44,
    fontSize: 17,
    lineHeight: '22px',
    letterSpacing: 0,
    borderRadius: manutRadius.input,
    selectors: {
      '&:focus': {
        borderColor: manutPrimary.fg,
        boxShadow: `0 0 0 3px ${manutPrimary.bg}`,
      },
    },
  }),
  content: style({
    padding: '11px 22px',
    fontSize: 17,
    fontWeight: 400,
    letterSpacing: 0,
    lineHeight: '22px',
    color: manutSurface.ink,
  }),
  footer: style({
    padding: '8px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: manutSpace(2),
    selectors: {
      '&.reverse': {
        flexDirection: 'column-reverse',
      },
    },
  }),
  action: style({
    width: '100%',
    height: 44,
    borderRadius: manutRadius.input,
    fontSize: 17,
    fontWeight: 400,
    letterSpacing: 0,
    lineHeight: '22px',
  }),
};
