import { cssVar } from '@toeverything/theme';
import { cssVarV2 } from '@toeverything/theme/v2';
import { globalStyle, style } from '@vanilla-extract/css';

export const mainContainer = style({
  containerType: 'inline-size',
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  overflow: 'hidden',
  borderTop: `0.5px solid transparent`,
  transition: 'border-color 0.2s',
  selectors: {
    '&[data-dynamic-top-border="false"]': {
      borderColor: cssVar('borderColor'),
    },
    '&[data-has-scroll-top="true"]': {
      borderColor: cssVar('borderColor'),
    },
  },
});

export const editorContainer = style({
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  zIndex: 0,
});
// brings styles of .affine-page-viewport from blocksuite
export const affineDocViewport = style({
  display: 'flex',
  flexDirection: 'column',
  containerName: 'viewport',
  containerType: 'inline-size',
  background: cssVar('backgroundPrimaryColor'),
  '@media': {
    print: {
      display: 'none',
      zIndex: -1,
    },
  },
  selectors: {
    '&[data-dragging="true"]': {
      backgroundColor: cssVarV2.layer.background.hoverOverlay,
    },
  },
});

export const pageModeViewportContentBox = style({
  vars: {
    '--affine-editor-width': '760px',
    '--affine-editor-side-padding': '40px',
  },
});
globalStyle(
  `${pageModeViewportContentBox} >:first-child:has(>[data-affine-editor-container])`,
  { display: 'table !important', minWidth: '100%' }
);
globalStyle(
  `${pageModeViewportContentBox} >:first-child:has(>[data-affine-editor-container].full-screen)`,
  { display: 'block !important', width: '100%', minWidth: '100%' }
);
globalStyle(
  `${pageModeViewportContentBox} >:first-child:has(>[data-editor-loading="true"]) > [data-editor-loading="true"]`,
  { flex: 1, minHeight: '100%' }
);
globalStyle(
  `${pageModeViewportContentBox} [data-affine-editor-container]:not(.full-screen) .doc-icon-container`,
  {
    display: 'flex',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 168,
    paddingBottom: 10,
  }
);
globalStyle(
  `${pageModeViewportContentBox} [data-affine-editor-container]:not(.full-screen) .doc-title-container`,
  {
    paddingTop: 168,
    paddingBottom: 18,
    fontSize: 40,
    lineHeight: '48px',
  }
);
globalStyle(
  `${pageModeViewportContentBox} [data-affine-editor-container]:not(.full-screen) .doc-icon-container + * .doc-title-container`,
  {
    paddingTop: 0,
  }
);
globalStyle(
  `${pageModeViewportContentBox} [data-affine-editor-container]:not(.full-screen) .affine-page-root-block-container`,
  {
    minHeight: 'auto',
    paddingBottom: 80,
    '@container': {
      [`viewport (width <= 640px)`]: {
        paddingLeft: 24,
        paddingRight: 24,
      },
    },
  }
);
globalStyle(
  `${pageModeViewportContentBox} [data-affine-editor-container]:not(.full-screen) [data-testid="page-editor-blank"]`,
  {
    maxWidth: 'var(--affine-editor-width)',
  }
);
globalStyle(
  `${pageModeViewportContentBox} [data-affine-editor-container]:not(.full-screen) [data-testid="add-property-button"]`,
  {
    width: '100%',
    maxWidth: 180,
  }
);
globalStyle(
  `${pageModeViewportContentBox} [data-affine-editor-container]:not(.full-screen) .doc-icon-container`,
  {
    '@container': {
      [`viewport (width <= 900px)`]: {
        paddingTop: 96,
      },
      [`viewport (width <= 640px)`]: {
        paddingTop: 64,
        paddingLeft: 24,
        paddingRight: 24,
      },
    },
  }
);
globalStyle(
  `${pageModeViewportContentBox} [data-affine-editor-container]:not(.full-screen) .doc-title-container`,
  {
    '@container': {
      [`viewport (width <= 900px)`]: {
        paddingTop: 96,
      },
      [`viewport (width <= 640px)`]: {
        paddingTop: 64,
        paddingLeft: 24,
        paddingRight: 24,
        fontSize: 36,
        lineHeight: '44px',
      },
    },
  }
);
globalStyle(
  `${pageModeViewportContentBox} [data-affine-editor-container]:not(.full-screen) .doc-icon-container + * .doc-title-container`,
  {
    '@container': {
      [`viewport (width <= 900px)`]: {
        paddingTop: 0,
      },
    },
  }
);

export const scrollbar = style({
  marginRight: '4px',
});

export const sidebarScrollArea = style({
  height: '100%',
});
