import { type SlashMenuConfig } from '@blocksuite/affine-widget-slash-menu';
// Simple microphone SVG rendered as a Lit template result via html tag
import { html } from 'lit';

const MicrophoneIcon = () => html`
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" y1="19" x2="12" y2="23"/>
    <line x1="8" y1="23" x2="16" y2="23"/>
  </svg>
`;

export const audioSlashMenuConfig: SlashMenuConfig = {
  items: [
    {
      name: 'Record audio',
      description: 'Record an audio clip and embed it in the page.',
      icon: MicrophoneIcon(),
      searchAlias: ['record', 'audio', 'microphone', 'voice'],
      group: '4_Content & Media@5',
      when: ({ model }) =>
        model.store.schema.flavourSchemaMap.has('affine:audio'),
      action: ({ std, model }) => {
        const { store } = std;
        const parentModel = store.getParent(model);
        if (!parentModel) return;

        const index = parentModel.children.indexOf(model);
        const insertIndex = index >= 0 ? index + 1 : undefined;

        store.addBlock(
          'affine:audio',
          {},
          parentModel,
          insertIndex
        );

        // Remove the empty paragraph that triggered the slash menu
        if (model.text?.length === 0) {
          store.deleteBlock(model);
        }
      },
    },
  ],
};
