import { cssVarV2 } from '@toeverything/theme/v2';
import { globalStyle } from '@vanilla-extract/css';

import { globalVars } from './variables.css';

globalStyle(':root', {
  vars: {
    [globalVars.appTabHeight]: BUILD_CONFIG.isIOS ? '49px' : '62px',
    [globalVars.appTabSafeArea]: `calc(${globalVars.appTabHeight} + env(safe-area-inset-bottom))`,
  },
  userSelect: 'none',
  WebkitUserSelect: 'none',
});

globalStyle('body', {
  height: 'auto',
  minHeight: '100dvh',
  overflowY: 'unset',
});
globalStyle('body:has(>#app-tabs):not(:has(affine-keyboard-toolbar))', {
  paddingBottom: globalVars.appTabSafeArea,
});
globalStyle('body:has(affine-keyboard-toolbar)', {
  paddingBottom: `calc(${globalVars.appKeyboardStaticHeight} + 46px)`,
});
globalStyle('body:has(>#app-tabs) edgeless-toolbar-widget', {
  bottom: globalVars.appTabSafeArea,
});

globalStyle('html', {
  height: '100dvh',
  overflowY: 'auto',
  background: cssVarV2('layer/background/secondary'),
});

globalStyle('a:focus:not(:focus-visible)', {
  outline: 'none',
});
globalStyle('button:focus:not(:focus-visible)', {
  outline: 'none',
});
globalStyle(
  'a:focus-visible, button:focus-visible, [role="tab"]:focus-visible',
  {
    outline: `2px solid ${cssVarV2('button/primary')}`,
    outlineOffset: 2,
  }
);
