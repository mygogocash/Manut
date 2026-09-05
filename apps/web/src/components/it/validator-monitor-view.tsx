"use client";

import {
  AlertTriangle,
  Check,
  Copy,
  ExternalLink,
  RefreshCw,
  Settings,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { ValidatorAlertsPanel } from "@/components/it/validator-alerts-panel";
import { Badge } from "@/components/shared/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiError } from "@/lib/api-client";
import {
  getValidatorReport,
  type ValidatorReport,
  type ValidatorReportRow,
} from "@/services/validator-monitor.service";

const SUBNET_EXPLORER_PREFIX = "https://subnets.avax.network/subnets/";

function fmtAvax(n: number, digits = 4): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function fmtRunway(days: number): string {
  if (!Number.isFinite(days)) return "—";
  if (days < 1) return `${(days * 24).toFixed(1)} h`;
  return `${days.toFixed(1)} d`;
}

function truncateMiddle(s: string, head = 10, tail = 6): string {
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

function fmtTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/**
 * Each row's severity drives the row tint + runway color. Mirrors the
 * alert rules in `monitor.js` upstream so the visual cue matches what
 * the daily email already flags.
 */
function severity(row: ValidatorReportRow): "ok" | "warn" | "urgent" {
  if (row.alerts.length === 0) return "ok";
  if (row.alerts.some((a) => a.includes("runway<") || row.runwayDays < 7)) {
    return "urgent";
  }
  return "warn";
}

type LoadError =
  | { kind: "not_configured"; message: string }
  | { kind: "other"; message: string };

export function ValidatorMonitorView() {
  const [report, setReport] = useState<ValidatorReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<LoadError | null>(null);
  // `${rowKey}-${field}` of the most recently copied cell. Resets after
  // 1.5s so the Check icon revert is automatic; single state instead of
  // a Map because only one button can be in the "just copied" state.
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyValue = useCallback(async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      toast.success("Copied to clipboard");
      window.setTimeout(() => {
        setCopiedKey((prev) => (prev === key ? null : prev));
      }, 1500);
    } catch {
      toast.error("Copy failed");
    }
  }, []);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await getValidatorReport({ refresh });
      setReport(res.data);
    } catch (err) {
      if (err instanceof ApiError && err.code === "NOT_CONFIGURED") {
        setError({ kind: "not_configured", message: err.message });
        return;
      }
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to load validator report";
      setError({ kind: "other", message });
      if (refresh) toast.error(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error) {
    if (error.kind === "not_configured") {
      return (
        <div
          className={`
            flex flex-col gap-3 rounded-lg border border-amber-500/40
            bg-amber-500/5 p-6 text-sm
          `}
        >
          <div className="flex items-center gap-2 font-medium">
            <Settings className="size-4 text-amber-600" />
            Validator monitor not configured
          </div>
          <p className="text-muted-foreground text-xs">
            The API is missing the{" "}
            <code className="bg-muted rounded px-1 py-0.5 text-[11px]">
              VALIDATOR_MONITOR_GITHUB_TOKEN
            </code>{" "}
            secret. Add a fine-grained GitHub PAT (read-only on{" "}
            <code className="bg-muted rounded px-1 py-0.5 text-[11px]">
              kunanon-ui/bnry-validator-monitor
            </code>
            ) to the repo&rsquo;s GitHub Secrets and redeploy. Until then this
            tab cannot fetch the daily report.
          </p>
          <Button size="sm" variant="outline" onClick={() => void load(true)}>
            <RefreshCw className="mr-1 size-3.5" />
            Try again
          </Button>
        </div>
      );
    }
    return (
      <div
        className={`
          border-destructive/40 bg-destructive/5 flex flex-col gap-3 rounded-lg
          border p-6 text-sm
        `}
      >
        <div className="flex items-center gap-2 font-medium">
          <AlertTriangle className="text-destructive size-4" />
          Failed to load validator report
        </div>
        <p className="text-muted-foreground text-xs">{error.message}</p>
        <Button size="sm" variant="outline" onClick={() => void load(true)}>
          <RefreshCw className="mr-1 size-3.5" />
          Try again
        </Button>
      </div>
    );
  }

  if (!report) return null;

  const minRunway = report.summary.minRunwayDays ?? null;
  const knownNodeIds = report.rows.map((r) => r.nodeID);
  // BnryMainnet subnet id is fixed in the upstream README; surface a
  // link to the Avalanche explorer for quick context-switch.
  const subnetId = "23dqTMHK186m4Rzcn1ukJdmHy13nqido4LjTp5Kh9W6qBKaFib";

  return (
    <div className="flex flex-col gap-4">
      {/* Summary cards */}
      <div
        className={`
          grid grid-cols-2 gap-3
          md:grid-cols-4
        `}
      >
        <SummaryCard
          label="Validators"
          value={String(report.summary.count)}
          hint={report.subnet}
        />
        <SummaryCard
          label="Total balance"
          value={`${fmtAvax(report.summary.totalBalanceAvax)} AVAX`}
          hint="P-Chain"
        />
        <SummaryCard
          label="Alerting"
          value={String(report.summary.alerting)}
          hint={report.summary.alerting > 0 ? "Needs attention" : "All clear"}
          tone={report.summary.alerting > 0 ? "warn" : "ok"}
        />
        <SummaryCard
          label="Min runway"
          value={minRunway != null ? fmtRunway(minRunway) : "—"}
          hint="Lowest across all nodes"
          tone={
            minRunway != null && minRunway < 7
              ? "urgent"
              : minRunway != null && minRunway < 14
                ? "warn"
                : "ok"
          }
        />
      </div>

      {/* Meta row */}
      <div
        className={`
          text-muted-foreground flex flex-wrap items-center gap-3 text-[11px]
        `}
      >
        <span>
          Report generated{" "}
          <span className="text-foreground font-medium">
            {fmtTimestamp(report.generatedAt)}
          </span>
        </span>
        <span>·</span>
        <span>
          Cache: {fmtTimestamp(report.cachedAt)}
          {report.cached ? " (cached)" : " (fresh)"}
        </span>
        <span className="ml-auto flex items-center gap-2">
          <a
            href={`${SUBNET_EXPLORER_PREFIX}${subnetId}`}
            target="_blank"
            rel="noreferrer"
            className={`
              hover:text-foreground hover:underline
              inline-flex items-center gap-1 underline-offset-2
            `}
          >
            Explorer
            <ExternalLink className="size-3" />
          </a>
          <Button
            size="sm"
            variant="outline"
            disabled={refreshing}
            onClick={() => void load(true)}
          >
            <RefreshCw
              className={`
                mr-1 size-3.5
                ${refreshing ? "animate-spin" : ""}
              `}
            />
            Refresh
          </Button>
        </span>
      </div>

      {/* Alerts panel */}
      <ValidatorAlertsPanel knownNodeIds={knownNodeIds} />

      {/* Nodes table */}
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Node ID</TableHead>
              <TableHead>Validation ID</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead className="text-right">Burn / day</TableHead>
              <TableHead className="text-right">Runway</TableHead>
              <TableHead>Alerts</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className={`text-muted-foreground py-10 text-center text-xs`}
                >
                  No validators in the report
                </TableCell>
              </TableRow>
            ) : (
              report.rows.map((row) => {
                const sev = severity(row);
                return (
                  <TableRow
                    key={row.nodeID}
                    className={
                      sev === "urgent"
                        ? "bg-destructive/5"
                        : sev === "warn"
                          ? "bg-warning/5"
                          : undefined
                    }
                  >
                    <TableCell>
                      <CopyableId
                        value={row.nodeID}
                        copied={copiedKey === `${row.nodeID}-node`}
                        onCopy={() =>
                          void copyValue(row.nodeID, `${row.nodeID}-node`)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <CopyableId
                        value={row.validationID}
                        muted
                        copied={copiedKey === `${row.nodeID}-validation`}
                        onCopy={() =>
                          void copyValue(
                            row.validationID,
                            `${row.nodeID}-validation`,
                          )
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtAvax(row.balanceAvax)} AVAX
                    </TableCell>
                    <TableCell
                      className={`
                        text-muted-foreground text-right text-xs tabular-nums
                      `}
                    >
                      {fmtAvax(row.burnAvaxPerDay, 5)}
                    </TableCell>
                    <TableCell
                      className={`
                        text-right tabular-nums
                        ${
                          sev === "urgent"
                            ? "text-destructive font-medium"
                            : sev === "warn"
                              ? "text-warning font-medium"
                              : ""
                        }
                      `}
                    >
                      {fmtRunway(row.runwayDays)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {row.alerts.length === 0 ? (
                          <Badge variant="green">OK</Badge>
                        ) : (
                          row.alerts.map((a) => (
                            <Badge
                              key={a}
                              variant={sev === "urgent" ? "red" : "amber"}
                            >
                              {a}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function CopyableId({
  value,
  copied,
  onCopy,
  muted = false,
}: {
  value: string;
  copied: boolean;
  onCopy: () => void;
  muted?: boolean;
}) {
  return (
    <div className="group inline-flex items-center gap-1.5">
      <span
        className={`
          font-mono text-[11px]
          ${muted ? "text-muted-foreground" : ""}
        `}
        title={value}
      >
        {truncateMiddle(value)}
      </span>
      <button
        type="button"
        onClick={onCopy}
        aria-label={copied ? "Copied" : `Copy ${value}`}
        title={copied ? "Copied" : "Copy full ID"}
        className={`
          text-muted-foreground inline-flex size-5 shrink-0 items-center
          justify-center rounded transition-colors
          hover:text-foreground hover:bg-muted/60
        `}
      >
        {copied ? (
          <Check className="size-3 text-emerald-600" />
        ) : (
          <Copy className="size-3" />
        )}
      </button>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  tone = "ok",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "ok" | "warn" | "urgent";
}) {
  const toneClass =
    tone === "urgent"
      ? "border-destructive/40 bg-destructive/5"
      : tone === "warn"
        ? "border-warning/40 bg-warning/5"
        : "border-border bg-muted/30";
  return (
    <div
      className={`
        rounded-lg border p-3
        ${toneClass}
      `}
    >
      <div
        className={`
          text-muted-foreground text-[10px] font-medium tracking-wide uppercase
        `}
      >
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
      {hint && (
        <div className="text-muted-foreground mt-0.5 text-[11px]">{hint}</div>
      )}
    </div>
  );
}
