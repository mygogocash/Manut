"use client";

import { format } from "date-fns";
import {
  ArchiveRestore,
  ArrowLeftRight,
  ChevronDown,
  Loader2,
  Plus,
  Settings2,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { BulkActionBar } from "@/components/crm/bulk-action-bar";
import { BulkBusinessUnitsDialog } from "@/components/crm/bulk-business-units-dialog";
import {
  BulkFieldDialog,
  type BulkFieldMode,
} from "@/components/crm/bulk-field-dialog";
import { BusinessUnitChips } from "@/components/crm/business-unit-chips";
import { BusinessUnitStageChips } from "@/components/crm/business-unit-stage-chips";
import { BusinessUnitsManagerDialog } from "@/components/crm/business-units-manager-dialog";
import { ExchangeRatesManagerDialog } from "@/components/crm/exchange-rates-manager-dialog";
import { LostReasonsManagerDialog } from "@/components/crm/lost-reasons-manager-dialog";
import { StageConfigManagerDialog } from "@/components/crm/stage-config-manager-dialog";
import { OpportunityDetailSheet } from "@/components/opportunities/opportunity-detail-sheet";
import { OpportunityFormDialog } from "@/components/opportunities/opportunity-form-dialog";
import { PipelineMoveSheet } from "@/components/opportunities/pipeline-move-sheet";
import { PermissionButton } from "@/components/shared/permission-button";
import { Tabs } from "@/components/shared/tabs";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CRM_ACCOUNT_REGIONS, CRM_ALL_COUNTRIES } from "@/constants/crm-geo";
import { useBulkSelection } from "@/hooks/use-bulk-selection";
import { useBusinessUnits } from "@/hooks/use-business-units";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import { BUSINESS_UNIT_UNASSIGNED } from "@/services/crm-business-unit.service";
import {
  getOpportunityPipeline,
  listOpportunities,
  type Opportunity,
  OPPORTUNITY_STAGE_LABELS,
  OPPORTUNITY_STAGES,
  type OpportunityStage,
  type PipelineRow,
  reorderOpportunityCards,
  unarchiveOpportunity,
  updateOpportunity,
} from "@/services/crm-opportunity.service";
import {
  bulkAssignOpportunitiesBusinessUnits,
  bulkUpdateOpportunitiesFields,
} from "@/services/crm-opportunity.service";
import {
  type AssignableUser,
  listAssignableUsers,
} from "@/services/directory.service";

// Per-column page size. With 6 stages this gives a 300-row first paint
// across 6 parallel list calls — big enough that most workspaces never see
// "Load more", small enough that loads stay snappy on slow networks.
const COLUMN_PAGE_SIZE = 50;

// Archived view page size. Archived opportunities are a rare tail, so a single
// modest page with a "Load more" affordance covers almost every workspace.
const ARCHIVED_PAGE_SIZE = 50;

interface ColumnState {
  items: Opportunity[];
  page: number;
  total: number;
  loading: boolean;
}

function emptyColumn(): ColumnState {
  return { items: [], page: 1, total: 0, loading: false };
}

// Show a per-currency total per column. PRD §11.5 — no FX in v2, side-by-
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
// Tailwind's source scan keeps them (CLAUDE.md — dynamic class strings
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
   * / probability / value the rep just changed. BD feedback (Vivek,
   * May 2026): edits should reflect on both surfaces without a manual
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
  // Active pipeline board vs a simple list of archived opportunities. The
  // board is the Active view (archived cards never appear in a stage column);
  // the Archived tab swaps it for a flat list with per-row Restore.
  const [view, setView] = useState<"active" | "archived">("active");
  const [archivedItems, setArchivedItems] = useState<Opportunity[]>([]);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [archivedTotal, setArchivedTotal] = useState(0);
  const [archivedPage, setArchivedPage] = useState(1);
  // BD-feedback (Vivek, May 2026) — pipeline-level geo filter. Empty
  // string means "All" so the dropdown's first option is always selectable.
  const [countryFilter, setCountryFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  // BD-feedback follow-up (Vivek, 2026-05-25) — Pipeline needs the
  // same filter set as Accounts. Country was already here but sourced
  // from `getOpportunityFilterOptions` (the existing-data shortlist).
  // The new CRM_ALL_COUNTRIES constant carries all 249 ISO 3166-1
  // entries so reps can pre-filter to a country before any
  // opportunity has been logged there. Owner filter is new: the
  // Pipeline previously had no way to scope to a single rep's book.
  const [ownerFilter, setOwnerFilter] = useState("");
  const [ownerOptions, setOwnerOptions] = useState<AssignableUser[]>([]);
  // Business-unit ("who is taking care of this card") filter. Seeded from
  // `?bu=` so the sidebar's per-unit views deep-link straight into a
  // filtered board, and written back on change so the URL stays shareable.
  const [businessUnitFilter, setBusinessUnitFilter] = useState("");
  const { units: businessUnits } = useBusinessUnits();
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Opportunity | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [lostReasonsManagerOpen, setLostReasonsManagerOpen] = useState(false);
  const [exchangeRatesManagerOpen, setExchangeRatesManagerOpen] =
    useState(false);
  const [stageConfigManagerOpen, setStageConfigManagerOpen] = useState(false);
  const [businessUnitsManagerOpen, setBusinessUnitsManagerOpen] =
    useState(false);
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

  // Bulk select-and-act. The board-wide total is the SUM OF THE SERVER-REPORTED
  // per-column totals, never `cards.length` — each column holds one page, so
  // counting loaded cards would understate "select all N matching" badly.
  const [bulkUnitsOpen, setBulkUnitsOpen] = useState(false);
  const [bulkFieldMode, setBulkFieldMode] = useState<BulkFieldMode | null>(
    null,
  );

  // Sum of the per-column server totals. Legitimate because each `total` came
  // from `res.meta.total`, not from the cards in memory.
  const boardTotal = OPPORTUNITY_STAGES.reduce(
    (sum, stage) => sum + (columns[stage]?.total ?? 0),
    0,
  );
  const selection = useBulkSelection(boardTotal);

  // `?bu=<code>` is what the sidebar's per-unit views link to. Reading it
  // through useSearchParams (rather than once on mount) matters: navigating
  // from one unit's view to another does not remount this component, so a
  // mount-only read would leave the board showing the previous unit.
  const searchParams = useSearchParams();
  const buParam = searchParams?.get("bu") ?? "";
  useEffect(() => {
    setBusinessUnitFilter(buParam);
  }, [buParam]);

  // Changing the filter in-page keeps the URL shareable and keeps the
  // sidebar highlight in sync. replaceState (not push) so the back button
  // isn't polluted by filter fiddling — same reasoning as useTabParam.
  const changeBusinessUnitFilter = useCallback((next: string) => {
    setBusinessUnitFilter(next);
    const params = new URLSearchParams(window.location.search);
    if (next) params.set("bu", next);
    else params.delete("bu");
    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${query ? `?${query}` : ""}`,
    );
  }, []);

  const fetchPipeline = useCallback(async () => {
    try {
      setLoading(true);
      // Fire one request per stage in parallel + the rollup totals call
      // + the cross-currency forecast (PRD §11.5 follow-up). Geo filters
      // (BD-feedback) propagate into every per-stage list call so the
      // column counts and cards stay consistent.
      const geo = {
        ...(countryFilter && { country: countryFilter }),
        ...(regionFilter && { region: regionFilter }),
        ...(ownerFilter && { ownerId: ownerFilter }),
        ...(businessUnitFilter && { businessUnit: businessUnitFilter }),
      };
      // The rollup takes the SAME filters as the per-stage lists, so the
      // column counts / totals always describe the cards below them.
      const [pipelineRes, ...stageResults] = await Promise.all([
        getOpportunityPipeline(geo),
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
  }, [countryFilter, regionFilter, ownerFilter, businessUnitFilter]);

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
          ...(businessUnitFilter && { businessUnit: businessUnitFilter }),
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
    [columns, countryFilter, regionFilter, ownerFilter, businessUnitFilter],
  );

  // Archived view fetch — a flat, owner-scoped list (same geo filters as the
  // board) of opportunities with archived=true. page 1 replaces; later pages
  // append behind "Load more".
  const fetchArchived = useCallback(
    async (page = 1) => {
      try {
        setArchivedLoading(true);
        const res = await listOpportunities({
          page,
          limit: ARCHIVED_PAGE_SIZE,
          archived: true,
          ...(countryFilter && { country: countryFilter }),
          ...(regionFilter && { region: regionFilter }),
          ...(ownerFilter && { ownerId: ownerFilter }),
          ...(businessUnitFilter && { businessUnit: businessUnitFilter }),
        });
        setArchivedItems((prev) =>
          page === 1 ? res.data : [...prev, ...res.data],
        );
        setArchivedTotal(res.meta.total);
        setArchivedPage(page);
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : "Failed to load archived opportunities";
        toast.error(message);
      } finally {
        setArchivedLoading(false);
      }
    },
    [countryFilter, regionFilter, ownerFilter, businessUnitFilter],
  );

  // Restore an archived opportunity back into the pipeline. Optimistically
  // drops it from the archived list + decrements the count, then notifies the
  // Accounts tab so its joined-opportunity columns pick the row back up.
  const handleRestore = useCallback(
    async (id: string) => {
      try {
        await unarchiveOpportunity(id);
        setArchivedItems((prev) => prev.filter((o) => o.id !== id));
        setArchivedTotal((t) => Math.max(0, t - 1));
        toast.success("Opportunity restored");
        onPipelineMutate?.();
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : "Failed to restore opportunity";
        toast.error(message);
      }
    },
    [onPipelineMutate],
  );

  // Load the active board or the archived list depending on the current view.
  // Both re-run when a geo filter changes (their callbacks depend on the
  // filters) and when the parent bumps refreshKey.
  useEffect(() => {
    if (view === "active") void fetchPipeline();
    else void fetchArchived(1);
  }, [view, fetchPipeline, fetchArchived, refreshKey]);

  // BD-feedback follow-up (Vivek, 2026-05-25) — load active users
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

  // Stage change without a drag — see pipeline-move-sheet.tsx. The card key is
  // `o.id`, which is exactly what `moveCard` looks up, so no adapter is needed.
  const [moveTarget, setMoveTarget] = useState<Opportunity | null>(null);

  // The detail sheet is per DEAL, so a card opens its parent deal.
  function openCard(card: Opportunity) {
    setDetailOppId(card.id);
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
  /**
   * Move a card — a whole deal — to another stage.
   *
   * Writes the DEAL, which is what makes the drop land where it was dropped.
   * The API pushes a deal-level stage onto the least-advanced unit only (see
   * `planDealFieldPushDown`) and then re-derives the roll-up from the units,
   * so the deal ends up at exactly the submitted stage while an already
   * advanced sibling is never dragged backwards. Units disagreeing is the
   * point; the chips are where that shows.
   */
  async function moveCard(
    key: string,
    nextStage: OpportunityStage,
  ): Promise<boolean> {
    const previous = columns;
    let sourceStage: OpportunityStage | null = null;
    let target: Opportunity | undefined;
    for (const stage of OPPORTUNITY_STAGES) {
      const match = previous[stage].items.find((c) => c.id === key);
      if (match) {
        sourceStage = stage;
        target = match;
        break;
      }
    }
    if (!target || !sourceStage || sourceStage === nextStage) return false;

    const movedCard = { ...target, stage: nextStage };
    setColumns({
      ...previous,
      [sourceStage]: {
        ...previous[sourceStage],
        items: previous[sourceStage].items.filter((c) => c.id !== key),
        total: Math.max(0, previous[sourceStage].total - 1),
      },
      [nextStage]: {
        ...previous[nextStage],
        items: [movedCard, ...previous[nextStage].items],
        total: previous[nextStage].total + 1,
      },
    });

    try {
      await updateOpportunity(target.id, { stage: nextStage });
      // Refresh for the probability snap (§11.4), the re-derived deal
      // roll-up, and the column figures in case anything raced.
      fetchPipeline();
      onPipelineMutate?.();
      return true;
    } catch (err) {
      setColumns(previous);
      const message =
        err instanceof ApiError ? err.message : "Failed to move card";
      toast.error(message);
      return false;
    }
  }

  // Optimistically apply a reordered card list for one stage and persist it.
  // Snapshots `columns` at call time so a failed save rolls back cleanly.
  // Shared by the drop-on-card and drop-on-empty paths.
  async function persistReorder(stage: OpportunityStage, next: Opportunity[]) {
    const previous = columns;
    setColumns({ ...previous, [stage]: { ...previous[stage], items: next } });
    try {
      // Deal ids: a card IS a deal, so one order per column per deal is
      // exactly the grain the board renders at.
      await reorderOpportunityCards({
        stageKey: stage,
        opportunityIds: next.map((c) => c.id),
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
    draggedKey: string,
    targetKey: string,
    stage: OpportunityStage,
  ) {
    if (draggedKey === targetKey) return;
    const items = columns[stage].items;
    const from = items.findIndex((c) => c.id === draggedKey);
    const to = items.findIndex((c) => c.id === targetKey);
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
  function reorderCardToEnd(draggedKey: string, stage: OpportunityStage) {
    const items = columns[stage].items;
    const from = items.findIndex((c) => c.id === draggedKey);
    if (from < 0 || from === items.length - 1) return;

    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.push(moved);
    void persistReorder(stage, next);
  }

  function handleDragStart(
    e: React.DragEvent,
    key: string,
    stage: OpportunityStage,
  ) {
    setDraggingId(key);
    setDraggingFromStage(stage);
    e.dataTransfer.effectAllowed = "move";
    // The deal id. A card is one whole deal, so this is unambiguous — it
    // was the (deal x unit) pair while a deal could hold several cards.
    e.dataTransfer.setData("text/plain", key);
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
    else void moveCard(id, stage);
  }

  // Drop directly onto another card: same stage → reorder before it;
  // different stage → change stage. Stops propagation so the column-body
  // drop handler doesn't also fire.
  function handleDropOnCard(
    e: React.DragEvent,
    targetKey: string,
    stage: OpportunityStage,
  ) {
    e.preventDefault();
    e.stopPropagation();
    const id = draggingId ?? e.dataTransfer.getData("text/plain");
    const fromStage = draggingFromStage;
    setDraggingId(null);
    setDraggingFromStage(null);
    setDragOverStage(null);
    if (!id || id === targetKey) return;
    if (fromStage === stage) void reorderCard(id, targetKey, stage);
    else void moveCard(id, stage);
  }

  // Per-stage column figures from the rollup endpoint. It returns one row
  // per (stage, currency), so the currencies are folded into a list per
  // stage here — never summed, because there is no FX layer in v2 and
  // USD 40,000 + THB 40,000 is not 80,000 of anything (PRD §11.5).
  //
  // The count is DEALS. It used to be cards-and-deals side by side, which
  // only meant something while one deal could hold several cards.
  const rollupByStage = new Map<
    OpportunityStage,
    { count: number; totals: { currency: string; value: number }[] }
  >();
  for (const row of pipeline) {
    const stage = row.stage as OpportunityStage;
    const acc = rollupByStage.get(stage) ?? { count: 0, totals: [] };
    acc.count += row.count;
    acc.totals.push({ currency: row.currency, value: row.totalValue });
    rollupByStage.set(stage, acc);
  }

  return (
    <div>
      <Tabs
        tabs={[
          { id: "active", label: "Active" },
          { id: "archived", label: "Archived" },
        ]}
        active={view}
        onChange={(v) => setView(v === "archived" ? "archived" : "active")}
      />

      <div className={`mb-4 flex flex-wrap items-center justify-between gap-3`}>
        <p className="text-muted-foreground text-sm">
          {view === "active"
            ? "Pipeline view — opportunities grouped by stage. Tap a card for details, drag it onto another card to reorder within a column, or drag it to another column to change stage."
            : "Archived opportunities — hidden from the pipeline board but kept for the record. Restore one to send it back to its stage."}
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
          <select
            value={businessUnitFilter}
            onChange={(e) => changeBusinessUnitFilter(e.target.value)}
            className={`
              border-border bg-background h-8 rounded-md border px-2 text-xs
            `}
            aria-label="Filter by business unit"
          >
            <option value="">All business units</option>
            {businessUnits.map((u) => (
              <option key={u.code} value={u.code}>
                {u.label}
              </option>
            ))}
            <option value={BUSINESS_UNIT_UNASSIGNED}>Unassigned</option>
          </select>
          <PermissionButton
            permission="crm:admin"
            variant="outline"
            onClick={() => setBusinessUnitsManagerOpen(true)}
          >
            <Settings2 className="mr-1.5 size-3.5" />
            Manage business units
          </PermissionButton>
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

      {view === "archived" ? (
        archivedLoading && archivedItems.length === 0 ? (
          <div
            className={`
              bg-surface border-border flex min-h-[300px] items-center
              justify-center rounded-lg border shadow-sm
            `}
          >
            <Loader2 className="text-muted-foreground size-5 animate-spin" />
          </div>
        ) : archivedItems.length === 0 ? (
          <div
            className={`
              bg-surface border-border flex min-h-[200px] flex-col items-center
              justify-center gap-1 rounded-lg border p-8 text-center shadow-sm
            `}
          >
            <p className="text-foreground text-sm font-medium">
              No archived opportunities
            </p>
            <p className="text-muted-foreground max-w-md text-xs">
              Archived deals are hidden from the pipeline board. Archive one
              from its detail panel and it will show up here, ready to restore.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div
              className={`
                grid grid-cols-1 gap-2
                md:grid-cols-2
                xl:grid-cols-3
              `}
            >
              {archivedItems.map((o) => (
                <div
                  key={o.id}
                  className={`
                    border-border bg-surface flex flex-col gap-1.5 rounded-lg
                    border p-3 shadow-sm
                  `}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p
                        className={`
                          text-foreground truncate text-xs font-medium
                        `}
                      >
                        {o.name}
                      </p>
                      <p className="text-muted-foreground truncate text-[11px]">
                        {o.account?.name ?? "—"}
                      </p>
                      <BusinessUnitChips codes={o.businessUnits} />
                    </div>
                    <span
                      className={`
                        border-border text-muted-foreground shrink-0
                        rounded-full border px-2 py-0.5 text-[10px]
                      `}
                    >
                      {OPPORTUNITY_STAGE_LABELS[o.stage as OpportunityStage] ??
                        o.stage}
                    </span>
                  </div>
                  <div
                    className={`
                      text-foreground flex items-center justify-between
                      text-[11px] tabular-nums
                    `}
                  >
                    <span>{formatCurrency(Number(o.value), o.currency)}</span>
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
                  <div className="mt-1 flex justify-end">
                    <PermissionButton
                      permission="crm:update"
                      variant="outline"
                      size="sm"
                      onClick={() => void handleRestore(o.id)}
                    >
                      <ArchiveRestore className="mr-1.5 size-3.5" />
                      Restore
                    </PermissionButton>
                  </div>
                </div>
              ))}
            </div>
            {archivedItems.length < archivedTotal ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => void fetchArchived(archivedPage + 1)}
                disabled={archivedLoading}
              >
                {archivedLoading ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <ChevronDown className="size-3" />
                )}
                Load more ({archivedTotal - archivedItems.length})
              </Button>
            ) : null}
          </div>
        )
      ) : loading ? (
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
            const rollup = rollupByStage.get(stage);
            const totals = rollup?.totals ?? [];
            // Prefer the server rollup; fall back to the column's own
            // meta.total when the rollup has no row for this stage.
            const dealCount = rollup?.count ?? column.total;
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
                  <div className="flex items-center gap-2">
                    {canMove && cards.length > 0 && (
                      // Tick the loaded cards in this column. Scoped to what is
                      // on screen on purpose — the column may hold more pages,
                      // and "select all N matching" is the board-wide escalation.
                      <Checkbox
                        checked={cards.every((c) => selection.isSelected(c.id))}
                        onCheckedChange={(next) =>
                          selection.toggleMany(
                            cards.map((c) => c.id),
                            next === true,
                          )
                        }
                        aria-label={`Select loaded ${OPPORTUNITY_STAGE_LABELS[stage]} cards`}
                      />
                    )}
                    <p className="text-foreground text-sm font-semibold">
                      {OPPORTUNITY_STAGE_LABELS[stage]}
                    </p>
                  </div>
                  {/*
                    One count now: a card is a deal, so "cards" and "deals"
                    can no longer disagree. They were shown side by side only
                    while one deal could fan out into several cards.
                  */}
                  <p className="text-muted-foreground mt-0.5 text-[11px]">
                    {dealCount} {dealCount === 1 ? "deal" : "deals"}
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
                          {formatCurrency(t.value, t.currency)}
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
                      No cards
                    </p>
                  ) : (
                    cards.map((o) => {
                      const key = o.id;
                      const isTerminal =
                        o.stage === "closed_won" || o.stage === "closed_lost";
                      const isDragging = draggingId === key;
                      const selected = selection.isSelected(key);
                      return (
                        <div key={key} className="relative">
                          {canMove && (
                            // Sibling, not a child of the card: a checkbox
                            // nested inside a <button> is invalid HTML and its
                            // clicks would fight the card's onClick.
                            <span className={`absolute top-2 left-2 z-10`}>
                              <Checkbox
                                checked={selected}
                                onCheckedChange={() => selection.toggle(key)}
                                aria-label={`Select ${o.name}`}
                              />
                            </span>
                          )}
                          <button
                            type="button"
                            draggable={canMove}
                            onDragStart={(e) => handleDragStart(e, key, stage)}
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
                                ? handleDropOnCard(e, key, stage)
                                : undefined
                            }
                            onClick={() => openCard(o)}
                            className={`
                              border-border bg-background flex w-full flex-col
                              gap-1 rounded-md border p-2 text-left
                              hover:border-foreground/20 hover:shadow-sm
                              ${canMove ? "pl-8" : ""}
                              ${selected ? "ring-primary/60 ring-2" : ""}
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
                            {/*
                            Every unit on the deal, each with ITS OWN stage —
                            "Onewave - Live", "ARIA - Qualified". The column
                            says only where the deal is (the least-advanced
                            unit under the roll-up), so this row is the only
                            place a rep can see that the rest is further on.
                          */}
                            <BusinessUnitStageChips units={o.units} />
                            <div
                              className={`
                                text-foreground flex items-center
                                justify-between text-[11px] tabular-nums
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
                          {canMove ? (
                            <button
                              type="button"
                              aria-label="Move to another stage"
                              title="Move to stage"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMoveTarget(o);
                              }}
                              className={`
                                text-muted-foreground absolute top-1 right-1
                                inline-flex size-6 items-center justify-center
                                rounded
                                hover:bg-muted hover:text-foreground
                                max-md:after:absolute max-md:after:size-11
                                max-md:after:content-['']
                              `}
                            >
                              <ArrowLeftRight className="size-3.5" />
                            </button>
                          ) : null}
                        </div>
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

      <OpportunityFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        opportunity={editing}
        onSaved={notifyPipelineMutated}
      />

      <PipelineMoveSheet
        open={moveTarget !== null}

        onOpenChange={(v) => !v && setMoveTarget(null)}

        opportunity={moveTarget}

        onMove={moveCard}
      />

      <OpportunityDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        opportunityId={detailOppId}
        onEdit={openEditFromSheet}
        onClosedLost={notifyPipelineMutated}
        onReopened={notifyPipelineMutated}
        onDeleted={notifyPipelineMutated}
        onArchived={notifyPipelineMutated}
      />

      <LostReasonsManagerDialog
        open={lostReasonsManagerOpen}
        onOpenChange={setLostReasonsManagerOpen}
      />

      <StageConfigManagerDialog
        open={stageConfigManagerOpen}
        onOpenChange={setStageConfigManagerOpen}
        // Re-fetch pipeline so the column headers / labels reflect the
        // freshly saved sortOrder + label.
        onSaved={fetchPipeline}
      />

      <BusinessUnitsManagerDialog
        open={businessUnitsManagerOpen}
        onOpenChange={setBusinessUnitsManagerOpen}
        // A renamed / recoloured / deleted unit changes what the chips and
        // the filter options say, so re-pull the board.
        onSaved={fetchPipeline}
      />

      <ExchangeRatesManagerDialog
        open={exchangeRatesManagerOpen}
        onOpenChange={setExchangeRatesManagerOpen}
        // Forecast totals (when present in a future PR) refetch via the
        // existing fetchPipeline path so any rate change re-rolls the
        // banner without a hard refresh.
        onMutated={fetchPipeline}
      />

      <BulkActionBar
        selection={selection}
        recordLabel={selection.count === 1 ? "deal" : "deals"}
        total={boardTotal}
        actions={[
          {
            key: "business-units",
            label: "Business units",
            onClick: () => setBulkUnitsOpen(true),
          },
          {
            key: "owner",
            label: "Owner",
            onClick: () => setBulkFieldMode("owner"),
          },
          {
            key: "stage",
            label: "Stage",
            onClick: () => setBulkFieldMode("lifecycle"),
          },
          {
            key: "archive",
            label: view === "archived" ? "Restore" : "Archive",
            variant: "outline",
            onClick: () =>
              setBulkFieldMode(view === "archived" ? "unarchive" : "archive"),
          },
        ]}
      />

      <BulkFieldDialog
        mode={bulkFieldMode}
        onClose={() => setBulkFieldMode(null)}
        count={selection.count}
        recordLabel={selection.count === 1 ? "deal" : "deals"}
        selection={{
          ...(selection.allMatching
            ? {
                allMatching: true,
                filter: {
                  country: countryFilter || undefined,
                  region: regionFilter || undefined,
                  ownerId: ownerFilter || undefined,
                  businessUnit: businessUnitFilter || undefined,
                  archived: view === "archived" || undefined,
                },
              }
            : { ids: selection.ids }),
        }}
        lifecycle={{
          field: "stage",
          label: "Move to stage",
          // Non-terminal stages only, mirroring BULK_SETTABLE_STAGES on the
          // API. closed_lost needs a reason and closed_won / live are
          // milestones with dates a bulk set cannot supply.
          options: (["qualified", "proposal", "negotiation"] as const).map(
            (value) => ({
              value,
              label: OPPORTUNITY_STAGE_LABELS[value],
            }),
          ),
        }}
        submit={bulkUpdateOpportunitiesFields}
        onDone={() => {
          selection.clear();
          void fetchPipeline();
        }}
      />

      <BulkBusinessUnitsDialog
        open={bulkUnitsOpen}
        onOpenChange={setBulkUnitsOpen}
        count={selection.count}
        recordLabel={selection.count === 1 ? "deal" : "deals"}
        selection={{
          ...(selection.allMatching
            ? {
                allMatching: true,
                // Must mirror the board's own filters, or "select all matching"
                // acts on deals the board never showed. `archived` follows the
                // Active/Archived toggle for the same reason.
                filter: {
                  country: countryFilter || undefined,
                  region: regionFilter || undefined,
                  ownerId: ownerFilter || undefined,
                  businessUnit: businessUnitFilter || undefined,
                  archived: view === "archived" || undefined,
                },
              }
            : { ids: selection.ids }),
        }}
        submit={bulkAssignOpportunitiesBusinessUnits}
        onDone={() => {
          selection.clear();
          void fetchPipeline();
        }}
      />
    </div>
  );
}
