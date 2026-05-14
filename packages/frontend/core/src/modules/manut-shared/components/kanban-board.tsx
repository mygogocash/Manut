/**
 * Generic Kanban board used by the Superflow PM and CRM modules.
 *
 * - Columns are declared by the caller (`columns`).
 * - Cards are rendered via the caller-supplied `renderCard` prop.
 * - Drag/drop is wired via HTML5 native APIs (no extra dependency). The
 *   handler receives the moved card's id, the source column id, the target
 *   column id, and the target index inside that column so the caller can
 *   persist whatever ordering or status change is appropriate.
 *
 * The board is agnostic about what a "card" actually is — it only requires
 * the entity to expose an `id: string`. Both task cards (status columns)
 * and deal cards (stage columns) reuse this component.
 */

import { useCallback, useMemo, useState } from 'react';

import * as styles from './kanban-board.css';

export interface KanbanCardLike {
  id: string;
}

export interface KanbanColumn<T extends KanbanCardLike> {
  id: string;
  label: string;
  cards: readonly T[];
  /**
   * Optional right-hand metadata for the column header (e.g. count or sum).
   * Rendered as plain text in the header strip.
   */
  meta?: string;
}

export interface KanbanOnMoveArgs {
  cardId: string;
  fromColumn: string;
  toColumn: string;
  /**
   * Zero-based insertion index inside the destination column.
   * The card has already been removed from its source position when this
   * index is computed.
   */
  toIndex: number;
}

export interface KanbanBoardProps<T extends KanbanCardLike> {
  columns: readonly KanbanColumn<T>[];
  renderCard: (card: T) => React.ReactNode;
  onMove: (args: KanbanOnMoveArgs) => Promise<void> | void;
  /**
   * Test hook prefix; will be applied as `data-testid` on the board, columns
   * and cards. Pass a stable value so consumers can hook tests in.
   */
  testIdPrefix?: string;
  /**
   * Optional caller-provided empty-state copy per column.
   */
  emptyText?: string;
  /**
   * Optional className applied to the outer board wrapper.
   */
  className?: string;
}

interface DragPayload {
  cardId: string;
  fromColumn: string;
}

const DRAG_MIME_TYPE = 'application/x-manut-kanban-card';

function parseDragPayload(transfer: DataTransfer | null): DragPayload | null {
  if (!transfer) return null;
  const raw = transfer.getData(DRAG_MIME_TYPE);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof (parsed as { cardId?: unknown }).cardId === 'string' &&
      typeof (parsed as { fromColumn?: unknown }).fromColumn === 'string'
    ) {
      return parsed as DragPayload;
    }
  } catch {
    return null;
  }
  return null;
}

interface ColumnDropState {
  columnId: string;
  /**
   * Insertion index inside the column. `cards.length` means "drop at the
   * end" (or onto an empty column).
   */
  index: number;
  /**
   * `true` when the user hovered a specific inter-card slot. `false` when
   * we only saw a column-level dragover (slot index is inferred from
   * column length). We use this to suppress no-op drops when the user
   * releases on the source column without aiming at a specific slot.
   */
  precise: boolean;
}

export const KanbanBoard = <T extends KanbanCardLike>({
  columns,
  renderCard,
  onMove,
  testIdPrefix = 'kanban',
  emptyText,
  className,
}: KanbanBoardProps<T>): React.ReactElement => {
  const [activeDrag, setActiveDrag] = useState<DragPayload | null>(null);
  const [hoverDrop, setHoverDrop] = useState<ColumnDropState | null>(null);

  // Build a lookup so `onMove` callers can ignore identity changes that are
  // no-ops (same column + same index after the source card was removed).
  const columnIndexByCard = useMemo(() => {
    const map = new Map<string, { columnId: string; index: number }>();
    for (const column of columns) {
      column.cards.forEach((card, index) => {
        map.set(card.id, { columnId: column.id, index });
      });
    }
    return map;
  }, [columns]);

  const handleDragStart = useCallback(
    (event: React.DragEvent<HTMLDivElement>, payload: DragPayload) => {
      event.dataTransfer.setData(DRAG_MIME_TYPE, JSON.stringify(payload));
      event.dataTransfer.effectAllowed = 'move';
      setActiveDrag(payload);
    },
    []
  );

  const handleDragEnd = useCallback(() => {
    setActiveDrag(null);
    setHoverDrop(null);
  }, []);

  const handleColumnDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>, columnId: string) => {
      // We don't always have access to the payload during dragover (browsers
      // only expose it on drop), so we always preventDefault to keep the drop
      // permissive. Authorisation lives in the caller's onMove handler.
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      setHoverDrop(prev => {
        const column = columns.find(c => c.id === columnId);
        const fallbackIndex = column ? column.cards.length : 0;
        if (prev && prev.columnId === columnId) return prev;
        return { columnId, index: fallbackIndex, precise: false };
      });
    },
    [columns]
  );

  const handleSlotDragOver = useCallback(
    (
      event: React.DragEvent<HTMLDivElement>,
      columnId: string,
      index: number
    ) => {
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = 'move';
      setHoverDrop(prev =>
        prev &&
        prev.columnId === columnId &&
        prev.index === index &&
        prev.precise
          ? prev
          : { columnId, index, precise: true }
      );
    },
    []
  );

  const handleColumnDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>, columnId: string) => {
      event.preventDefault();
      event.stopPropagation();
      const payload = parseDragPayload(event.dataTransfer) ?? activeDrag;
      if (!payload) {
        handleDragEnd();
        return;
      }

      const targetColumn = columns.find(c => c.id === columnId);
      if (!targetColumn) {
        handleDragEnd();
        return;
      }

      const original = columnIndexByCard.get(payload.cardId);
      const hover =
        hoverDrop && hoverDrop.columnId === columnId ? hoverDrop : null;

      // Dropping back onto the source column without aiming at a specific
      // slot is treated as a no-op so we don't issue pointless mutations.
      if (
        original &&
        original.columnId === columnId &&
        (!hover || !hover.precise)
      ) {
        handleDragEnd();
        return;
      }

      // Resolve the final insertion index. We prefer the precise hover
      // index; otherwise we append to the end of the destination column.
      let toIndex = hover ? hover.index : targetColumn.cards.length;

      // If the card is moving inside the same column, removing it first
      // means anything after its original slot shifts up by one. Match
      // that so the user-visible index stays consistent.
      if (
        original &&
        original.columnId === columnId &&
        toIndex > original.index
      ) {
        toIndex = Math.max(0, toIndex - 1);
      }

      // Skip true no-ops so callers don't issue a pointless mutation.
      if (
        original &&
        original.columnId === columnId &&
        original.index === toIndex
      ) {
        handleDragEnd();
        return;
      }

      try {
        await onMove({
          cardId: payload.cardId,
          fromColumn: payload.fromColumn,
          toColumn: columnId,
          toIndex,
        });
      } finally {
        handleDragEnd();
      }
    },
    [activeDrag, columnIndexByCard, columns, handleDragEnd, hoverDrop, onMove]
  );

  return (
    <div
      className={className ? `${styles.board} ${className}` : styles.board}
      data-testid={testIdPrefix}
    >
      {columns.map(column => {
        const isDragOver = hoverDrop?.columnId === column.id;
        return (
          <div
            key={column.id}
            className={styles.column}
            data-testid={`${testIdPrefix}-column-${column.id}`}
            data-drag-over={isDragOver ? 'true' : undefined}
            onDragOver={event => handleColumnDragOver(event, column.id)}
            onDrop={event => void handleColumnDrop(event, column.id)}
          >
            <div className={styles.columnHeader}>
              <span className={styles.columnLabel}>{column.label}</span>
              {column.meta ? (
                <span className={styles.columnMeta}>{column.meta}</span>
              ) : null}
            </div>
            <div className={styles.cardList}>
              {column.cards.length === 0 ? (
                <div className={styles.emptyColumn}>
                  {emptyText ?? 'Drop cards here'}
                </div>
              ) : null}
              {column.cards.map((card, index) => {
                const dropActive =
                  hoverDrop?.columnId === column.id &&
                  hoverDrop?.index === index;
                return (
                  <div key={card.id} className={styles.cardSlot}>
                    <div
                      className={styles.dropZone}
                      data-drop-active={dropActive ? 'true' : undefined}
                      onDragOver={event =>
                        handleSlotDragOver(event, column.id, index)
                      }
                    />
                    <div
                      className={styles.card}
                      data-testid={`${testIdPrefix}-card-${card.id}`}
                      data-dragging={
                        activeDrag?.cardId === card.id ? 'true' : undefined
                      }
                      draggable
                      onDragStart={event =>
                        handleDragStart(event, {
                          cardId: card.id,
                          fromColumn: column.id,
                        })
                      }
                      onDragEnd={handleDragEnd}
                    >
                      {renderCard(card)}
                    </div>
                  </div>
                );
              })}
              {/* Trailing slot so users can drop at the end of a column. */}
              <div
                className={styles.dropZone}
                data-drop-active={
                  hoverDrop?.columnId === column.id &&
                  hoverDrop?.index === column.cards.length
                    ? 'true'
                    : undefined
                }
                onDragOver={event =>
                  handleSlotDragOver(event, column.id, column.cards.length)
                }
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
