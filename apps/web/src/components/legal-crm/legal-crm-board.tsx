"use client";

import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  horizontalListSortingStrategy,
  SortableContext,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Loader2, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  LEGAL_PRIORITY_LABELS,
  LEGAL_PRIORITY_VARIANTS,
  normalizeLegalPriority,
} from "@/components/legal-crm/legal-priority";
import {
  type LegalStatus,
  normalizeLegalStatus,
  STATUS_BORDER,
  STATUS_OPTIONS,
} from "@/components/legal-crm/legal-status";
import { Badge } from "@/components/shared/badge";
import { PermissionButton } from "@/components/shared/permission-button";
import { useColumnOrder } from "@/components/shared/use-column-order";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import {
  type LegalProject,
  listLegalProjects,
  reorderLegalProjects,
  updateLegalProject,
} from "@/services/legal-crm.service";

const BOARD_FETCH_LIMIT = 200;
const BOARD_COLUMN_ORDER_KEY = "legal-crm-board-column-order";
const DEFAULT_BOARD_COLUMN_ORDER = STATUS_OPTIONS.map((s) => s.value);

function getStatusColumnSortableId(status: string) {
  return `legal-status-col-${status}`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
}

interface LegalCrmBoardProps {
  refreshKey?: number;
  onEdit: (project: LegalProject) => void;
  onCreate: () => void;
}

function SortableStatusColumn({
  status,
  label,
  cards,
  canMoveCards,
  canReorderColumns,
  draggingCardId,
  dragOverStatus,
  onEdit,
  onCardDragStart,
  onCardDragEnd,
  onCardDragOver,
  onCardDragLeave,
  onCardDrop,
  onCardDropOnCard,
}: {
  status: string;
  label: string;
  cards: LegalProject[];
  canMoveCards: boolean;
  canReorderColumns: boolean;
  draggingCardId: string | null;
  dragOverStatus: string | null;
  onEdit: (project: LegalProject) => void;
  onCardDragStart: (e: React.DragEvent, id: string) => void;
  onCardDragEnd: () => void;
  onCardDragOver: (e: React.DragEvent, status: string) => void;
  onCardDragLeave: (status: string) => void;
  onCardDrop: (e: React.DragEvent, status: string) => void;
  onCardDropOnCard: (
    e: React.DragEvent,
    targetId: string,
    status: string,
  ) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: getStatusColumnSortableId(status),
    data: { type: "legal-board-column", status },
    disabled: !canReorderColumns,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        bg-surface border-border flex w-[min(100%,280px)] min-w-[220px]
        flex-shrink-0 flex-col rounded-lg border border-t-2 shadow-sm
        ${STATUS_BORDER[status] ?? ""}
      `}
    >
      <div className="border-border group flex items-start gap-1 border-b p-3">
        {canReorderColumns ? (
          <button
            ref={setActivatorNodeRef}
            type="button"
            className={`
              text-muted-foreground mt-0.5 shrink-0 cursor-grab touch-none
              rounded p-0.5
              hover:text-foreground
              active:cursor-grabbing
            `}
            aria-label={`Reorder ${label} column`}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" />
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="text-foreground text-sm font-semibold">{label}</p>
          <p className="text-muted-foreground mt-0.5 text-[11px]">
            {cards.length} {cards.length === 1 ? "task" : "tasks"}
          </p>
        </div>
      </div>
      <div
        onDragOver={(e) =>
          canMoveCards ? onCardDragOver(e, status) : undefined
        }
        onDragLeave={() => onCardDragLeave(status)}
        onDrop={(e) => (canMoveCards ? onCardDrop(e, status) : undefined)}
        className={`
          flex max-h-[60svh] flex-col gap-2 overflow-y-auto p-2
          md:max-h-[calc(100vh-320px)]
          ${
            dragOverStatus === status
              ? "bg-accent/30 ring-primary ring-2 ring-inset"
              : ""
          }
        `}
      >
        {cards.length === 0 ? (
          <p className={`text-muted-foreground py-4 text-center text-xs`}>
            No tasks
          </p>
        ) : (
          cards.map((p) => {
            const title = p.workstream || p.name || "Untitled";
            const subtitle = p.workstream && p.name ? p.name : null;
            const date = formatDate(p.goLiveDate);
            const priority = normalizeLegalPriority(p.priority);
            const isDragging = draggingCardId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                draggable={canMoveCards}
                onDragStart={(e) => onCardDragStart(e, p.id)}
                onDragEnd={onCardDragEnd}
                onDragOver={(e) => {
                  if (!canMoveCards || !draggingCardId) return;
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) =>
                  canMoveCards ? onCardDropOnCard(e, p.id, status) : undefined
                }
                onClick={() => onEdit(p)}
                className={`
                  border-border bg-background flex flex-col gap-1 rounded-md
                  border p-2 text-left
                  hover:border-foreground/20 hover:shadow-sm
                  ${isDragging ? "opacity-40" : ""}
                  ${
                    canMoveCards
                      ? `
                        cursor-grab
                        active:cursor-grabbing
                      `
                      : ""
                  }
                `}
              >
                <p
                  className={`text-foreground line-clamp-2 text-xs font-medium`}
                >
                  {title}
                </p>
                {subtitle ? (
                  <p className="text-muted-foreground text-[11px]">
                    {subtitle}
                  </p>
                ) : null}
                <Badge
                  variant={LEGAL_PRIORITY_VARIANTS[priority] ?? "grey"}
                  className="w-fit text-[10px]"
                >
                  {LEGAL_PRIORITY_LABELS[priority] ?? priority}
                </Badge>
                <div
                  className={`
                    text-muted-foreground flex flex-wrap items-center gap-x-2
                    text-[10px]
                  `}
                >
                  {p.owner ? (
                    <span>
                      <span className="opacity-70">Owner </span>
                      {p.owner.name}
                    </span>
                  ) : null}
                  {date ? <span>{date}</span> : null}
                  {p.dependency ? (
                    <span>
                      <span className="opacity-70">Assignee </span>
                      {p.dependency}
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

export function LegalCrmBoard({
  refreshKey = 0,
  onEdit,
  onCreate,
}: LegalCrmBoardProps) {
  const { hasPermission } = useAuth();
  const canMoveCards = hasPermission("legal-crm:update");

  const { colOrder, reorderColumns } = useColumnOrder(
    BOARD_COLUMN_ORDER_KEY,
    DEFAULT_BOARD_COLUMN_ORDER,
  );

  const columnMeta = useMemo(
    () => Object.fromEntries(STATUS_OPTIONS.map((s) => [s.value, s])),
    [],
  );

  const [projects, setProjects] = useState<LegalProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  const [draggingColumnStatus, setDraggingColumnStatus] = useState<
    string | null
  >(null);

  const columnSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listLegalProjects({
        page: 1,
        limit: BOARD_FETCH_LIMIT,
      });
      setProjects(res.data);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to load Legal Tasks";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll, refreshKey]);

  async function moveProject(id: string, target: string) {
    const previous = projects;
    const card = previous.find((p) => p.id === id);
    if (!card || normalizeLegalStatus(card.status) === target) return;
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: target } : p)),
    );
    try {
      await updateLegalProject(id, { status: target });
    } catch (err) {
      setProjects(previous);
      const msg = err instanceof ApiError ? err.message : "Failed to move task";
      toast.error(msg);
    }
  }

  function handleCardDragStart(e: React.DragEvent, id: string) {
    setDraggingCardId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  }
  function handleCardDragEnd() {
    setDraggingCardId(null);
    setDragOverStatus(null);
  }
  function handleCardDragOver(e: React.DragEvent, status: string) {
    if (!draggingCardId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverStatus !== status) setDragOverStatus(status);
  }
  function handleCardDragLeave(status: string) {
    if (dragOverStatus === status) setDragOverStatus(null);
  }
  function handleCardDrop(e: React.DragEvent, status: string) {
    e.preventDefault();
    const id = draggingCardId ?? e.dataTransfer.getData("text/plain");
    setDraggingCardId(null);
    setDragOverStatus(null);
    if (!id) return;
    const dragged = projects.find((p) => p.id === id);
    if (!dragged) return;
    // Dropped on the column body (not on a card): same column → send the
    // card to the bottom; different column → change its status.
    if (normalizeLegalStatus(dragged.status) === status) {
      void reorderCardToEnd(id, status);
    } else {
      void moveProject(id, status);
    }
  }

  // Reorder a card within its column (persist the new global sort order),
  // or fall back to a status change when dropped onto a card in another
  // column.
  async function reorderCard(draggedId: string, targetId: string) {
    const previous = projects;
    const from = previous.findIndex((p) => p.id === draggedId);
    if (from < 0) return;
    const next = [...previous];
    const [moved] = next.splice(from, 1);
    const insertAt = next.findIndex((p) => p.id === targetId);
    if (insertAt < 0) return;
    next.splice(insertAt, 0, moved);
    setProjects(next);
    try {
      await reorderLegalProjects(next.map((p) => p.id));
    } catch (err) {
      setProjects(previous);
      const msg = err instanceof ApiError ? err.message : "Failed to reorder";
      toast.error(msg);
    }
  }

  // Move a card to the end of its column (drop on the empty column space
  // below the cards). Persists the new global sort order.
  async function reorderCardToEnd(draggedId: string, status: string) {
    const previous = projects;
    const from = previous.findIndex((p) => p.id === draggedId);
    if (from < 0) return;
    const next = [...previous];
    const [moved] = next.splice(from, 1);
    let lastIdx = -1;
    next.forEach((p, i) => {
      if (normalizeLegalStatus(p.status) === status) lastIdx = i;
    });
    next.splice(lastIdx + 1, 0, moved);
    setProjects(next);
    try {
      await reorderLegalProjects(next.map((p) => p.id));
    } catch (err) {
      setProjects(previous);
      const msg = err instanceof ApiError ? err.message : "Failed to reorder";
      toast.error(msg);
    }
  }

  function handleCardDropOnCard(
    e: React.DragEvent,
    targetId: string,
    status: string,
  ) {
    e.preventDefault();
    e.stopPropagation();
    const draggedId = draggingCardId ?? e.dataTransfer.getData("text/plain");
    setDraggingCardId(null);
    setDragOverStatus(null);
    if (!draggedId || draggedId === targetId) return;
    const dragged = projects.find((p) => p.id === draggedId);
    if (!dragged) return;
    if (normalizeLegalStatus(dragged.status) === status) {
      void reorderCard(draggedId, targetId);
    } else {
      void moveProject(draggedId, status);
    }
  }

  function handleColumnDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setDraggingColumnStatus(null);
    if (!over || active.id === over.id) return;

    const activeStatus = String(active.id).replace("legal-status-col-", "");
    const overStatus = String(over.id).replace("legal-status-col-", "");
    if (
      !DEFAULT_BOARD_COLUMN_ORDER.includes(activeStatus as LegalStatus) ||
      !DEFAULT_BOARD_COLUMN_ORDER.includes(overStatus as LegalStatus)
    ) {
      return;
    }
    reorderColumns(activeStatus as LegalStatus, overStatus as LegalStatus);
  }

  const byStatus: Record<string, LegalProject[]> = {};
  for (const s of STATUS_OPTIONS) byStatus[s.value] = [];
  for (const p of projects) {
    const key = normalizeLegalStatus(p.status);
    (byStatus[key] ??= []).push(p);
  }

  const draggingColumnLabel =
    draggingColumnStatus && columnMeta[draggingColumnStatus]
      ? columnMeta[draggingColumnStatus].label
      : null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          Board view — workstreams grouped by status. Drag the column grip to
          reorder columns; drag a card onto another (or the empty space below)
          to reorder within a column; drag between columns to change status. Tap
          a card to view / edit.
        </p>
        <PermissionButton permission="legal-crm:create" onClick={onCreate}>
          <Plus className="mr-1.5 size-3.5" />
          New workstream
        </PermissionButton>
      </div>

      {loading ? (
        <div
          className={`
            bg-surface border-border flex min-h-[300px] items-center
            justify-center rounded-lg border shadow-sm
          `}
        >
          <Loader2 className="text-muted-foreground size-5 animate-spin" />
        </div>
      ) : (
        <DndContext
          sensors={columnSensors}
          onDragStart={(event) => {
            if (event.active.data.current?.type === "legal-board-column") {
              setDraggingColumnStatus(
                event.active.data.current.status as string,
              );
            }
          }}
          onDragEnd={handleColumnDragEnd}
          onDragCancel={() => setDraggingColumnStatus(null)}
        >
          <div className="flex gap-3 overflow-x-auto pb-2">
            <SortableContext
              items={colOrder.map((s) => getStatusColumnSortableId(s))}
              strategy={horizontalListSortingStrategy}
            >
              {colOrder.map((statusKey) => {
                const col = columnMeta[statusKey];
                if (!col) return null;
                return (
                  <SortableStatusColumn
                    key={col.value}
                    status={col.value}
                    label={col.label}
                    cards={byStatus[col.value] ?? []}
                    canMoveCards={canMoveCards}
                    canReorderColumns
                    draggingCardId={draggingCardId}
                    dragOverStatus={dragOverStatus}
                    onEdit={onEdit}
                    onCardDragStart={handleCardDragStart}
                    onCardDragEnd={handleCardDragEnd}
                    onCardDragOver={handleCardDragOver}
                    onCardDragLeave={handleCardDragLeave}
                    onCardDrop={handleCardDrop}
                    onCardDropOnCard={handleCardDropOnCard}
                  />
                );
              })}
            </SortableContext>
          </div>

          <DragOverlay dropAnimation={null}>
            {draggingColumnLabel ? (
              <div
                className={`
                  bg-surface border-border w-[260px] rotate-1 rounded-lg border
                  border-t-2 px-3 py-2 shadow-lg
                  ${STATUS_BORDER[draggingColumnStatus ?? ""] ?? ""}
                `}
              >
                <p className="text-foreground text-sm font-semibold">
                  {draggingColumnLabel}
                </p>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
