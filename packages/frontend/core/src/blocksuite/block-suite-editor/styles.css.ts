import { cssVar } from '@toeverything/theme';
import { globalStyle, style, type StyleRule } from '@vanilla-extract/css';

export const docEditorRoot = style({
  overflowX: 'clip',
  display: 'flex',
  flexDirection: 'column',
});

export const affineDocViewport = style({
  height: '100%',
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  paddingBottom: '100px',
});
export const affineEdgelessDocViewport = style({
  height: '100%',
  flex: 1,
});

export const docContainer = style({
  display: 'block',
  selectors: ['generating', 'finished', 'error'].reduce<
    NonNullable<StyleRule['selectors']>
  >((rules, state) => {
    rules[`&:has(affine-ai-panel-widget[data-state='${state}'])`] = {
      paddingBottom: '980px',
    };
    return rules;
  }, {}),
});

export const docEditorGap = style({
  display: 'block',
  width: '100%',
  margin: '0 auto',
  paddingTop: 50,
  paddingBottom: 50,
  cursor: 'text',
  flexGrow: 1,
});

const titleTagBasic = style({
  fontSize: cssVar('fontH4'),
  fontWeight: 600,
  padding: '0 4px',
  borderRadius: '4px',
  marginLeft: '4px',
  lineHeight: '0px',
});
export const titleDayTag = style([
  titleTagBasic,
  {
    color: cssVar('textSecondaryColor'),
  },
]);
export const titleTodayTag = style([
  titleTagBasic,
  {
    color: cssVar('brandColor'),
  },
]);
export const pageReferenceIcon = style({
  verticalAlign: 'middle',
  fontSize: '1.1em',
  transform: 'translate(2px, -1px)',
});

export const docPropertiesTableContainer = style({
  display: 'flex',
  width: '100%',
  justifyContent: 'center',
});

export const docPropertiesTable = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  width: '100%',
  maxWidth: cssVar('editorWidth'),
  boxSizing: 'border-box',
  padding: `0 ${cssVar('editorSidePadding', '24px')} 24px`,
  '@container': {
    [`viewport (width <= 640px)`]: {
      padding: '0 16px 20px',
    },
  },
});

globalStyle(
  `${docPropertiesTable} [data-testid="property-collapsible-section-header"]`,
  {
    display: 'none',
  }
);
globalStyle(
  `${docPropertiesTable} [data-testid="property-collapsible-section"]`,
  {
    gap: 4,
  }
);
globalStyle(
  `${docPropertiesTable} [data-testid="property-collapsible-section-content"]`,
  {
    gap: 6,
  }
);
globalStyle(`${docPropertiesTable} [data-property-collapsible]`, {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))',
  alignItems: 'start',
  columnGap: 24,
  rowGap: 12,
});
globalStyle(
  `${docPropertiesTable} [data-property-collapsible] > [data-testid="property-collapsible-button"], ${docPropertiesTable} [data-property-collapsible] > div:has(> [data-testid="add-property-button"])`,
  {
    gridColumn: '1 / -1',
  }
);
globalStyle(
  `${docPropertiesTable} [data-property-row], ${docPropertiesTable} [data-testid="database-backlink-cell"]`,
  {
    display: 'flex',
    flexDirection: 'column',
    flexWrap: 'nowrap',
    alignItems: 'stretch',
    gap: 3,
    minWidth: 0,
    minHeight: 'auto',
    listStyle: 'none',
  }
);
globalStyle(`${docPropertiesTable} [data-property-name]`, {
  width: '100%',
  height: 'auto',
  minHeight: 20,
  padding: 0,
  lineHeight: '20px',
});
globalStyle(`${docPropertiesTable} [data-property-value]`, {
  width: '100%',
  minHeight: 24,
  flex: 'unset',
  padding: 0,
  alignItems: 'center',
});
