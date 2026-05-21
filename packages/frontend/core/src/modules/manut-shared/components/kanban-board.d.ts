/**
 * Generic Kanban board used by the Manut PM and CRM modules.
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
export declare const KanbanBoard: <T extends KanbanCardLike>({ columns, renderCard, onMove, testIdPrefix, emptyText, className, }: KanbanBoardProps<T>) => React.ReactElement;
//# sourceMappingURL=kanban-board.d.ts.map