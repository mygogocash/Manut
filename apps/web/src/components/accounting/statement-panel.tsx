"use client";

import { Download, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
  downloadStatement,
  type Invoice,
  listInvoices,
} from "@/services/accounting.service";
import type { Entity } from "@/services/entity.service";

type Side = "receivable" | "payable";

interface StatementPanelProps {
  entities: Entity[];
}

export function StatementPanel({ entities }: StatementPanelProps) {
  const [entityId, setEntityId] = useState("");
  const [side, setSide] = useState<Side>("receivable");
  const [counterparty, setCounterparty] = useState("");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!entityId && entities[0]) setEntityId(entities[0].id);
  }, [entityId, entities]);

  const load = useCallback(async () => {
    if (!entityId) return;
    try {
      setLoading(true);
      const res = await listInvoices({ entityId, type: side, limit: 100 });
      setInvoices(res.data);
      setCounterparty("");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load documents",
      );
    } finally {
      setLoading(false);
    }
  }, [entityId, side]);

  useEffect(() => {
    void load();
  }, [load]);

  const counterparties = useMemo(
    () => [...new Set(invoices.map((i) => i.counterparty))].sort(),
    [invoices],
  );

  async function onDownload() {
    if (!counterparty) {
      toast.error("Pick a counterparty");
      return;
    }
    try {
      setBusy(true);
      await downloadStatement({ entityId, counterparty, type: side });
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to download statement",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className={`border-border bg-card overflow-hidden rounded-xl border`}
    >
      <div className="border-border border-b px-5 py-4">
        <h3 className="font-serif text-lg">Statement of account</h3>
        <p className="text-muted-foreground text-xs">
          A per-counterparty PDF: every non-draft document, its outstanding, and
          an aging of the open balance.
        </p>
      </div>
      <div
        className={`
          flex flex-wrap items-end gap-3 px-5 py-4
        `}
      >
        <div className="flex flex-col gap-1">
          <Label className="text-[10px]">Entity</Label>
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
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-[10px]">Type</Label>
          <Select value={side} onValueChange={(v) => setSide(v as Side)}>
            <SelectTrigger className="h-9 w-[150px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="receivable">Receivable (AR)</SelectItem>
              <SelectItem value="payable">Payable (AP)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-[10px]">Counterparty</Label>
          <Select
            value={counterparty}
            onValueChange={setCounterparty}
            disabled={counterparties.length === 0}
          >
            <SelectTrigger className="h-9 w-[220px] text-xs">
              <SelectValue
                placeholder={
                  loading
                    ? "Loading…"
                    : counterparties.length === 0
                      ? "No documents"
                      : "Select counterparty"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {counterparties.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          disabled={busy || !counterparty}
          onClick={onDownload}
        >
          {busy ? (
            <Loader2 className="mr-1 size-3.5 animate-spin" />
          ) : (
            <Download className="mr-1 size-3.5" />
          )}
          Download PDF
        </Button>
      </div>
    </section>
  );
}
