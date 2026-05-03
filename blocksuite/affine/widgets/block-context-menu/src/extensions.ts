import type { Container } from '@blocksuite/global/di';
import { WidgetViewExtension } from '@blocksuite/std';
import { Extension } from '@blocksuite/store';
import { literal, unsafeStatic } from 'lit/static-html.js';

import { AFFINE_BLOCK_CONTEXT_MENU_WIDGET } from './consts';

/**
 * Registers the right-click context menu widget on the page root, exposing
 * cut / copy / paste / duplicate / delete for every content block flavour.
 *
 * Registered with a unique widget id (AFFINE_BLOCK_CONTEXT_MENU_WIDGET) so
 * it cannot collide with the slash-menu / toolbar / drag-handle widgets.
 */
export class BlockContextMenuExtension extends Extension {
  static override setup(di: Container) {
    WidgetViewExtension(
      'affine:page',
      AFFINE_BLOCK_CONTEXT_MENU_WIDGET,
      literal`${unsafeStatic(AFFINE_BLOCK_CONTEXT_MENU_WIDGET)}`
    ).setup(di);
  }
}
