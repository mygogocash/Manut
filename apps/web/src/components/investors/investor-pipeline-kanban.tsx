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
import {
  Check,
  ChevronDown,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useInvestorTypes } from "@/hooks/use-investor-types";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import {
  getInvestorPipelineTotals,
  type Investor,
  type InvestorPipelineTotals,
  listInvestors,
  parseInvestmentAmount,
  updateInvestor,
} from "@/services/investor.service";
import {
  createInvestorStage,
  deleteInvestorStage,
  INVESTOR_STAGE_COLORS,
  type InvestorPipelineStage,
  listInvestorStages,
  reorderInvestorStages,
  updateInvestorStage,
} from "@/services/investor-pipeline-stage.service";

const COLUMN_PAGE_SIZE = 50;

function colSortableId(key: string) {
  return `inv-stage-col-${key}`;
}

function formatUsd(value: number): string {
  if (value <= 0) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
}

interface ColumnState {
  items: Investor[];
  page: number;
  total: number;
  loading: boolean;
}

function emptyColumn(): ColumnState {
  return { items: [], page: 1, total: 0, loading: false };
}

interface InvestorPipelineKanbanProps {
  refreshKey?: number;
  onOpenInvestor?: (id: string) => void;
  onMutate?: () => void;
}

// ─── Sortable stage column ────────────────────────────────────────────

interface StageColumnProps {
  stage: InvestorPipelineStage;
  column: ColumnState;
  /** Summed est/act across ALL investors in this stage (server roll-up). */
  est: number;
  act: number;
  typeLabel: (key: string) => string;
  canMove: boolean;
  canManage: boolean;
  draggingCardId: string | null;
  dragOverStage: string | null;
  editing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: (label: string) => void;
  onDelete: () => void;
  onLoadMore: () => void;
  onOpenInvestor?: (id: string) => void;
  onCardDragStart: (e: React.DragEvent, id: string) => void;
  onCardDragEnd: () => void;
  onCardDragOver: (e: React.DragEvent, stageKey: string) => void;
  onCardDragLeave: (stageKey: string) => void;
  onCardDrop: (e: React.DragEvent, stageKey: string) => void;
}

function StageColumn({
  stage,
  column,
  est,
  act,
  typeLabel,
  canMove,
  canManage,
  draggingCardId,
  dragOverStage,
  editing,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onLoadMore,
  onOpenInvestor,
  onCardDragStart,
  onCardDragEnd,
  onCardDragOver,
  onCardDragLeave,
  onCardDrop,
}: StageColumnProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: colSortableId(stage.key),
    data: { type: "investor-stage-column", key: stage.key },
    disabled: !canManage || editing,
  });

  const [draftLabel, setDraftLabel] = useState(stage.label);
  useEffect(() => {
    if (editing) setDraftLabel(stage.label);
  }, [editing, stage.label]);

  const cards = column.items;
  const hasMore = cards.length < column.total;

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
        bg-surface border-border flex w-[min(100%,300px)] min-w-[260px]
        flex-shrink-0 flex-col rounded-lg border border-t-2 shadow-sm
        ${stage.color || "border-t-zinc-500"}
      `}
    >
      <div className="border-border group flex items-start gap-1 border-b p-3">
        {canManage && !editing ? (
          <button
            ref={setActivatorNodeRef}
            type="button"
            className={`
              text-muted-foreground mt-0.5 shrink-0 cursor-grab touch-none
              rounded p-0.5
              hover:text-foreground
              active:cursor-grabbing
            `}
            aria-label={`Reorder ${stage.label} column`}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" />
          </button>
        ) : null}

        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex items-center gap-1">
              <Input
                value={draftLabel}
                onChange={(e) => setDraftLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onSaveEdit(draftLabel.trim());
                  if (e.key === "Escape") onCancelEdit();
                }}
                autoFocus
                className="h-7 text-sm"
              />
              <button
                type="button"
                aria-label="Save"
                className="text-success shrink-0 p-0.5"
                onClick={() => onSaveEdit(draftLabel.trim())}
              >
                <Check className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Cancel"
                className="text-muted-foreground shrink-0 p-0.5"
                onClick={onCancelEdit}
              >
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <p className="text-foreground text-sm font-semibold">
              {stage.label}
            </p>
          )}
          <p className="text-muted-foreground mt-0.5 text-[11px]">
            {column.total} {column.total === 1 ? "investor" : "investors"}
          </p>
          <div className="mt-1 flex flex-col gap-0.5 text-[11px] tabular-nums">
            <span className="text-foreground">
              <span className="text-muted-foreground">Est </span>
              {formatUsd(est)}
            </span>
            <span className="text-success">
              <span className="text-muted-foreground">Act </span>
              {formatUsd(act)}
            </span>
          </div>
        </div>

        {canManage && !editing ? (
          <div
            className={`
              flex shrink-0 items-center gap-0.5 opacity-0
              group-hover:opacity-100
            `}
          >
            <button
              type="button"
              aria-label={`Rename ${stage.label}`}
              className={`
                text-muted-foreground p-0.5
                hover:text-foreground
              `}
              onClick={onStartEdit}
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label={`Delete ${stage.label}`}
              className={`
                text-muted-foreground p-0.5
                hover:text-destructive
              `}
              onClick={onDelete}
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ) : null}
      </div>

      <div
        onDragOver={(e) => (canMove ? onCardDragOver(e, stage.key) : undefined)}
        onDragLeave={() => onCardDragLeave(stage.key)}
        onDrop={(e) => (canMove ? onCardDrop(e, stage.key) : undefined)}
        className={`
          flex max-h-[calc(100vh-360px)] flex-col gap-2 overflow-y-auto p-2
          ${
            dragOverStage === stage.key
              ? "bg-accent/30 ring-primary ring-2 ring-inset"
              : ""
          }
        `}
      >
        {cards.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-xs">
            No investors
          </p>
        ) : (
          cards.map((i) => {
            const est = parseInvestmentAmount(i.estInvestment);
            const date = formatDate(i.lastContactDate);
            const isCardDragging = draggingCardId === i.id;
            return (
              <button
                key={i.id}
                type="button"
                draggable={canMove}
                onDragStart={(e) => onCardDragStart(e, i.id)}
                onDragEnd={onCardDragEnd}
                onClick={() => onOpenInvestor?.(i.id)}
                className={`
                  border-border bg-background flex flex-col gap-1 rounded-md
                  border p-2 text-left
                  hover:border-foreground/20 hover:shadow-sm
                  ${isCardDragging ? "opacity-40" : ""}
                  ${
                    canMove
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
                  {i.name}
                </p>
                <p className="text-muted-foreground text-[11px]">
                  {typeLabel(i.type)}
                  {i.contactName ? ` · ${i.contactName}` : ""}
                </p>
                <div
                  className={`
                    text-foreground flex items-center justify-between
                    text-[11px] tabular-nums
                  `}
                >
                  <span>{est > 0 ? formatUsd(est) : "—"}</span>
                  {i.region ? (
                    <span className="text-muted-foreground">{i.region}</span>
                  ) : null}
                </div>
                <div
                  className={`
                    text-muted-foreground flex flex-wrap items-center gap-x-2
                    text-[10px]
                  `}
                >
                  {i.adder?.name ? (
                    <span>
                      <span className="opacity-70">Owner </span>
                      {i.adder.name}
                    </span>
                  ) : null}
                  {date ? (
                    <span>
                      <span className="opacity-70">Last </span>
                      {date}
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })
        )}

        {hasMore ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-1 w-full"
            onClick={onLoadMore}
            disabled={column.loading}
          >
            {column.loading ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <ChevronDown className="size-3" />
            )}
            Load more ({column.total - cards.length})
          </Button>
        ) : null}
      </div>
    </div>
  );
}

// ─── Board ────────────────────────────────────────────────────────────

export function InvestorPipelineKanban({
  refreshKey = 0,
  onOpenInvestor,
  onMutate,
}: InvestorPipelineKanbanProps) {
  const { hasPermission } = useAuth();
  const canMove = hasPermission("investors:update");
  const canManage = hasPermission("investors:update");
  const { types: investorTypes, typeLabel } = useInvestorTypes();

  const [stages, setStages] = useState<InvestorPipelineStage[]>([]);
  const [columns, setColumns] = useState<Record<string, ColumnState>>({});
  // Server-computed per-stage est/act roll-ups (across ALL investors in
  // the stage, not just the loaded page).
  const [totals, setTotals] = useState<InvestorPipelineTotals>({});
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draggingColKey, setDraggingColKey] = useState<string | null>(null);
  const [addingStage, setAddingStage] = useState(false);
  const stagesRef = useRef<InvestorPipelineStage[]>([]);
  stagesRef.current = stages;

  const columnSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Load the per-stage investor cards for the current stage set + filters.
  const fetchCards = useCallback(
    async (stageList: InvestorPipelineStage[]) => {
      const results = await Promise.all(
        stageList.map((s) =>
          listInvestors({
            page: 1,
            limit: COLUMN_PAGE_SIZE,
            status: s.key,
            ...(typeFilter && { type: typeFilter }),
            ...(debouncedSearch && { search: debouncedSearch }),
          }),
        ),
      );
      const next: Record<string, ColumnState> = {};
      stageList.forEach((s, idx) => {
        const res = results[idx];
        next[s.key] = {
          items: res.data,
          page: 1,
          total: res.meta.total,
          loading: false,
        };
      });
      setColumns(next);
    },
    [typeFilter, debouncedSearch],
  );

  // Pull the per-stage est/act roll-up. Cheap; called on load and after
  // a card moves stage so the column headers stay accurate.
  const refreshTotals = useCallback(async () => {
    try {
      const res = await getInvestorPipelineTotals();
      setTotals(res.data);
    } catch {
      // Non-fatal: headers fall back to 0 / "—".
    }
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const stageRes = await listInvestorStages();
      setStages(stageRes.data);
      await Promise.all([fetchCards(stageRes.data), refreshTotals()]);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to load pipeline";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [fetchCards, refreshTotals]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll, refreshKey]);

  const loadMore = useCallback(
    async (stageKey: string) => {
      setColumns((prev) => ({
        ...prev,
        [stageKey]: { ...prev[stageKey], loading: true },
      }));
      try {
        const current = columns[stageKey];
        const res = await listInvestors({
          page: current.page + 1,
          limit: COLUMN_PAGE_SIZE,
          status: stageKey,
          ...(typeFilter && { type: typeFilter }),
          ...(debouncedSearch && { search: debouncedSearch }),
        });
        setColumns((prev) => ({
          ...prev,
          [stageKey]: {
            items: [...prev[stageKey].items, ...res.data],
            page: prev[stageKey].page + 1,
            total: res.meta.total,
            loading: false,
          },
        }));
      } catch (err) {
        setColumns((prev) => ({
          ...prev,
          [stageKey]: { ...prev[stageKey], loading: false },
        }));
        const message =
          err instanceof ApiError ? err.message : "Failed to load more";
        toast.error(message);
      }
    },
    [columns, typeFilter, debouncedSearch],
  );

  // ── Card move (native HTML5 DnD, optimistic + revert) ──
  async function moveInvestor(id: string, nextStage: string) {
    const previous = columns;
    let sourceStage: string | null = null;
    let target: Investor | undefined;
    for (const s of stagesRef.current) {
      const match = previous[s.key]?.items.find((i) => i.id === id);
      if (match) {
        sourceStage = s.key;
        target = match;
        break;
      }
    }
    if (!target || !sourceStage || sourceStage === nextStage) return;
    const moved = { ...target, status: nextStage };
    setColumns({
      ...previous,
      [sourceStage]: {
        ...previous[sourceStage],
        items: previous[sourceStage].items.filter((i) => i.id !== id),
        total: Math.max(0, previous[sourceStage].total - 1),
      },
      [nextStage]: {
        ...previous[nextStage],
        items: [moved, ...previous[nextStage].items],
        total: previous[nextStage].total + 1,
      },
    });
    try {
      await updateInvestor(id, { status: nextStage });
      void refreshTotals();
      onMutate?.();
    } catch (err) {
      setColumns(previous);
      const message =
        err instanceof ApiError ? err.message : "Failed to move investor";
      toast.error(message);
    }
  }

  function handleCardDragStart(e: React.DragEvent, id: string) {
    setDraggingCardId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  }
  function handleCardDragEnd() {
    setDraggingCardId(null);
    setDragOverStage(null);
  }
  function handleCardDragOver(e: React.DragEvent, stageKey: string) {
    if (!draggingCardId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverStage !== stageKey) setDragOverStage(stageKey);
  }
  function handleCardDragLeave(stageKey: string) {
    if (dragOverStage === stageKey) setDragOverStage(null);
  }
  function handleCardDrop(e: React.DragEvent, stageKey: string) {
    e.preventDefault();
    const id = draggingCardId ?? e.dataTransfer.getData("text/plain");
    setDraggingCardId(null);
    setDragOverStage(null);
    if (id) void moveInvestor(id, stageKey);
  }

  // ── Column reorder (dnd-kit, optimistic + revert) ──
  async function handleColumnDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setDraggingColKey(null);
    if (!over || active.id === over.id) return;
    const activeKey = String(active.id).replace("inv-stage-col-", "");
    const overKey = String(over.id).replace("inv-stage-col-", "");
    const from = stages.findIndex((s) => s.key === activeKey);
    const to = stages.findIndex((s) => s.key === overKey);
    if (from < 0 || to < 0) return;
    const previous = stages;
    const next = [...stages];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setStages(next);
    try {
      await reorderInvestorStages(next.map((s) => s.key));
    } catch (err) {
      setStages(previous);
      const message =
        err instanceof ApiError ? err.message : "Failed to reorder stages";
      toast.error(message);
    }
  }

  // ── Stage rename / delete / add ──
  async function saveRename(key: string, label: string) {
    if (!label) {
      setEditingKey(null);
      return;
    }
    const previous = stages;
    setStages((prev) => prev.map((s) => (s.key === key ? { ...s, label } : s)));
    setEditingKey(null);
    try {
      await updateInvestorStage(key, { label });
    } catch (err) {
      setStages(previous);
      const message =
        err instanceof ApiError ? err.message : "Failed to rename stage";
      toast.error(message);
    }
  }

  async function deleteStage(stage: InvestorPipelineStage) {
    const count = columns[stage.key]?.total ?? 0;
    const msg =
      count > 0
        ? `Delete "${stage.label}"? Its ${count} investor(s) move to the first stage.`
        : `Delete "${stage.label}"?`;
    if (!window.confirm(msg)) return;
    try {
      await deleteInvestorStage(stage.key);
      toast.success("Stage deleted");
      await fetchAll();
    } catch (err) {
      const m =
        err instanceof ApiError ? err.message : "Failed to delete stage";
      toast.error(m);
    }
  }

  async function addStage() {
    const label = window.prompt("New stage name");
    if (!label?.trim()) return;
    setAddingStage(true);
    try {
      // Cycle the palette by current stage count for a distinct colour.
      const color =
        INVESTOR_STAGE_COLORS[stages.length % INVESTOR_STAGE_COLORS.length];
      await createInvestorStage({ label: label.trim(), color });
      toast.success("Stage added");
      await fetchAll();
    } catch (err) {
      const m = err instanceof ApiError ? err.message : "Failed to add stage";
      toast.error(m);
    } finally {
      setAddingStage(false);
    }
  }

  const draggingColLabel =
    draggingColKey != null
      ? (stages.find((s) => s.key === draggingColKey)?.label ?? null)
      : null;

  return (
    <div>
      <p className="text-muted-foreground mb-4 text-sm">
        Pipeline view — investors grouped by fundraising stage. Drag the column
        grip to reorder stages; use the pencil to rename or trash to delete.
        Drag a card to another column to change stage.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search
            className={`
              text-muted-foreground absolute top-1/2 left-2.5 size-3.5
              -translate-y-1/2
            `}
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, contact or email…"
            className="h-8 pl-8 text-xs"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className={`
            border-border bg-background h-8 rounded-md border px-2 text-xs
          `}
          aria-label="Filter by type"
        >
          <option value="">All types</option>
          {investorTypes.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
        {canManage ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void addStage()}
            disabled={addingStage}
          >
            <Plus className="mr-1 size-3.5" />
            Add stage
          </Button>
        ) : null}
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
            if (event.active.data.current?.type === "investor-stage-column") {
              setDraggingColKey(event.active.data.current.key as string);
            }
          }}
          onDragEnd={handleColumnDragEnd}
          onDragCancel={() => setDraggingColKey(null)}
        >
          <div className="flex gap-3 overflow-x-auto pb-2">
            <SortableContext
              items={stages.map((s) => colSortableId(s.key))}
              strategy={horizontalListSortingStrategy}
            >
              {stages.map((stage) => (
                <StageColumn
                  key={stage.key}
                  stage={stage}
                  column={columns[stage.key] ?? emptyColumn()}
                  est={totals[stage.key]?.est ?? 0}
                  act={totals[stage.key]?.act ?? 0}
                  typeLabel={typeLabel}
                  canMove={canMove}
                  canManage={canManage}
                  draggingCardId={draggingCardId}
                  dragOverStage={dragOverStage}
                  editing={editingKey === stage.key}
                  onStartEdit={() => setEditingKey(stage.key)}
                  onCancelEdit={() => setEditingKey(null)}
                  onSaveEdit={(label) => void saveRename(stage.key, label)}
                  onDelete={() => void deleteStage(stage)}
                  onLoadMore={() => void loadMore(stage.key)}
                  onOpenInvestor={onOpenInvestor}
                  onCardDragStart={handleCardDragStart}
                  onCardDragEnd={handleCardDragEnd}
                  onCardDragOver={handleCardDragOver}
                  onCardDragLeave={handleCardDragLeave}
                  onCardDrop={handleCardDrop}
                />
              ))}
            </SortableContext>
          </div>

          <DragOverlay dropAnimation={null}>
            {draggingColLabel ? (
              <div
                className={`
                  bg-surface border-border w-[260px] rotate-1 rounded-lg border
                  border-t-2 px-3 py-2 shadow-lg
                `}
              >
                <p className="text-foreground text-sm font-semibold">
                  {draggingColLabel}
                </p>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
