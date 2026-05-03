import type { ReactiveController } from 'lit';

import { startDrag } from '../../../../core/utils/drag.js';
import type { CalendarViewUILogic } from '../calendar-view-ui-logic.js';

/** Returns noon (12:00:00) of the given date as a Unix ms timestamp. */
function noon(d: Date): number {
  return new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    12,
    0,
    0
  ).getTime();
}

/** Parse a `data-date` attribute value ("YYYY-MM-DD") back to a Date. */
function parseDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Find which day-cell (if any) contains the given pointer coordinates. */
function findCellAtPoint(x: number, y: number): HTMLElement | undefined {
  const elements = document.elementsFromPoint(x, y);
  for (const el of elements) {
    if (el instanceof HTMLElement && el.dataset['date']) {
      return el;
    }
  }
  return undefined;
}

export class CalendarDragController implements ReactiveController {
  private _highlightedCell: HTMLElement | undefined;

  constructor(private readonly logic: CalendarViewUILogic) {}

  hostConnected(): void {
    // No global event listeners needed — drag is initiated imperatively via dragStart().
  }

  /** Highlight a cell with a blue drop-indicator border. */
  private showDropIndicator(cell: HTMLElement): void {
    if (this._highlightedCell === cell) return;
    this.hideDropIndicator();
    cell.style.outline = '2px solid var(--affine-primary-color, #1e90ff)';
    cell.style.outlineOffset = '-2px';
    this._highlightedCell = cell;
  }

  /** Remove any existing drop-indicator highlight. */
  hideDropIndicator(): void {
    if (this._highlightedCell) {
      this._highlightedCell.style.outline = '';
      this._highlightedCell.style.outlineOffset = '';
      this._highlightedCell = undefined;
    }
  }

  /**
   * Begin dragging the event chip identified by `rowId`.
   * Creates a ghost preview and wires pointer events via `startDrag`.
   */
  dragStart(rowId: string, evt: PointerEvent): void {
    if (this.logic.view.readonly$.value) return;

    const chipEl = evt.currentTarget as HTMLElement;
    const chipRect = chipEl.getBoundingClientRect();
    const offsetX = evt.clientX - chipRect.left;
    const offsetY = evt.clientY - chipRect.top;

    // Build ghost element.
    const ghost = chipEl.cloneNode(true) as HTMLElement;
    ghost.style.position = 'fixed';
    ghost.style.pointerEvents = 'none';
    ghost.style.width = `${chipRect.width}px`;
    ghost.style.opacity = '0.75';
    ghost.style.zIndex = '9999';
    ghost.style.left = `${evt.clientX - offsetX}px`;
    ghost.style.top = `${evt.clientY - offsetY}px`;
    ghost.style.transform = 'rotate(-2deg)';
    document.body.append(ghost);

    // Dim the original chip.
    const prevOpacity = chipEl.style.opacity;
    chipEl.style.opacity = '0.3';

    // Find the originating day cell so we can ignore drops on it.
    const originCellEl = chipEl.closest<HTMLElement>('[data-date]');
    const originDateKey = originCellEl?.dataset['date'];

    startDrag<{ targetDate: Date | undefined }, PointerEvent>(evt, {
      onDrag: () => ({ targetDate: undefined }),
      onMove: moveEvt => {
        // Move the ghost.
        ghost.style.left = `${moveEvt.clientX - offsetX}px`;
        ghost.style.top = `${moveEvt.clientY - offsetY}px`;

        // Determine which cell is under the cursor.
        const cell = findCellAtPoint(moveEvt.clientX, moveEvt.clientY);
        if (cell) {
          this.showDropIndicator(cell);
          const dateAttr = cell.dataset['date'];
          return {
            targetDate: dateAttr ? parseDateKey(dateAttr) : undefined,
          };
        } else {
          this.hideDropIndicator();
          return { targetDate: undefined };
        }
      },
      onClear: () => {
        ghost.remove();
        chipEl.style.opacity = prevOpacity;
        this.hideDropIndicator();
      },
      onDrop: result => {
        if (!result?.targetDate) return;

        const targetKey = `${result.targetDate.getFullYear()}-${String(result.targetDate.getMonth() + 1).padStart(2, '0')}-${String(result.targetDate.getDate()).padStart(2, '0')}`;
        if (targetKey === originDateKey) return; // dropped on same day, no-op

        this.logic.view.setRowDate(rowId, noon(result.targetDate));
      },
    });
  }
}
