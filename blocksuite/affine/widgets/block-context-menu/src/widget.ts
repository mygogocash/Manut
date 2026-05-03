import {
  menu,
  popMenu,
  popupTargetFromElement,
} from '@blocksuite/affine-components/context-menu';
import { toast } from '@blocksuite/affine-components/toast';
import {
  copySelectedModelsCommand,
  deleteSelectedModelsCommand,
  draftSelectedModelsCommand,
  duplicateSelectedModelsCommand,
  getSelectedModelsCommand,
} from '@blocksuite/affine-shared/commands';
import {
  CopyIcon,
  DeleteIcon,
  DuplicateIcon,
  PasteIcon,
  ScissorsIcon,
} from '@blocksuite/icons/lit';
import {
  BlockSelection,
  type BlockStdScope,
  WidgetComponent,
} from '@blocksuite/std';

/**
 * Right-click context menu for any block flavour inside an `affine:page` root.
 *
 * Provides cut / copy / paste / duplicate / delete actions. The widget intercepts
 * `contextmenu` events bubbling up from `[data-block-id]` descendants, ensures the
 * targeted block is selected, and pops a menu anchored at the cursor.
 *
 * Block flavours that ship their own context menus (e.g. `affine:database` cells)
 * call `event.stopPropagation()` locally, so this widget does not interfere with
 * them.
 */
export class AffineBlockContextMenuWidget extends WidgetComponent {
  private readonly _onContextMenu = (event: MouseEvent) => {
    // Only operate when this widget is mounted on a page root block.
    if (this.block?.model.flavour !== 'affine:page') return;

    const target = event.target as HTMLElement | null;
    if (!target) return;

    // Don't override native textbox right-click in editable inputs (e.g. titles
    // rendered as <input>/<textarea>).
    if (target.closest('input, textarea')) return;

    const blockEl = target.closest<HTMLElement>('[data-block-id]');
    if (!blockEl) return;

    const blockId = blockEl.dataset.blockId;
    if (!blockId) return;

    const block = this.std.view.getBlock(blockId);
    if (!block) return;

    // Skip the page block itself; we only want per-content-block actions.
    if (block.model.flavour === 'affine:page') return;

    event.preventDefault();
    event.stopPropagation();

    // Ensure the block under the cursor is selected before running actions.
    this.host.selection.setGroup('note', [
      this.host.selection.create(BlockSelection, { blockId }),
    ]);

    this._showMenu(event, this.std);
  };

  private readonly _showMenu = (event: MouseEvent, std: BlockStdScope) => {
    // Anchor the menu to a virtual 1x1 element at the cursor position.
    const anchor = document.createElement('div');
    anchor.style.position = 'fixed';
    anchor.style.left = `${event.clientX}px`;
    anchor.style.top = `${event.clientY}px`;
    anchor.style.width = '1px';
    anchor.style.height = '1px';
    anchor.style.pointerEvents = 'none';
    document.body.append(anchor);

    const cleanup = () => {
      anchor.remove();
    };

    popMenu(popupTargetFromElement(anchor), {
      options: {
        onClose: cleanup,
        items: [
          menu.action({
            prefix: ScissorsIcon(),
            name: 'Cut',
            select: () => {
              this._cut(std);
            },
          }),
          menu.action({
            prefix: CopyIcon(),
            name: 'Copy',
            select: () => {
              this._copy(std);
            },
          }),
          menu.action({
            prefix: PasteIcon(),
            name: 'Paste',
            select: () => {
              this._paste();
            },
          }),
          menu.action({
            prefix: DuplicateIcon(),
            name: 'Duplicate',
            select: () => {
              this._duplicate(std);
            },
          }),
          menu.group({
            items: [
              menu.action({
                prefix: DeleteIcon(),
                name: 'Delete',
                class: { 'delete-item': true },
                select: () => {
                  this._delete(std);
                },
              }),
            ],
          }),
        ],
      },
    });
  };

  private readonly _copy = (std: BlockStdScope) => {
    const [ok] = std.command
      .chain()
      .pipe(getSelectedModelsCommand)
      .pipe(draftSelectedModelsCommand)
      .pipe(copySelectedModelsCommand)
      .run();
    if (ok) {
      toast(this.host, 'Copied to clipboard');
    }
  };

  private readonly _cut = (std: BlockStdScope) => {
    const [ok] = std.command
      .chain()
      .pipe(getSelectedModelsCommand)
      .pipe(draftSelectedModelsCommand)
      .pipe(copySelectedModelsCommand)
      .run();
    if (!ok) return;
    toast(this.host, 'Cut to clipboard');
    this._delete(std);
  };

  /**
   * Paste from system clipboard into the currently selected block.
   *
   * The browser's `navigator.clipboard.read()` returns the cross-process
   * clipboard contents; we then synthesize a `paste` event and let
   * `std.clipboard.readFromClipboard` route it through the registered
   * paste middleware.
   */
  private readonly _paste = () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      toast(this.host, 'Clipboard not available');
      return;
    }
    navigator.clipboard
      .read()
      .then(async items => {
        const dt = new DataTransfer();
        for (const item of items) {
          for (const type of item.types) {
            try {
              const blob = await item.getType(type);
              const text = await blob.text();
              dt.setData(type, text);
            } catch {
              // Some MIME types may not be readable as text; skip them.
            }
          }
        }
        const pasteEvent = new ClipboardEvent('paste', { clipboardData: dt });
        // Re-dispatch through the focused host so existing paste handlers run.
        this.host.dispatchEvent(pasteEvent);
      })
      .catch(err => {
        console.error('Paste failed', err);
        toast(this.host, 'Paste failed');
      });
  };

  private readonly _duplicate = (std: BlockStdScope) => {
    std.store.captureSync();
    std.command
      .chain()
      .pipe(getSelectedModelsCommand, {
        types: ['block', 'image'],
        mode: 'highest',
      })
      .pipe(duplicateSelectedModelsCommand)
      .run();
  };

  private readonly _delete = (std: BlockStdScope) => {
    std.command
      .chain()
      .pipe(getSelectedModelsCommand)
      .pipe(deleteSelectedModelsCommand)
      .run();
  };

  override connectedCallback() {
    super.connectedCallback();
    const host = this.host;
    host.addEventListener('contextmenu', this._onContextMenu, {
      capture: true,
    });
    this._disposables.add(() => {
      host.removeEventListener('contextmenu', this._onContextMenu, {
        capture: true,
      } as EventListenerOptions);
    });
  }
}
