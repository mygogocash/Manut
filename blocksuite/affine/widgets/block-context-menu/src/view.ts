import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@blocksuite/affine-ext-loader';

import { effects } from './effects';
import { BlockContextMenuExtension } from './extensions';

export class BlockContextMenuViewExtension extends ViewExtensionProvider {
  override name = 'affine-block-context-menu-widget';

  override effect() {
    super.effect();
    effects();
  }

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    if (this.isMobile(context.scope)) return;
    context.register(BlockContextMenuExtension);
  }
}
