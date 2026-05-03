import {
  BlockModel,
  BlockSchemaExtension,
  defineBlockSchema,
} from '@blocksuite/store';

type ChartBlockProps = {
  /** Vega-Lite v5 JSON spec (stringified). Empty string means prompt UI is shown. */
  spec: string;
  /** The natural-language prompt that was used to generate the spec. */
  prompt: string;
  /** Optional caption shown below the chart. */
  caption: string;
};

export const ChartBlockSchema = defineBlockSchema({
  flavour: 'affine:chart',
  props: (): ChartBlockProps => ({
    spec: '',
    prompt: '',
    caption: '',
  }),
  metadata: {
    version: 1,
    role: 'content',
    parent: [
      'affine:note',
      'affine:paragraph',
      'affine:list',
      'affine:edgeless-text',
    ],
    children: [],
  },
  toModel: () => new ChartBlockModel(),
});

export const ChartBlockSchemaExtension =
  BlockSchemaExtension(ChartBlockSchema);

export class ChartBlockModel extends BlockModel<ChartBlockProps> {}
