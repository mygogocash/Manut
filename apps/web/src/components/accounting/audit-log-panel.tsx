"use client";

import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

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
  type AuditLogEntry,
  listAccountingAuditLogs,
} from "@/services/accounting.service";

const ALL = "__all__";

// The accounting resources the audit log records. Kept in sync with the
// server's allow-list (accounting.repository ACCOUNTING_AUDIT_RESOURCES).
const RESOURCES = [
  "invoice",
  "payment",
  "credit_note",
  "quote",
  "purchase_order",
  "bank_account",
  "journal_entry",
  "tax_code",
  "fiscal_period",
  "company_setup",
  "account_mapping",
  "accounting_opening_balances",
  "accounting_maker_checker",
  "fixed_asset",
  "fixed_asset_category",
  "fixed_asset_disposal",
];

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AuditLogPanel() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [resource, setResource] = useState(ALL);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listAccountingAuditLogs({
        resource: resource === ALL ? undefined : resource,
        limit: 100,
      });
      setEntries(res.data);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load the audit log",
      );
    } finally {
      setLoading(false);
    }
  }, [resource]);

  useEffect(() => {
    void load();
  }, [load]);

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
          <h3 className="font-serif text-lg">Audit log</h3>
          <p className="text-muted-foreground text-xs">
            Who changed what, most recent first (latest 100 accounting events).
          </p>
        </div>
        <div className="flex items-end gap-2">
          <Select value={resource} onValueChange={setResource}>
            <SelectTrigger className="h-9 w-[180px] text-xs">
              <SelectValue placeholder="Resource" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All resources</SelectItem>
              {RESOURCES.map((r) => (
                <SelectItem key={r} value={r}>
                  {r.replaceAll("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="icon-sm"
            variant="outline"
            disabled={loading}
            onClick={() => void load()}
          >
            <RefreshCw className={loading ? "animate-spin" : ""} />
            <span className="sr-only">Refresh</span>
          </Button>
        </div>
      </div>

      <div className="max-h-[60vh] overflow-auto">
        <table className="w-full text-sm">
          <thead
            className={`text-muted-foreground bg-surface sticky top-0 text-xs`}
          >
            <tr className="border-border border-b">
              <th className="px-3 py-2 text-left">When</th>
              <th className="px-3 py-2 text-left">User</th>
              <th className="px-3 py-2 text-left">Action</th>
              <th className="px-3 py-2 text-left">Resource</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-border/50 border-b">
                <td className="px-3 py-1.5 whitespace-nowrap tabular-nums">
                  {fmtTime(e.timestamp)}
                </td>
                <td className="max-w-[180px] truncate px-3 py-1.5">
                  {e.user?.name ?? e.user?.email ?? "—"}
                </td>
                <td className="px-3 py-1.5">
                  <Badge variant="blue">{e.action}</Badge>
                </td>
                <td className="text-muted-foreground px-3 py-1.5">
                  {e.resource.replaceAll("_", " ")}
                  {e.resourceId ? (
                    <span className="ml-1 font-mono text-[10px]">
                      {e.resourceId.slice(0, 8)}
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
            {entries.length === 0 ? (
              <tr>
                <td
                  className={`
                    text-muted-foreground px-3 py-6 text-center text-xs
                  `}
                  colSpan={4}
                >
                  {loading ? "Loading…" : "No audit events."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
