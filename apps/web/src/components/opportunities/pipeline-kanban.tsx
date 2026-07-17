"use client";

import { format } from "date-fns";
import { ChevronDown, Loader2, Plus, Settings2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { PermissionButton } from "@/components/shared/permission-button";
import { Button } from "@/components/ui/button";
import { CRM_ACCOUNT_REGIONS, CRM_ALL_COUNTRIES } from "@/constants/crm-geo";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import {
  getOpportunityPipeline,
  listOpportunities,
  type Opportunity,
  OPPORTUNITY_STAGE_LABELS,
  OPPORTUNITY_STAGES,
  type OpportunityStage,
  type PipelineRow,
  reorderOpportunitiesWithinStage,
  updateOpportunity,
} from "@/services/crm-opportunity.service";
import {
  type AssignableUser,
  listAssignableUsers,
} from "@/services/directory.service";

const OpportunityFormDialog = dynamic(() =>
  import("@/components/opportunities/opportunity-form-dialog").then(
    (module) => module.OpportunityFormDialog,
  ),
);
const OpportunityDetailSheet = dynamic(() =>
  import("@/components/opportunities/opportunity-detail-sheet").then(
    (module) => module.OpportunityDetailSheet,
  ),
);
const LostReasonsManagerDialog = dynamic(() =>
  import("@/components/crm/lost-reasons-manager-dialog").then(
    (module) => module.LostReasonsManagerDialog,
  ),
);
const StageConfigManagerDialog = dynamic(() =>
  import("@/components/crm/stage-config-manager-dialog").then(
    (module) => module.StageConfigManagerDialog,
  ),
);
const ExchangeRatesManagerDialog = dynamic(() =>
  import("@/components/crm/exchange-rates-manager-dialog").then(
    (module) => module.ExchangeRatesManagerDialog,
  ),
);

// Per-column page size. With 6 stages this gives a 300-row first paint
// across 6 parallel list calls — big enough that most workspaces never see
// "Load more", small enough that loads stay snappy on slow networks.
const COLUMN_PAGE_SIZE = 50;

interface ColumnState {
  items: Opportunity[];
  page: number;
  total: number;
  loading: boolean;
}

function emptyColumn(): ColumnState {
  return { items: [], page: 1, total: 0, loading: false };
}

// Show a per-currency total per column; no implicit FX, side-by-
// side currencies instead.
function formatCurrency(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

// Stable per-stage colour. Literal class strings in a static map so
// Tailwind's source scan keeps them (dynamic class strings
// get purged). Keyed by stage so the type-checker enforces exhaustiveness.
const STAGE_BORDER: Record<OpportunityStage, string> = {
  qualified: "border-t-blue-500",
  proposal: "border-t-amber-500",
  negotiation: "border-t-orange-500",
  closed_won: "border-t-green-600",
  live: "border-t-violet-500",
  closed_lost: "border-t-destructive",
};

function stageBorderClass(stage: OpportunityStage): string {
  return STAGE_BORDER[stage] ?? "border-t-zinc-500";
}

interface PipelineKanbanProps {
  /** Bump after account saves so pipeline cards reflect deal sync. */
  refreshKey?: number;
  /**
   * Fired after any pipeline-side mutation (drag-stage, create, edit,
   * close-lost, reopen, delete). The Accounts tab listens for this so
   * its joined-opportunity columns stay in sync with the latest stage
   * / probability / value the rep just changed. Edits should reflect on
   * both surfaces without a manual
   * tab switch.
   */
  onPipelineMutate?: () => void;
}

export function PipelineKanban({
  refreshKey = 0,
  onPipelineMutate,
}: PipelineKanbanProps) {
  // Per-stage column state. We fetch each stage independently so a heavy
  // qualified column doesn't crowd out closed_lost cards via the old
  // `limit: 100` flat fetch.
  const [columns, setColumns] = useState<Record<OpportunityStage, ColumnState>>(
    () => {
      const init = {} as Record<OpportunityStage, ColumnState>;
      for (const s of OPPORTUNITY_STAGES) init[s] = emptyColumn();
      return init;
    },
  );
  const [pipeline, setPipeline] = useState<PipelineRow[]>([]);
  // Pipeline-level geographic filter. Empty
  // string means "All" so the dropdown's first option is always selectable.
  const [countryFilter, setCountryFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  // Pipeline also needs the
  // same filter set as Accounts. Country was already here but sourced
  // from `getOpportunityFilterOptions` (the existing-data shortlist).
  // The new CRM_ALL_COUNTRIES constant carries all 249 ISO 3166-1
  // entries so reps can pre-filter to a country before any
  // opportunity has been logged there. Owner filter is new: the
  // Pipeline previously had no way to scope to a single rep's book.
  const [ownerFilter, setOwnerFilter] = useState("");
  const [ownerOptions, setOwnerOptions] = useState<AssignableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Opportunity | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [lostReasonsManagerOpen, setLostReasonsManagerOpen] = useState(false);
  const [exchangeRatesManagerOpen, setExchangeRatesManagerOpen] =
    useState(false);
  const [stageConfigManagerOpen, setStageConfigManagerOpen] = useState(false);
  const [detailOppId, setDetailOppId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  // The stage the dragged card started in — lets a drop decide between an
  // in-column reorder (same stage) and a cross-column stage change.
  const [draggingFromStage, setDraggingFromStage] =
    useState<OpportunityStage | null>(null);
  const [dragOverStage, setDragOverStage] = useState<OpportunityStage | null>(
    null,
  );

  const { hasPermission } = useAuth();
  const canMove = hasPermission("crm:update");

  const fetchPipeline = useCallback(async () => {
    try {
      setLoading(true);
      // Fire one request per stage in parallel + the rollup totals call
      // + the cross-currency forecast. Geographic filters
      // propagate into every per-stage list call so the
      // column counts and cards stay consistent.
      const geo = {
        ...(countryFilter && { country: countryFilter }),
        ...(regionFilter && { region: regionFilter }),
        ...(ownerFilter && { ownerId: ownerFilter }),
      };
      const [pipelineRes, ...stageResults] = await Promise.all([
        getOpportunityPipeline(),
        ...OPPORTUNITY_STAGES.map((stage) =>
          listOpportunities({
            page: 1,
            limit: COLUMN_PAGE_SIZE,
            stage,
            ...geo,
          }),
        ),
      ]);
      setPipeline(pipelineRes.data);
      const next = {} as Record<OpportunityStage, ColumnState>;
      OPPORTUNITY_STAGES.forEach((stage, idx) => {
        const res = stageResults[idx];
        next[stage] = {
          items: res.data,
          page: 1,
          total: res.meta.total,
          loading: false,
        };
      });
      setColumns(next);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to load pipeline";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [countryFilter, regionFilter, ownerFilter]);

  // Combined notifier — re-fetches our own pipeline AND tells the
  // Accounts tab to refresh its joined-opportunity columns. Wraps the
  // common `fetchPipeline + onPipelineMutate?.()` pair so every
  // mutation hook below can pass a single callback.
  const notifyPipelineMutated = useCallback(() => {
    void fetchPipeline();
    onPipelineMutate?.();
  }, [fetchPipeline, onPipelineMutate]);

  const loadMore = useCallback(
    async (stage: OpportunityStage) => {
      setColumns((prev) => ({
        ...prev,
        [stage]: { ...prev[stage], loading: true },
      }));
      try {
        const current = columns[stage];
        const res = await listOpportunities({
          page: current.page + 1,
          limit: COLUMN_PAGE_SIZE,
          stage,
          ...(countryFilter && { country: countryFilter }),
          ...(regionFilter && { region: regionFilter }),
          ...(ownerFilter && { ownerId: ownerFilter }),
        });
        setColumns((prev) => ({
          ...prev,
          [stage]: {
            items: [...prev[stage].items, ...res.data],
            page: prev[stage].page + 1,
            total: res.meta.total,
            loading: false,
          },
        }));
      } catch (err) {
        setColumns((prev) => ({
          ...prev,
          [stage]: { ...prev[stage], loading: false },
        }));
        const message =
          err instanceof ApiError ? err.message : "Failed to load more";
        toast.error(message);
      }
    },
    [columns, countryFilter, regionFilter, ownerFilter],
  );

  useEffect(() => {
    fetchPipeline();
  }, [fetchPipeline, refreshKey]);

  // Load active users
  // once for the Owner filter dropdown. `/directory/assignable` is
  // auth-only so reps without `user:read` can still populate it.
  useEffect(() => {
    let cancelled = false;
    listAssignableUsers({ page: 1, limit: 500 })
      .then((res) => {
        if (!cancelled) setOwnerOptions(res.data);
      })
      .catch(() => {
        if (!cancelled) setOwnerOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openCard(o: Opportunity) {
    setDetailOppId(o.id);
    setDetailOpen(true);
  }

  function openEditFromSheet(o: Opportunity) {
    setDetailOpen(false);
    setEditing(o);
    setFormOpen(true);
  }

  // Native HTML5 DnD. The previous-state snapshot lets us roll back the
  // optimistic update if the API rejects the move (e.g. closed_won/lost
  // guard from #90).
  async function moveOpportunity(id: string, nextStage: OpportunityStage) {
    const previous = columns;
    // Find the source stage + card so we can pluck it out and append to
    // the destination column optimistically.
    let sourceStage: OpportunityStage | null = null;
    let target: Opportunity | undefined;
    for (const stage of OPPORTUNITY_STAGES) {
      const match = previous[stage].items.find((o) => o.id === id);
      if (match) {
        sourceStage = stage;
        target = match;
        break;
      }
    }
    if (!target || !sourceStage || sourceStage === nextStage) return;

    const movedCard = { ...target, stage: nextStage };
    setColumns({
      ...previous,
      [sourceStage]: {
        ...previous[sourceStage],
        items: previous[sourceStage].items.filter((o) => o.id !== id),
        total: Math.max(0, previous[sourceStage].total - 1),
      },
      [nextStage]: {
        ...previous[nextStage],
        items: [movedCard, ...previous[nextStage].items],
        total: previous[nextStage].total + 1,
      },
    });

    try {
      await updateOpportunity(id, { stage: nextStage });
      // Refresh to get the fresh probability snap + the updated
      // per-currency totals + correct counts in case anything raced.
      fetchPipeline();
      // Tell the Accounts tab its joined-opportunity columns are stale.
      onPipelineMutate?.();
    } catch (err) {
      setColumns(previous);
      const message =
        err instanceof ApiError ? err.message : "Failed to move opportunity";
      toast.error(message);
    }
  }

  // Optimistically apply a reordered card list for one stage and persist it.
  // Snapshots `columns` at call time so a failed save rolls back cleanly.
  // Shared by the drop-on-card and drop-on-empty paths.
  async function persistReorder(stage: OpportunityStage, next: Opportunity[]) {
    const previous = columns;
    setColumns({ ...previous, [stage]: { ...previous[stage], items: next } });
    try {
      await reorderOpportunitiesWithinStage({
        stageKey: stage,
        orderedIds: next.map((o) => o.id),
      });
    } catch (err) {
      setColumns(previous);
      const message =
        err instanceof ApiError ? err.message : "Failed to reorder";
      toast.error(message);
    }
  }

  // Reorder a card within its own column (drop onto another card in the same
  // stage). The dragged card lands BEFORE the target in both directions —
  // when dragging downward we adjust for the removal shift so it doesn't slip
  // past the target.
  function reorderCard(
    draggedId: string,
    targetId: string,
    stage: OpportunityStage,
  ) {
    if (draggedId === targetId) return;
    const items = columns[stage].items;
    const from = items.findIndex((o) => o.id === draggedId);
    const to = items.findIndex((o) => o.id === targetId);
    if (from < 0 || to < 0 || from === to) return;

    const next = [...items];
    const [moved] = next.splice(from, 1);
    // Removing the dragged card shifts later indices left by one, so for a
    // downward move insert at to-1 to land immediately before the target.
    next.splice(from < to ? to - 1 : to, 0, moved);
    void persistReorder(stage, next);
  }

  // Move a card to the bottom of its column (drop onto the empty column body
  // below the cards). Persists the new order for that stage.
  function reorderCardToEnd(draggedId: string, stage: OpportunityStage) {
    const items = columns[stage].items;
    const from = items.findIndex((o) => o.id === draggedId);
    if (from < 0 || from === items.length - 1) return;

    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.push(moved);
    void persistReorder(stage, next);
  }

  function handleDragStart(
    e: React.DragEvent,
    oppId: string,
    stage: OpportunityStage,
  ) {
    setDraggingId(oppId);
    setDraggingFromStage(stage);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", oppId);
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDraggingFromStage(null);
    setDragOverStage(null);
  }

  function handleDragOver(e: React.DragEvent, stage: OpportunityStage) {
    if (!draggingId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverStage !== stage) setDragOverStage(stage);
  }

  // Drop on the column body: same stage → send the card to the bottom;
  // different stage → change its stage (cross-column move).
  function handleDrop(e: React.DragEvent, stage: OpportunityStage) {
    e.preventDefault();
    const id = draggingId ?? e.dataTransfer.getData("text/plain");
    const fromStage = draggingFromStage;
    setDraggingId(null);
    setDraggingFromStage(null);
    setDragOverStage(null);
    if (!id) return;
    if (fromStage === stage) void reorderCardToEnd(id, stage);
    else void moveOpportunity(id, stage);
  }

  // Drop directly onto another card: same stage → reorder before it;
  // different stage → change stage. Stops propagation so the column-body
  // drop handler doesn't also fire.
  function handleDropOnCard(
    e: React.DragEvent,
    targetId: string,
    stage: OpportunityStage,
  ) {
    e.preventDefault();
    e.stopPropagation();
    const id = draggingId ?? e.dataTransfer.getData("text/plain");
    const fromStage = draggingFromStage;
    setDraggingId(null);
    setDraggingFromStage(null);
    setDragOverStage(null);
    if (!id || id === targetId) return;
    if (fromStage === stage) void reorderCard(id, targetId, stage);
    else void moveOpportunity(id, stage);
  }

  // Per-currency totals per stage from the rollup endpoint.
  const totalsByStage = new Map<OpportunityStage, PipelineRow[]>();
  for (const stage of OPPORTUNITY_STAGES) totalsByStage.set(stage, []);
  for (const row of pipeline) {
    const list = totalsByStage.get(row.stage as OpportunityStage);
    if (list) list.push(row);
  }

  return (
    <div>
      <div className={`mb-4 flex flex-wrap items-center justify-between gap-3`}>
        <p className="text-muted-foreground text-sm">
          Pipeline view — opportunities grouped by stage. Tap a card for
          details, drag it onto another card to reorder within a column, or drag
          it to another column to change stage.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            className={`
              border-border bg-background h-8 rounded-md border px-2 text-xs
            `}
            aria-label="Filter by region"
          >
            <option value="">All regions</option>
            {CRM_ACCOUNT_REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <select
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className={`
              border-border bg-background h-8 rounded-md border px-2 text-xs
            `}
            aria-label="Filter by country"
          >
            <option value="">All countries</option>
            {CRM_ALL_COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            className={`
              border-border bg-background h-8 rounded-md border px-2 text-xs
            `}
            aria-label="Filter by owner"
          >
            <option value="">All owners</option>
            {ownerOptions.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <PermissionButton
            permission="accounting:admin"
            variant="outline"
            onClick={() => setExchangeRatesManagerOpen(true)}
          >
            <Settings2 className="mr-1.5 size-3.5" />
            Manage FX rates
          </PermissionButton>
          <PermissionButton
            permission="crm:admin"
            variant="outline"
            onClick={() => setStageConfigManagerOpen(true)}
          >
            <Settings2 className="mr-1.5 size-3.5" />
            Manage stages
          </PermissionButton>
          <PermissionButton
            permission="crm:admin"
            variant="outline"
            onClick={() => setLostReasonsManagerOpen(true)}
          >
            <Settings2 className="mr-1.5 size-3.5" />
            Manage lost reasons
          </PermissionButton>
          <PermissionButton permission="crm:create" onClick={openCreate}>
            <Plus className="mr-1.5 size-3.5" />
            New opportunity
          </PermissionButton>
        </div>
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
        <div
          className={`
            grid grid-cols-1 gap-3
            md:grid-cols-3
            xl:grid-cols-6
          `}
        >
          {OPPORTUNITY_STAGES.map((stage) => {
            const column = columns[stage];
            const cards = column.items;
            const totals = totalsByStage.get(stage) ?? [];
            // Prefer the rollup count (covers all currencies); fall back to
            // the column's own meta.total when the rollup has no row for
            // this stage (zero opps).
            const totalCount =
              totals.reduce((sum, t) => sum + t.count, 0) || column.total;
            const hasMore = cards.length < column.total;
            return (
              <div
                key={stage}
                className={`
                  bg-surface border-border flex flex-col rounded-lg border
                  border-t-2 shadow-sm
                  ${stageBorderClass(stage)}
                `}
              >
                <div className="border-border border-b p-3">
                  <p className="text-foreground text-sm font-semibold">
                    {OPPORTUNITY_STAGE_LABELS[stage]}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-[11px]">
                    {totalCount} {totalCount === 1 ? "opp" : "opps"}
                  </p>
                  {totals.length === 0 ? (
                    <p
                      className={`
                        text-muted-foreground mt-1 text-[11px] tabular-nums
                      `}
                    >
                      —
                    </p>
                  ) : (
                    <div className="mt-1 flex flex-col gap-0.5">
                      {totals.map((t) => (
                        <p
                          key={t.currency}
                          className="text-foreground text-xs tabular-nums"
                        >
                          {formatCurrency(t.totalValue, t.currency)}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
                <div
                  onDragOver={(e) =>
                    canMove ? handleDragOver(e, stage) : undefined
                  }
                  onDragLeave={() => {
                    if (dragOverStage === stage) setDragOverStage(null);
                  }}
                  onDrop={(e) => (canMove ? handleDrop(e, stage) : undefined)}
                  className={`
                    flex max-h-[60vh] flex-col gap-2 overflow-y-auto p-2
                    ${
                      dragOverStage === stage
                        ? "bg-accent/30 ring-primary ring-2 ring-inset"
                        : ""
                    }
                  `}
                >
                  {cards.length === 0 ? (
                    <p
                      className={`
                        text-muted-foreground py-4 text-center text-xs
                      `}
                    >
                      No opportunities
                    </p>
                  ) : (
                    cards.map((o) => {
                      const isTerminal =
                        o.stage === "closed_won" || o.stage === "closed_lost";
                      const isDragging = draggingId === o.id;
                      return (
                        <button
                          key={o.id}
                          type="button"
                          draggable={canMove}
                          onDragStart={(e) => handleDragStart(e, o.id, stage)}
                          onDragEnd={handleDragEnd}
                          onDragOver={(e) => {
                            if (!canMove || !draggingId) return;
                            // Accept a drop on this card so the column-body
                            // handler doesn't claim every reorder as "to end".
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onDrop={(e) =>
                            canMove
                              ? handleDropOnCard(e, o.id, stage)
                              : undefined
                          }
                          onClick={() => openCard(o)}
                          className={`
                            border-border bg-background flex flex-col gap-1
                            rounded-md border p-2 text-left
                            hover:border-foreground/20 hover:shadow-sm
                            ${isTerminal ? "opacity-70" : ""}
                            ${isDragging ? "opacity-40" : ""}
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
                            className={`
                              text-foreground line-clamp-2 text-xs font-medium
                            `}
                          >
                            {o.name}
                          </p>
                          <p className="text-muted-foreground text-[11px]">
                            {o.account?.name ?? "—"}
                          </p>
                          <div
                            className={`
                              text-foreground flex items-center justify-between
                              text-[11px] tabular-nums
                            `}
                          >
                            <span>
                              {formatCurrency(Number(o.value), o.currency)}
                            </span>
                            <span className="text-muted-foreground">
                              {o.probability}%
                            </span>
                          </div>
                          {o.owner ? (
                            <p className="text-muted-foreground text-[10px]">
                              <span className="opacity-70">Owner </span>
                              {o.owner.name}
                            </p>
                          ) : null}
                          {o.closeDate || o.launchDate ? (
                            <p
                              className={`
                                text-muted-foreground flex flex-wrap gap-x-2
                                text-[10px]
                              `}
                            >
                              {o.closeDate ? (
                                <span>
                                  <span className="opacity-70">Close </span>
                                  {format(
                                    new Date(
                                      String(o.closeDate).slice(0, 10) +
                                        "T00:00:00",
                                    ),
                                    "MMM d",
                                  )}
                                </span>
                              ) : null}
                              {o.launchDate ? (
                                <span>
                                  <span className="opacity-70">Launch </span>
                                  {format(
                                    new Date(
                                      String(o.launchDate).slice(0, 10) +
                                        "T00:00:00",
                                    ),
                                    "MMM d",
                                  )}
                                </span>
                              ) : null}
                            </p>
                          ) : null}
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
                      onClick={() => loadMore(stage)}
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
          })}
        </div>
      )}

      {formOpen ? (
        <OpportunityFormDialog
          open
          onOpenChange={setFormOpen}
          opportunity={editing}
          onSaved={notifyPipelineMutated}
        />
      ) : null}

      {detailOpen ? (
        <OpportunityDetailSheet
          open
          onOpenChange={setDetailOpen}
          opportunityId={detailOppId}
          onEdit={openEditFromSheet}
          onClosedLost={notifyPipelineMutated}
          onReopened={notifyPipelineMutated}
          onDeleted={notifyPipelineMutated}
        />
      ) : null}

      {lostReasonsManagerOpen ? (
        <LostReasonsManagerDialog
          open
          onOpenChange={setLostReasonsManagerOpen}
        />
      ) : null}

      {stageConfigManagerOpen ? (
        <StageConfigManagerDialog
          open
          onOpenChange={setStageConfigManagerOpen}
          // Re-fetch pipeline so the column headers / labels reflect the
          // freshly saved sortOrder + label.
          onSaved={fetchPipeline}
        />
      ) : null}

      {exchangeRatesManagerOpen ? (
        <ExchangeRatesManagerDialog
          open
          onOpenChange={setExchangeRatesManagerOpen}
          // Forecast totals (when present in a future PR) refetch via the
          // existing fetchPipeline path so any rate change re-rolls the
          // banner without a hard refresh.
          onMutated={fetchPipeline}
        />
      ) : null}
    </div>
  );
}
