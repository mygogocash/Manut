"use client";

import {
  Landmark,
  Loader2,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { formatCurrency } from "@/components/accounting/accounting-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import {
  type AgingSummary,
  getAgingSummary,
} from "@/services/accounting.service";
import type { Entity } from "@/services/entity.service";

// Literal, full-class map so Tailwind's static scan keeps these colours (a
// dynamic `bg-${key}` string would be purged). One colour per aging bucket,
// green→red as the debt ages.
const BUCKET_COLOR: Record<string, string> = {
  notYetDue: "bg-emerald-500",
  d1_30: "bg-lime-500",
  d31_60: "bg-amber-500",
  d61_90: "bg-orange-500",
  d90plus: "bg-red-500",
};

interface AgingSummaryPanelProps {
  entities: Entity[];
}

export function AgingSummaryPanel({ entities }: AgingSummaryPanelProps) {
  const [entityId, setEntityId] = useState("");
  const [asOf, setAsOf] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<AgingSummary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!entityId && entities[0]) setEntityId(entities[0].id);
  }, [entityId, entities]);

  const load = useCallback(async () => {
    if (!entityId) return;
    try {
      setLoading(true);
      const res = await getAgingSummary({ entityId, asOf });
      setData(res.data);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load aging summary",
      );
    } finally {
      setLoading(false);
    }
  }, [entityId, asOf]);

  useEffect(() => {
    void load();
  }, [load]);

  const ccy = data?.baseCurrency ?? "THB";

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
          <p
            className={`
              text-muted-foreground text-[10px] font-semibold tracking-wider
              uppercase
            `}
          >
            Exhibit 4
          </p>
          <h3 className="font-serif text-lg">Aging &amp; liquidity</h3>
          <p className="text-muted-foreground text-xs">
            Open AR/AP by age and cash on hand, in the entity&apos;s base
            currency.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label className="text-[10px]">Entity</Label>
            <Select value={entityId} onValueChange={setEntityId}>
              <SelectTrigger className="h-8 w-[170px] text-xs">
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
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-[10px]">As of</Label>
            <Input
              type="date"
              value={asOf}
              onChange={(e) => setAsOf(e.target.value)}
              className="h-8 w-[150px] text-xs"
            />
          </div>
          <Button
            size="icon-sm"
            variant="outline"
            disabled={loading}
            onClick={() => void load()}
          >
            {loading ? (
              <Loader2 className="animate-spin" />
            ) : (
              <RefreshCw />
            )}
            <span className="sr-only">Refresh</span>
          </Button>
        </div>
      </div>

      {!data ? (
        <div
          className={`
            text-muted-foreground flex h-40 items-center justify-center text-xs
          `}
        >
          {loading ? "Loading…" : "Select an entity to view aging."}
        </div>
      ) : (
        <div className="space-y-5 p-5">
          <div
            className={`
              grid gap-3
              sm:grid-cols-3
            `}
          >
            <StatTile
              label="Receivables outstanding"
              value={`${ccy} ${formatCurrency(data.receivable.total)}`}
              detail={`${data.receivable.count} open invoice(s)`}
              icon={TrendingUp}
              tone="positive"
            />
            <StatTile
              label="Payables outstanding"
              value={`${ccy} ${formatCurrency(data.payable.total)}`}
              detail={`${data.payable.count} open bill(s)`}
              icon={TrendingDown}
              tone="negative"
            />
            <StatTile
              label="Bank balance"
              value={`${ccy} ${formatCurrency(data.bankBalance)}`}
              detail={
                data.excludedBankAccounts > 0
                  ? `${data.excludedBankAccounts} foreign account(s) excluded`
                  : "Active accounts, base currency"
              }
              icon={Landmark}
            />
          </div>

          <AgingBar
            title="Receivables aging"
            summary={data.receivable}
            buckets={data.buckets}
            ccy={ccy}
          />
          <AgingBar
            title="Payables aging"
            summary={data.payable}
            buckets={data.buckets}
            ccy={ccy}
          />
        </div>
      )}
    </section>
  );
}

function StatTile({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "positive" | "negative";
}) {
  return (
    <div className="border-border bg-background/40 rounded-lg border p-4">
      <div className="flex items-start justify-between">
        <p
          className={`
            text-muted-foreground text-[10px] font-semibold tracking-wider
            uppercase
          `}
        >
          {label}
        </p>
        <Icon
          className={
            tone === "positive"
              ? "text-success size-4"
              : tone === "negative"
                ? "text-destructive size-4"
                : "text-primary size-4"
          }
        />
      </div>
      <p className="mt-2 font-serif text-xl font-medium tabular-nums">{value}</p>
      <p className="text-muted-foreground mt-1 text-[11px]">{detail}</p>
    </div>
  );
}

function AgingBar({
  title,
  summary,
  buckets,
  ccy,
}: {
  title: string;
  summary: AgingSummary["receivable"];
  buckets: AgingSummary["buckets"];
  ccy: string;
}) {
  const total = summary.total;
  const segments = useMemo(
    () =>
      buckets.map((b) => ({
        key: b.key,
        label: b.label,
        amount: summary.buckets[b.key] ?? 0,
      })),
    [buckets, summary],
  );

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium">{title}</p>
        <p className="text-muted-foreground text-xs tabular-nums">
          {ccy} {formatCurrency(total)}
        </p>
      </div>
      <div className="bg-muted flex h-3 overflow-hidden rounded-full">
        {total > 0 ? (
          segments.map((s) =>
            s.amount > 0 ? (
              <div
                key={s.key}
                className={BUCKET_COLOR[s.key] ?? "bg-muted-foreground"}
                style={{ width: `${(s.amount / total) * 100}%` }}
                title={`${s.label}: ${ccy} ${formatCurrency(s.amount)}`}
              />
            ) : null,
          )
        ) : (
          <div className="bg-muted h-full w-full" />
        )}
      </div>
      <div
        className={`
          mt-2 grid grid-cols-2 gap-x-4 gap-y-1
          sm:grid-cols-5
        `}
      >
        {segments.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5">
            <span
              className={`
                size-2 shrink-0 rounded-full
                ${BUCKET_COLOR[s.key] ?? "bg-muted-foreground"}
              `}
            />
            <span className="text-muted-foreground text-[10px]">{s.label}</span>
            <span className="ml-auto text-[10px] tabular-nums">
              {formatCurrency(s.amount)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
