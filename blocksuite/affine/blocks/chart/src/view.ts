import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@blocksuite/affine-ext-loader';
import { BlockViewExtension } from '@blocksuite/std';
import { literal } from 'lit/static-html.js';

import { ChartSlashMenuConfigExtension } from './configs/slash-menu.js';
import { effects } from './effects.js';

export class ChartViewExtension extends ViewExtensionProvider {
  override name = 'affine-chart-block';

  override effect() {
    super.effect();
    effects();
  }

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    context.register([
      BlockViewExtension('affine:chart', literal`affine-chart`),
      ChartSlashMenuConfigExtension,
    ]);
  }
}
