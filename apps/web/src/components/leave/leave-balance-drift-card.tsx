"use client";

import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type BalanceDriftResult,
  type BalanceDriftRow,
  getBalanceDrift,
} from "@/services/leave.service";

/**
 * `LeaveBalance.used` is a stored counter, not a derived value, so it can
 * drift from the employee's request list and nothing in the product
 * notices. This panel is the thing that notices — without it the first
 * signal is an employee reporting that their balance card is wrong.
 */

function signed(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return rounded > 0 ? `+${rounded}` : `${rounded}`;
}

/**
 * The likeliest explanation for one row, in the order a human would
 * check it. Deleted-approved days and never-charged days are concrete
 * causes; an HR write is a "go ask" rather than a cause.
 */
function explain(row: BalanceDriftRow): { label: string; tone: string } {
  if (row.deletedApprovedDays > 0) {
    return {
      label: `${row.deletedApprovedDays}d on deleted requests`,
      tone: "text-amber-700 dark:text-amber-400",
    };
  }
  if (row.undeductedApprovedDays > 0) {
    return {
      label: `${row.undeductedApprovedDays}d approved but never charged`,
      tone: "text-amber-700 dark:text-amber-400",
    };
  }
  if (row.ledgerRowCount > 0) {
    return {
      label: `${row.ledgerRowCount} HR edit${row.ledgerRowCount === 1 ? "" : "s"}`,
      tone: "text-muted-foreground",
    };
  }
  return {
    label: "No HR edit on record",
    tone: "text-destructive",
  };
}

export function LeaveBalanceDriftCard({ year }: { year?: number }) {
  const [result, setResult] = useState<BalanceDriftResult | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setResult(await getBalanceDrift(year));
    } catch {
      toast.error("Could not load the balance drift report");
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = result?.data ?? [];
  const meta = result?.meta;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm">
              {rows.length > 0 ? (
                <AlertTriangle className="text-destructive size-4" />
              ) : (
                <CheckCircle2 className="size-4 text-emerald-600" />
              )}
              Balance drift
            </CardTitle>
            <CardDescription className="text-xs">
              Balances whose stored &ldquo;used&rdquo; figure no longer matches
              the employee&rsquo;s approved requests. These are what an employee
              sees as a wrong balance card.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            Recheck
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            <Loader2 className="size-3.5 animate-spin" />
            Checking balances…
          </div>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            {meta
              ? `All ${meta.scanned} balance${meta.scanned === 1 ? "" : "s"} agree with their approved requests.`
              : "No drift detected."}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-muted-foreground text-xs">
              <span className="text-foreground font-medium">
                {meta?.drifted}
              </span>{" "}
              of {meta?.scanned} balances disagree
              {meta && meta.untouchedByHr > 0 ? (
                <>
                  {" — "}
                  <span className="text-foreground font-medium">
                    {meta.untouchedByHr}
                  </span>{" "}
                  with no HR edit on record, so those are not explained by a
                  manual correction.
                </>
              ) : (
                "."
              )}
            </p>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[46rem] text-left text-xs">
                <thead className="text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-2 pr-3 font-medium">Employee</th>
                    <th className="py-2 pr-3 font-medium">Leave type</th>
                    <th className="py-2 pr-3 font-medium">Year</th>
                    <th className="py-2 pr-3 text-right font-medium">Used</th>
                    <th className="py-2 pr-3 text-right font-medium">
                      Approved
                    </th>
                    <th className="py-2 pr-3 text-right font-medium">Drift</th>
                    <th className="py-2 font-medium">Likely cause</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const cause = explain(row);
                    return (
                      <tr
                        key={`${row.balanceId}-${row.year}`}
                        className={`
                          border-b
                          last:border-0
                        `}
                      >
                        <td className="py-2 pr-3">
                          <span className="font-medium">
                            {row.employee.name}
                          </span>
                          <span className="text-muted-foreground block">
                            {row.employee.email}
                          </span>
                        </td>
                        <td className="py-2 pr-3">{row.leaveType.name}</td>
                        <td className="py-2 pr-3">{row.year}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {row.used}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {row.approvedDays}
                        </td>
                        <td className="py-2 pr-3 text-right">
                          <Badge
                            variant={
                              row.drift > 0 ? "destructive" : "secondary"
                            }
                            className="tabular-nums"
                          >
                            {signed(row.drift)}
                          </Badge>
                        </td>
                        <td
                          className={`
                            py-2
                            ${cause.tone}
                          `}
                        >
                          {cause.label}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="text-muted-foreground text-xs">
              A positive drift means the card charges the employee for more days
              than they have approved requests for. Correcting a balance is a
              manual HR edit — check the balance history first, and treat rows
              with an HR edit on record as intentional until HR confirms
              otherwise.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
