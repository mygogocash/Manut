"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { formatDate } from "@/components/accounting/accounting-utils";
import { Badge } from "@/components/shared/badge";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import {
  closeFiscalPeriod,
  type FiscalPeriod,
  listFiscalPeriods,
  reopenFiscalPeriod,
  revaluePeriod,
} from "@/services/accounting.service";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

interface FiscalPeriodsSectionProps {
  entityId: string;
  canAdmin: boolean;
}

export function FiscalPeriodsSection({
  entityId,
  canAdmin,
}: FiscalPeriodsSectionProps) {
  const now = new Date();
  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(String(now.getUTCFullYear()));
  const [month, setMonth] = useState(String(now.getUTCMonth() + 1));
  const [note, setNote] = useState("");
  const [closing, setClosing] = useState(false);
  const [revaluing, setRevaluing] = useState(false);
  const [reopeningId, setReopeningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!entityId) return;
    try {
      setLoading(true);
      const res = await listFiscalPeriods(entityId);
      setPeriods(res.data);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Failed to load fiscal periods";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [entityId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onClose() {
    try {
      setClosing(true);
      await closeFiscalPeriod({
        entityId,
        year: Number(year),
        month: Number(month),
        note: note.trim() || undefined,
      });
      toast.success(`Closed ${MONTHS[Number(month) - 1]} ${year}`);
      setNote("");
      await load();
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to close period";
      toast.error(msg);
    } finally {
      setClosing(false);
    }
  }

  async function onRevalue() {
    try {
      setRevaluing(true);
      const res = await revaluePeriod({
        entityId,
        year: Number(year),
        month: Number(month),
      });
      const { itemsRevalued, netFx } = res.data;
      toast.success(
        itemsRevalued > 0
          ? `Revalued ${itemsRevalued} item(s); net FX ${netFx.toFixed(2)}`
          : "No open foreign-currency items to revalue",
      );
      await load();
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to run FX revaluation";
      toast.error(msg);
    } finally {
      setRevaluing(false);
    }
  }

  const onReopen = useCallback(
    async (p: FiscalPeriod) => {
      try {
        setReopeningId(p.id);
        await reopenFiscalPeriod({
          entityId,
          year: p.year,
          month: p.month,
        });
        toast.success(`Reopened ${MONTHS[p.month - 1]} ${p.year}`);
        await load();
      } catch (err) {
        const msg =
          err instanceof ApiError ? err.message : "Failed to reopen period";
        toast.error(msg);
      } finally {
        setReopeningId(null);
      }
    },
    [entityId, load],
  );

  const columns = useMemo(
    () => [
      {
        key: "period",
        header: "Period",
        render: (p: FiscalPeriod) => (
          <span className="font-medium">
            {MONTHS[p.month - 1]} {p.year}
          </span>
        ),
      },
      {
        key: "status",
        header: "Status",
        render: (p: FiscalPeriod) => (
          <Badge status={p.status === "closed" ? "closed_lost" : "active"}>
            {p.status === "closed" ? "Closed" : "Open"}
          </Badge>
        ),
      },
      {
        key: "note",
        header: "Note",
        render: (p: FiscalPeriod) => (
          <span className="text-muted-foreground">{p.note || "—"}</span>
        ),
      },
      {
        key: "closedAt",
        header: "Closed At",
        render: (p: FiscalPeriod) =>
          p.closedAt ? formatDate(p.closedAt) : "—",
      },
      {
        key: "actions",
        mobileRole: "actions" as const,
        header: "",
        className: "text-right",
        render: (p: FiscalPeriod) =>
          canAdmin && p.status === "closed" ? (
            <Button
              type="button"
              variant="outline"
              size="xs"
              disabled={reopeningId === p.id}
              onClick={() => onReopen(p)}
            >
              {reopeningId === p.id ? (
                <Loader2 className="mr-1 size-3 animate-spin" />
              ) : null}
              Reopen
            </Button>
          ) : null,
      },
    ],
    [canAdmin, reopeningId, onReopen],
  );

  return (
    <div className="flex flex-col gap-3">
      {canAdmin ? (
        <div
          className={`
            border-border bg-surface flex flex-col gap-2 rounded-lg border p-3
            md:flex-row md:items-end
          `}
        >
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Year</span>
            <Input
              type="number"
              min="2000"
              max="2100"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="h-9 w-28 text-xs"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Month</span>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="h-9 w-36 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={m} value={String(i + 1)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <span className="text-muted-foreground text-xs">Note</span>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional reason"
              className="h-9 text-xs"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={onRevalue}
            disabled={revaluing}
            className="min-w-28"
          >
            {revaluing ? (
              <Loader2 className="mr-2 size-3.5 animate-spin" />
            ) : null}
            Revalue FX
          </Button>
          <Button
            type="button"
            onClick={onClose}
            disabled={closing}
            className="min-w-28"
          >
            {closing ? (
              <Loader2 className="mr-2 size-3.5 animate-spin" />
            ) : null}
            Close Period
          </Button>
        </div>
      ) : null}

      <DataTable
        columns={columns}
        data={periods}
        loading={loading}
        emptyMessage="No periods closed yet"
      />
    </div>
  );
}
