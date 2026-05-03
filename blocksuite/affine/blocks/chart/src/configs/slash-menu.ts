import type { SlashMenuConfig } from '@blocksuite/affine-widget-slash-menu';
import { SlashMenuConfigExtension } from '@blocksuite/affine-widget-slash-menu';
import { html } from 'lit';

/** Inline SVG icon for the chart slash command. */
const ChartIcon = html`<svg
  width="20"
  height="20"
  viewBox="0 0 20 20"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
>
  <rect x="2" y="11" width="3" height="7" rx="1" fill="currentColor" />
  <rect x="7" y="7" width="3" height="11" rx="1" fill="currentColor" />
  <rect x="12" y="4" width="3" height="14" rx="1" fill="currentColor" />
  <rect x="17" y="9" width="3" height="9" rx="1" fill="currentColor" />
  <line
    x1="1"
    y1="18.5"
    x2="22"
    y2="18.5"
    stroke="currentColor"
    stroke-width="1"
  />
</svg>`;

const chartSlashMenuConfig: SlashMenuConfig = {
  items: [
    {
      name: 'Chart',
      description: 'Insert an AI-generated chart.',
      icon: ChartIcon,
      group: '4_Content & Media@99',
      searchAlias: ['chart', 'graph', 'vega', 'bar', 'line', 'pie', 'ai'],
      when: ({ model }) =>
        model.store.schema.flavourSchemaMap.has('affine:chart'),
      action: ({ std, model }) => {
        const { store } = std;
        const parent = store.getParent(model);
        if (!parent) return;
        const index = parent.children.indexOf(model) + 1;
        store.addBlock('affine:chart', {}, parent, index);
        if (model.text?.length === 0) {
          store.deleteBlock(model);
        }
      },
    },
  ],
};

export const ChartSlashMenuConfigExtension = SlashMenuConfigExtension(
  'affine:note',
  chartSlashMenuConfig
);
