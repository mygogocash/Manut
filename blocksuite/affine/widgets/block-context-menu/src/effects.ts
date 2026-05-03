import { AFFINE_BLOCK_CONTEXT_MENU_WIDGET } from './consts';
import { AffineBlockContextMenuWidget } from './widget';

export function effects() {
  customElements.define(
    AFFINE_BLOCK_CONTEXT_MENU_WIDGET,
    AffineBlockContextMenuWidget
  );
}

declare global {
  interface HTMLElementTagNameMap {
    [AFFINE_BLOCK_CONTEXT_MENU_WIDGET]: AffineBlockContextMenuWidget;
  }
}
