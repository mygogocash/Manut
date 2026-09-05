"use client";

import { CheckCircle2, Loader2, Sparkles, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  formatCurrency,
  formatDate,
} from "@/components/accounting/accounting-utils";
import { SettleMatchDialog } from "@/components/accounting/settle-match-dialog";
import { Badge } from "@/components/shared/badge";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api-client";
import {
  type BankMatchDoc,
  type BankMatchSuggestion,
  getBankMatchSuggestions,
} from "@/services/accounting.service";

interface SmartMatchPanelProps {
  entityId: string;
  /** Notify the parent (bank tab) to refresh its list + summary after a settle. */
  onSettled: () => void;
}

export function SmartMatchPanel({ entityId, onSettled }: SmartMatchPanelProps) {
  const [suggestions, setSuggestions] = useState<BankMatchSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<{
    transaction: BankMatchSuggestion["transaction"];
    invoice: BankMatchDoc;
  } | null>(null);

  const load = useCallback(async () => {
    if (!entityId) {
      setSuggestions([]);
      return;
    }
    try {
      setLoading(true);
      const res = await getBankMatchSuggestions(entityId);
      setSuggestions(res.data);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Failed to load match suggestions",
      );
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [entityId]);

  useEffect(() => {
    void load();
  }, [load]);

  const autoMatched = suggestions.filter((s) => s.matched);
  const needsAttention = suggestions.filter(
    (s) => !s.matched && s.candidates.length > 0,
  );
  const noCandidate = suggestions.filter(
    (s) => !s.matched && s.candidates.length === 0,
  ).length;

  // Nothing actionable — stay out of the way (the list + reconcile toggle below
  // still handle everything).
  if (!loading && autoMatched.length === 0 && needsAttention.length === 0) {
    return null;
  }

  const handleSettled = () => {
    void load();
    onSettled();
  };

  return (
    <section className="border-border bg-card overflow-hidden rounded-xl border">
      <div
        className={`
          border-border flex items-center justify-between border-b px-5 py-4
        `}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="text-primary size-4" />
          <div>
            <p
              className={`
                text-muted-foreground text-[10px] font-semibold tracking-wider
                uppercase
              `}
            >
              Smart match
            </p>
            <p className="text-sm">
              {autoMatched.length} auto-matched · {needsAttention.length} need a
              pick
              {noCandidate > 0 ? ` · ${noCandidate} with no candidate` : ""}
            </p>
          </div>
        </div>
        {loading ? (
          <Loader2 className="text-muted-foreground size-4 animate-spin" />
        ) : null}
      </div>

      <div className="divide-border divide-y">
        {autoMatched.map((s) => (
          <div
            key={s.transaction.id}
            className={`
              flex flex-col gap-2 px-5 py-3 text-xs
              sm:flex-row sm:items-center sm:justify-between
            `}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="text-success size-4 shrink-0" />
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {s.transaction.description}
                </p>
                <p className="text-muted-foreground tabular-nums">
                  {formatDate(s.transaction.date)} ·{" "}
                  {formatCurrency(s.transaction.amount)} →{" "}
                  {s.matched!.invoiceNo} ({s.matched!.counterparty})
                </p>
              </div>
            </div>
            <Button
              size="xs"
              onClick={() =>
                setSelected({
                  transaction: s.transaction,
                  invoice: s.matched!,
                })
              }
            >
              Confirm &amp; settle
            </Button>
          </div>
        ))}

        {needsAttention.map((s) => (
          <div key={s.transaction.id} className="flex flex-col gap-2 px-5 py-3">
            <div className="flex items-center gap-2 text-xs">
              <TriangleAlert className="size-4 shrink-0 text-amber-500" />
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {s.transaction.description}
                </p>
                <p className="text-muted-foreground tabular-nums">
                  {formatDate(s.transaction.date)} ·{" "}
                  {formatCurrency(s.transaction.amount)} · pick which document
                  it settles:
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pl-6">
              {s.candidates.map((c) => (
                <Button
                  key={c.invoiceId}
                  variant="outline"
                  size="xs"
                  onClick={() =>
                    setSelected({ transaction: s.transaction, invoice: c })
                  }
                >
                  {c.invoiceNo}
                  <Badge variant={c.type === "receivable" ? "blue" : "amber"}>
                    {c.type}
                  </Badge>
                  <span className="tabular-nums">
                    {formatCurrency(c.outstanding)}
                  </span>
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <SettleMatchDialog
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        entityId={entityId}
        transaction={selected?.transaction ?? null}
        invoice={selected?.invoice ?? null}
        onSettled={() => {
          setSelected(null);
          handleSettled();
        }}
      />
    </section>
  );
}
