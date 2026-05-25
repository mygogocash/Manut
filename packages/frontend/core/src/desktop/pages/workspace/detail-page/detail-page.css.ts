import { cssVar } from '@toeverything/theme';
import { cssVarV2 } from '@toeverything/theme/v2';
import { globalStyle, type GlobalStyleRule, style } from '@vanilla-extract/css';

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
const editorContainerSelector = '[data-affine-editor-container]';
export const pageModeEditorSelector = `${pageModeViewportContentBox} ${editorContainerSelector}`;
export const pageModeFullScreenReadableVarsStyle = {
  vars: {
    '--affine-editor-width': '760px',
    '--affine-editor-side-padding': '40px',
  },
} satisfies GlobalStyleRule;
export const pageModeDocumentColumnStyle = {
  boxSizing: 'border-box',
  width: '100%',
  maxWidth: 'var(--affine-editor-width)',
  marginLeft: 'auto',
  marginRight: 'auto',
  textAlign: 'left',
} satisfies GlobalStyleRule;
export const pageModeDocumentHeaderPaddingStyle = {
  paddingLeft: 'var(--affine-editor-side-padding)',
  paddingRight: 'var(--affine-editor-side-padding)',
} satisfies GlobalStyleRule;
export const pageModePropertiesContainerStyle = {
  justifyContent: 'center',
} satisfies GlobalStyleRule;
export const pageModePropertiesGridStyle = {
  display: 'flex',
  flexDirection: 'column',
  flexWrap: 'nowrap',
  justifyContent: 'flex-start',
  alignItems: 'stretch',
  gap: 4,
} satisfies GlobalStyleRule;
export const pageModePropertyCellStyle = {
  display: 'flex',
  flex: '0 0 auto',
  width: '100%',
  maxWidth: '100%',
  flexDirection: 'row',
  flexWrap: 'nowrap',
  alignItems: 'center',
  gap: 4,
  minWidth: 0,
  minHeight: 30,
  listStyle: 'none',
} satisfies GlobalStyleRule;
export const pageModePropertyFullRowStyle = {
  flexBasis: '100%',
  maxWidth: '100%',
} satisfies GlobalStyleRule;
export const pageModePropertyNameStyle = {
  width: 160,
  flexShrink: 0,
  minWidth: 0,
  height: 30,
  padding: 4,
  lineHeight: '22px',
} satisfies GlobalStyleRule;
export const pageModePropertyValueStyle = {
  width: 'auto',
  minWidth: 0,
  minHeight: 30,
  flex: 1,
  padding: 4,
  alignItems: 'center',
} satisfies GlobalStyleRule;
globalStyle(`${pageModeEditorSelector}.full-screen`, {
  ...pageModeFullScreenReadableVarsStyle,
});
globalStyle(
  `${pageModeViewportContentBox} >:first-child:has(>${editorContainerSelector})`,
  { display: 'table !important', minWidth: '100%' }
);
globalStyle(
  `${pageModeViewportContentBox} >:first-child:has(>${editorContainerSelector}.full-screen)`,
  { display: 'block !important', width: '100%', minWidth: '100%' }
);
globalStyle(
  `${pageModeViewportContentBox} >:first-child:has(>[data-editor-loading="true"]) > [data-editor-loading="true"]`,
  { flex: 1, minHeight: '100%' }
);
globalStyle(`${pageModeEditorSelector} .doc-icon-container`, {
  ...pageModeDocumentColumnStyle,
  ...pageModeDocumentHeaderPaddingStyle,
  boxSizing: 'border-box',
  display: 'flex',
  width: '100%',
  justifyContent: 'flex-start',
  alignItems: 'center',
  paddingTop: 168,
  paddingBottom: 10,
});
globalStyle(`${pageModeEditorSelector} .doc-title-container`, {
  ...pageModeDocumentColumnStyle,
  ...pageModeDocumentHeaderPaddingStyle,
  paddingTop: 168,
  paddingBottom: 18,
  fontSize: 40,
  lineHeight: '48px',
});
globalStyle(
  `${pageModeEditorSelector} .doc-icon-container + * .doc-title-container`,
  {
    paddingTop: 0,
  }
);
globalStyle(`${pageModeEditorSelector} .affine-page-root-block-container`, {
  ...pageModeDocumentColumnStyle,
  minHeight: 'auto',
  paddingBottom: 80,
  '@container': {
    [`viewport (width <= 640px)`]: {
      paddingLeft: 24,
      paddingRight: 24,
    },
  },
});
globalStyle(`${pageModeEditorSelector} [data-testid="page-editor-blank"]`, {
  ...pageModeDocumentColumnStyle,
});
globalStyle(`${pageModeEditorSelector} [data-testid="add-property-button"]`, {
  width: '100%',
  maxWidth: 180,
});
globalStyle(
  `${pageModeEditorSelector} [data-doc-properties-table-container]`,
  pageModePropertiesContainerStyle
);
globalStyle(
  `${pageModeEditorSelector} [data-doc-properties-table-container] [data-property-collapsible]`,
  pageModePropertiesGridStyle
);
globalStyle(
  `${pageModeEditorSelector} [data-doc-properties-table-container] [data-property-row], ${pageModeEditorSelector} [data-doc-properties-table-container] [data-testid="database-backlink-cell"]`,
  pageModePropertyCellStyle
);
globalStyle(
  `${pageModeEditorSelector} [data-doc-properties-table-container] [data-property-name]`,
  pageModePropertyNameStyle
);
globalStyle(
  `${pageModeEditorSelector} [data-doc-properties-table-container] [data-property-value]`,
  pageModePropertyValueStyle
);
globalStyle(
  `${pageModeEditorSelector} [data-doc-properties-table-container] [data-property-collapsible] > [data-testid="property-collapsible-button"], ${pageModeEditorSelector} [data-doc-properties-table-container] [data-property-collapsible] > div:has(> [data-testid="add-property-button"])`,
  pageModePropertyFullRowStyle
);
globalStyle(`${pageModeEditorSelector} affine-data-view-record-detail`, {
  padding: 0,
  borderRadius: 0,
});
globalStyle(`${pageModeEditorSelector} affine-data-view-record-field`, {
  width: '100%',
  maxWidth: '100%',
  flexWrap: 'nowrap',
});
globalStyle(
  `${pageModeEditorSelector} affine-data-view-record-field .field-left`,
  {
    width: 160,
    flexShrink: 0,
  }
);
globalStyle(
  `${pageModeEditorSelector} affine-data-view-record-field .field-content`,
  {
    minWidth: 0,
  }
);
globalStyle(`${pageModeEditorSelector} .doc-icon-container`, {
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
});
globalStyle(`${pageModeEditorSelector} .doc-title-container`, {
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
});
globalStyle(
  `${pageModeEditorSelector} .doc-icon-container + * .doc-title-container`,
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
