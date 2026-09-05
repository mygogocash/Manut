"use client";

import { Check, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  formatCurrency,
  formatDate,
} from "@/components/accounting/accounting-utils";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api-client";
import {
  approveFixedAssetDisposal,
  type FixedAssetDisposal,
  listFixedAssetDisposals,
  rejectFixedAssetDisposal,
} from "@/services/accounting.service";

interface Props {
  entityId: string;
  canApprove: boolean;
  refreshKey: number;
  onActioned: () => void;
}

export function FixedAssetDisposalQueue({
  entityId,
  canApprove,
  refreshKey,
  onActioned,
}: Props) {
  const [rows, setRows] = useState<FixedAssetDisposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!entityId) return;
    try {
      setLoading(true);
      const res = await listFixedAssetDisposals({
        entityId,
        status: "pending",
      });
      setRows(res.data);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load disposals",
      );
    } finally {
      setLoading(false);
    }
  }, [entityId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const approve = useCallback(
    async (d: FixedAssetDisposal) => {
      try {
        setActingId(d.id);
        await approveFixedAssetDisposal(d.id);
        toast.success("Disposal approved");
        await load();
        onActioned();
      } catch (err) {
        toast.error(
          err instanceof ApiError ? err.message : "Failed to approve",
        );
      } finally {
        setActingId(null);
      }
    },
    [load, onActioned],
  );

  const reject = useCallback(
    async (d: FixedAssetDisposal) => {
      const reason = window.prompt("Reason for rejecting this disposal?");
      if (reason === null) return;
      if (!reason.trim()) {
        toast.error("A rejection reason is required");
        return;
      }
      try {
        setActingId(d.id);
        await rejectFixedAssetDisposal(d.id, reason.trim());
        toast.success("Disposal rejected");
        await load();
        onActioned();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Failed to reject");
      } finally {
        setActingId(null);
      }
    },
    [load, onActioned],
  );

  if (!loading && rows.length === 0) return null;

  const columns = [
    {
      key: "asset",
      mobileRole: "title" as const,
      header: "Asset",
      render: (d: FixedAssetDisposal) => (
        <div>
          <div className="font-medium">{d.asset?.assetNo ?? "—"}</div>
          <div className="text-muted-foreground text-xs">{d.asset?.name}</div>
        </div>
      ),
    },
    {
      key: "disposalType",
      mobileRole: "subtitle" as const,
      header: "Type",
      render: (d: FixedAssetDisposal) => (
        <span className="text-xs capitalize">
          {d.disposalType.replace("_", " ")}
        </span>
      ),
    },
    {
      key: "disposalDate",
      mobileRole: "detail" as const,
      header: "Date",
      render: (d: FixedAssetDisposal) => (
        <span className="tabular-nums">{formatDate(d.disposalDate)}</span>
      ),
    },
    {
      key: "unitsDisposed",
      mobileRole: "detail" as const,
      header: "Units",
      className: "text-right",
      render: (d: FixedAssetDisposal) => (
        <span className="tabular-nums">{d.unitsDisposed}</span>
      ),
    },
    {
      key: "proceeds",
      mobileRole: "field" as const,
      header: "Proceeds",
      className: "text-right",
      render: (d: FixedAssetDisposal) => (
        <span className="tabular-nums">{formatCurrency(d.proceeds)}</span>
      ),
    },
    {
      key: "nbvDisposed",
      mobileRole: "detail" as const,
      header: "NBV disposed",
      className: "text-right",
      render: (d: FixedAssetDisposal) => (
        <span className="tabular-nums">
          {d.nbvDisposed ? formatCurrency(d.nbvDisposed) : "—"}
        </span>
      ),
    },
    {
      key: "gainLoss",
      mobileRole: "field" as const,
      header: "Gain / (loss)",
      className: "text-right",
      render: (d: FixedAssetDisposal) => {
        const v = d.gainLoss ? Number(d.gainLoss) : 0;
        return (
          <span
            className={
              v < 0
                ? "text-destructive tabular-nums"
                : "tabular-nums text-emerald-600"
            }
          >
            {d.gainLoss ? formatCurrency(d.gainLoss) : "—"}
          </span>
        );
      },
    },
    {
      key: "actions",
      mobileRole: "actions" as const,
      header: "",
      className: "w-28 text-right",
      render: (d: FixedAssetDisposal) => {
        if (!canApprove) return null;
        const busy = actingId === d.id;
        return (
          <div className="inline-flex gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={busy}
              onClick={() => void approve(d)}
              aria-label="Approve"
            >
              {busy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Check className="size-3.5 text-emerald-600" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={busy}
              onClick={() => void reject(d)}
              aria-label="Reject"
            >
              <X className="text-destructive size-3.5" />
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <section className="border-border bg-card overflow-hidden rounded-xl border">
      <div className="border-border border-b px-5 py-3">
        <p
          className={`
            text-muted-foreground text-[10px] font-semibold tracking-wider
            uppercase
          `}
        >
          Pending disposal approvals
        </p>
      </div>
      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        emptyMessage="No pending disposals"
      />
    </section>
  );
}
