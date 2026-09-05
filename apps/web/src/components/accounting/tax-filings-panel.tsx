"use client";

import { Loader2, Lock, Unlock } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { formatDate } from "@/components/accounting/accounting-utils";
import { Badge } from "@/components/shared/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import {
  fileTaxPeriod,
  listTaxFilings,
  reopenTaxPeriod,
  type TaxFiling,
} from "@/services/accounting.service";
import type { Entity } from "@/services/entity.service";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

interface TaxFilingsPanelProps {
  entities: Entity[];
  canAdmin: boolean;
}

export function TaxFilingsPanel({ entities, canAdmin }: TaxFilingsPanelProps) {
  const now = new Date();
  const [entityId, setEntityId] = useState("");
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const [filings, setFilings] = useState<TaxFiling[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!entityId && entities[0]) setEntityId(entities[0].id);
  }, [entityId, entities]);

  const load = useCallback(async () => {
    if (!entityId) return;
    try {
      setLoading(true);
      const res = await listTaxFilings({ entityId, year });
      setFilings(res.data);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load tax filings",
      );
    } finally {
      setLoading(false);
    }
  }, [entityId, year]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onFile() {
    try {
      setBusy(true);
      await fileTaxPeriod({ entityId, year, month });
      toast.success(`VAT ${year}-${String(month).padStart(2, "0")} filed & locked`);
      await load();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to file tax month",
      );
    } finally {
      setBusy(false);
    }
  }

  async function onReopen(f: TaxFiling) {
    try {
      setBusy(true);
      await reopenTaxPeriod({
        entityId: f.entityId,
        filingType: f.filingType,
        year: f.year,
        month: f.month,
      });
      toast.success(
        `VAT ${f.year}-${String(f.month).padStart(2, "0")} reopened`,
      );
      await load();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to reopen tax month",
      );
    } finally {
      setBusy(false);
    }
  }

  const years = [now.getUTCFullYear(), now.getUTCFullYear() - 1];

  return (
    <section
      className={`border-border bg-card overflow-hidden rounded-xl border`}
    >
      <div
        className={`
          border-border flex flex-col gap-3 border-b px-5 py-4
          sm:flex-row sm:items-end sm:justify-between
        `}
      >
        <div>
          <h3 className="font-serif text-lg">Tax filings &amp; month lock</h3>
          <p className="text-muted-foreground text-xs">
            Filing a VAT month snapshots its register and locks documents dated
            into it. Reopen to amend.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Select value={entityId} onValueChange={setEntityId}>
            <SelectTrigger className="h-9 w-[160px] text-xs">
              <SelectValue placeholder="Entity" />
            </SelectTrigger>
            <SelectContent>
              {entities.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={String(year)}
            onValueChange={(v) => setYear(Number(v))}
          >
            <SelectTrigger className="h-9 w-[90px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {canAdmin ? (
        <div
          className={`
            border-border flex flex-wrap items-end gap-2 border-b px-5 py-3
          `}
        >
          <Select
            value={String(month)}
            onValueChange={(v) => setMonth(Number(v))}
          >
            <SelectTrigger className="h-9 w-[110px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={m} value={String(i + 1)}>
                  {m} {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" size="sm" disabled={busy} onClick={onFile}>
            {busy ? (
              <Loader2 className="mr-1 size-3.5 animate-spin" />
            ) : (
              <Lock className="mr-1 size-3.5" />
            )}
            File this month
          </Button>
        </div>
      ) : null}

      <div className="divide-border divide-y">
        {filings.length === 0 ? (
          <div
            className={`
              text-muted-foreground flex h-24 items-center justify-center
              text-xs
            `}
          >
            {loading ? "Loading…" : "No tax months filed for this year."}
          </div>
        ) : (
          filings.map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-3 px-5 py-3 text-sm"
            >
              <span className="w-24 font-medium tabular-nums">
                {f.year}-{String(f.month).padStart(2, "0")}
              </span>
              <span className="text-muted-foreground w-12 text-xs uppercase">
                {f.filingType}
              </span>
              <Badge variant={f.status === "filed" ? "green" : "amber"}>
                {f.status === "filed" ? "Filed" : "Reopened"}
              </Badge>
              <span className="text-muted-foreground flex-1 text-xs">
                {f.status === "filed"
                  ? `Filed ${formatDate(f.filedAt)}`
                  : f.reopenedAt
                    ? `Reopened ${formatDate(f.reopenedAt)}`
                    : ""}
              </span>
              {canAdmin && f.status === "filed" ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  disabled={busy}
                  onClick={() => onReopen(f)}
                >
                  <Unlock className="mr-1 size-3" />
                  Reopen
                </Button>
              ) : null}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
