import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

import {
  pageModeDocumentColumnStyle,
  pageModePropertiesContainerStyle,
  pageModePropertiesGridStyle,
  pageModePropertyCellStyle,
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
  test('page detail layout > given page-mode document header > then title and properties use a left-aligned Notion column', () => {
    expect(pageModeDocumentColumnStyle).toMatchObject({
      marginLeft: 0,
      marginRight: 'auto',
      textAlign: 'left',
    });
    expect(pageModePropertiesContainerStyle).toMatchObject({
      justifyContent: 'flex-start',
    });
    expect(pageModePropertiesGridStyle).toMatchObject({
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: 'flex-start',
    });
    expect(pageModePropertyCellStyle).toMatchObject({
      flex: '0 1 164px',
    });
    expect(litAdapterSource).toContain('data-doc-properties-table-container');
  });
});
