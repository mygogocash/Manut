import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

import {
  pageModeDocumentColumnStyle,
  pageModeEditorSelector,
  pageModeFullScreenReadableVarsStyle,
  pageModePropertiesContainerStyle,
  pageModePropertiesGridStyle,
  pageModePropertyCellStyle,
  pageModePropertyNameStyle,
  pageModePropertyValueStyle,
} from './detail-page.css';

const litAdapterSource = readFileSync(
  fileURLToPath(
    new URL(
      '../../../../blocksuite/block-suite-editor/lit-adaper.tsx',
      import.meta.url
    )
  ),
  'utf8'
);

describe('page detail layout', () => {
  test('page detail layout > given page-mode document header > then title, properties, and body use a readable Notion column', () => {
    expect(pageModeEditorSelector).not.toContain(':not(.full-screen)');
    expect(pageModeFullScreenReadableVarsStyle).toMatchObject({
      vars: {
        '--affine-editor-width': '760px',
        '--affine-editor-side-padding': '40px',
      },
    });
    expect(pageModeDocumentColumnStyle).toMatchObject({
      marginLeft: 'auto',
      marginRight: 'auto',
      textAlign: 'left',
    });
    expect(pageModePropertiesContainerStyle).toMatchObject({
      justifyContent: 'center',
    });
    expect(pageModePropertiesGridStyle).toMatchObject({
      display: 'flex',
      flexDirection: 'column',
      flexWrap: 'nowrap',
    });
    expect(pageModePropertyCellStyle).toMatchObject({
      width: '100%',
      flexDirection: 'row',
    });
    expect(pageModePropertyNameStyle).toMatchObject({
      width: 160,
      flexShrink: 0,
    });
    expect(pageModePropertyValueStyle).toMatchObject({
      flex: 1,
      width: 'auto',
    });
    expect(litAdapterSource).toContain('data-doc-properties-table-container');
  });
});
